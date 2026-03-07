import requests

from db.settings_store import get_setting
import config

_local_model = None


def _get_local_model():
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer
        model_name = get_setting("embedding_model_local") or config.EMBEDDING_MODEL
        _local_model = SentenceTransformer(model_name)
    return _local_model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed texts using configured provider."""
    provider = get_setting("embedding_provider") or "dashscope"
    if provider == "local":
        return _embed_local(texts)
    else:
        return _embed_dashscope(texts)


def embed_query(query: str) -> list[float]:
    return embed_texts([query])[0]


def _embed_local(texts: list[str]) -> list[list[float]]:
    """Embed using local sentence-transformers model."""
    model = _get_local_model()
    embeddings = model.encode(texts, show_progress_bar=False)
    return embeddings.tolist()


def _embed_dashscope(texts: list[str]) -> list[list[float]]:
    """Embed using DashScope text-embedding API."""
    api_key = get_setting("dashscope_api_key")
    model = get_setting("embedding_model_dashscope") or "text-embedding-v3"

    url = "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "input": {"texts": texts},
        "parameters": {"text_type": "query"},
    }

    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    embeddings = data["output"]["embeddings"]
    embeddings.sort(key=lambda x: x["text_index"])
    return [e["embedding"] for e in embeddings]
