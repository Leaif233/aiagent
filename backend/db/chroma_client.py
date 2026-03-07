import chromadb
from chromadb.config import Settings

import config


_client = None


def get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=config.CHROMA_PERSIST_DIR,
            settings=Settings(anonymized_telemetry=False),
        )
    return _client


def get_docs_collection():
    client = get_client()
    return client.get_or_create_collection(
        name="tech_docs",
        metadata={"hnsw:space": "l2"},
    )


def get_tickets_collection():
    client = get_client()
    return client.get_or_create_collection(
        name="tickets",
        metadata={"hnsw:space": "l2"},
    )


def get_question_index_collection():
    client = get_client()
    return client.get_or_create_collection(
        name="question_index",
        metadata={"hnsw:space": "l2"},
    )


def get_image_collection():
    """Collection for multimodal image embeddings (qwen3-vl-embedding, dim=1024)."""
    client = get_client()
    return client.get_or_create_collection(
        name="image_index",
        metadata={"hnsw:space": "l2"},
    )
