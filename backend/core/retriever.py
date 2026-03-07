from db.chroma_client import get_docs_collection, get_tickets_collection, get_question_index_collection, get_image_collection
from core.embeddings import embed_query
from core.multimodal_embeddings import embed_text_multimodal
from models.schemas import SourceRef
from db.settings_store import get_setting_int


def query_docs(query: str, top_k: int = None):
    """Query tech_docs collection, filtering only verified content."""
    if top_k is None:
        top_k = get_setting_int("top_k_results", 5)

    collection = get_docs_collection()
    if collection.count() == 0:
        return [], []

    query_embedding = embed_query(query)
    results = collection.query(
        query_embeddings=[query_embedding],
        where={"status": "已审核"},
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )
    return results.get("documents", [[]])[0], results


def query_fingerprints(query: str, top_k: int = 10) -> list[dict]:
    """Query question_index collection and return aggregated results."""
    collection = get_question_index_collection()
    if collection.count() == 0:
        return []

    query_embedding = embed_query(query)
    n = min(top_k, collection.count())
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n,
        include=["documents", "metadatas", "distances"],
    )

    if not results or not results.get("metadatas", [[]])[0]:
        return []

    return _aggregate_fingerprints(results)


def _aggregate_fingerprints(results) -> list[dict]:
    """Aggregate fingerprint results by entity, keeping highest confidence
    and collecting ALL matched section_titles for paragraph-level highlighting."""
    entity_map: dict[str, dict] = {}
    for meta, dist in zip(results["metadatas"][0], results["distances"][0]):
        if not meta or "entity_type" not in meta or "entity_id" not in meta:
            continue
        confidence = 1 / (1 + dist)
        key = f"{meta['entity_type']}:{meta['entity_id']}"
        section = meta.get("section_title", "")
        if key not in entity_map:
            entity_map[key] = {
                "entity_type": meta["entity_type"],
                "entity_id": meta["entity_id"],
                "question_text": meta.get("question_text", ""),
                "section_title": section,
                "title": meta.get("title", ""),
                "confidence": round(confidence, 3),
                "matched_sections": [section] if section else [],
            }
        else:
            existing = entity_map[key]
            if confidence > existing["confidence"]:
                existing["confidence"] = round(confidence, 3)
                existing["question_text"] = meta.get("question_text", "")
                existing["section_title"] = section
            if section and section not in existing["matched_sections"]:
                existing["matched_sections"].append(section)
    return sorted(entity_map.values(), key=lambda x: x["confidence"], reverse=True)


def query_tickets(query: str, top_k: int = None):
    """Query tickets collection, filtering only verified content."""
    if top_k is None:
        top_k = get_setting_int("top_k_results", 5)

    collection = get_tickets_collection()
    if collection.count() == 0:
        return [], []

    query_embedding = embed_query(query)
    results = collection.query(
        query_embeddings=[query_embedding],
        where={"status": "已审核"},
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )
    return results.get("documents", [[]])[0], results


def query_images(query: str, top_k: int = 3) -> list[dict]:
    """Query image_index collection using multimodal text embedding."""
    collection = get_image_collection()
    if collection.count() == 0:
        return []

    query_embedding = embed_text_multimodal(query)
    if not query_embedding:
        return []

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    items = []
    metas = results.get("metadatas", [[]])[0]
    dists = results.get("distances", [[]])[0]
    for meta, dist in zip(metas, dists):
        if not meta:
            continue
        items.append({
            "entity_type": "doc_image",
            "entity_id": meta.get("doc_id", ""),
            "image_url": meta.get("image_url", ""),
            "title": meta.get("title", ""),
            "confidence": round(1 / (1 + dist), 3),
        })
    return items


def query_dual_channel(query: str, top_k: int = 10) -> list[dict]:
    """Dual-channel retrieval: fingerprint index + direct vector search + image search."""
    channel_a = query_fingerprints(query, top_k=top_k)
    channel_b = _query_channel_b(query, top_k=5)
    merged = _merge_channels(channel_a, channel_b)

    # Image channel (separate entity_type, appended after text results)
    try:
        image_results = query_images(query, top_k=3)
        merged.extend(image_results)
    except Exception:
        pass

    return merged


def _query_channel_b(query: str, top_k: int = 5) -> list[dict]:
    """Direct vector search on tech_docs + tickets collections."""
    results = []

    # Search tech_docs
    try:
        _, raw = query_docs(query, top_k=top_k)
        metas = raw.get("metadatas", [[]])[0] if raw else []
        dists = raw.get("distances", [[]])[0] if raw else []
        for meta, dist in zip(metas, dists):
            if not meta:
                continue
            results.append({
                "entity_type": "doc",
                "entity_id": meta.get("doc_id", ""),
                "question_text": "",
                "section_title": "",
                "title": meta.get("title", ""),
                "confidence": round(1 / (1 + dist), 3),
            })
    except Exception:
        pass

    # Search tickets
    try:
        _, raw = query_tickets(query, top_k=top_k)
        metas = raw.get("metadatas", [[]])[0] if raw else []
        dists = raw.get("distances", [[]])[0] if raw else []
        for meta, dist in zip(metas, dists):
            if not meta:
                continue
            results.append({
                "entity_type": "ticket",
                "entity_id": meta.get("ticket_id", ""),
                "question_text": "",
                "section_title": "",
                "title": meta.get("ticket_number", ""),
                "confidence": round(1 / (1 + dist), 3),
            })
    except Exception:
        pass

    return results


def _merge_channels(channel_a: list[dict], channel_b: list[dict]) -> list[dict]:
    """Merge and deduplicate results from both channels, keep highest confidence."""
    entity_map: dict[str, dict] = {}

    for item in channel_a:
        key = f"{item['entity_type']}:{item['entity_id']}"
        if key not in entity_map or item["confidence"] > entity_map[key]["confidence"]:
            entity_map[key] = item

    for item in channel_b:
        key = f"{item['entity_type']}:{item['entity_id']}"
        if key not in entity_map or item["confidence"] > entity_map[key]["confidence"]:
            entity_map[key] = item

    return sorted(entity_map.values(), key=lambda x: x["confidence"], reverse=True)
