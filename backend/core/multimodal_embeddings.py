"""Multimodal embedding via DashScope qwen3-vl-embedding."""
import os

import dashscope
from dashscope import MultiModalEmbedding

import config
from db.settings_store import get_setting


def _get_api_key() -> str:
    return get_setting("dashscope_api_key") or config.DASHSCOPE_API_KEY


def embed_image_with_context(
    image_url: str, context_text: str = "", dimension: int = 1024
) -> list[float] | None:
    """Generate a fused embedding for an image + optional text context.

    Args:
        image_url: URL or local path of the image
        context_text: Surrounding text for context fusion
        dimension: Output vector dimension (default 1024)

    Returns:
        List of floats (embedding vector), or None on failure.
    """
    api_key = _get_api_key()
    if not api_key:
        return None

    input_data = [{"image": image_url}]
    if context_text:
        input_data = [{"image": image_url, "text": context_text[:500]}]

    try:
        resp = MultiModalEmbedding.call(
            api_key=api_key,
            model="qwen3-vl-embedding",
            input=input_data,
            dimension=dimension,
        )
        if resp and resp.output:
            embeddings = resp.output.get("embeddings", [])
            if embeddings:
                return embeddings[0].get("embedding")
    except Exception:
        pass
    return None


def embed_text_multimodal(text: str, dimension: int = 1024) -> list[float] | None:
    """Generate a text-only embedding using qwen3-vl-embedding.
    Used for query-time so vectors are in the same space as image embeddings.
    """
    api_key = _get_api_key()
    if not api_key:
        return None

    try:
        resp = MultiModalEmbedding.call(
            api_key=api_key,
            model="qwen3-vl-embedding",
            input=[{"text": text}],
            dimension=dimension,
        )
        if resp and resp.output:
            embeddings = resp.output.get("embeddings", [])
            if embeddings:
                return embeddings[0].get("embedding")
    except Exception:
        pass
    return None
