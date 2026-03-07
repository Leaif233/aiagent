import json
import os
from datetime import datetime

from tasks.celery_app import celery_app
from core.parser import parse_document
from core.cleaner import clean_doc_text
from db.sqlite_db import get_connection


@celery_app.task(bind=True)
def parse_document_task(self, doc_id: str, file_path: str):
    """Async task: parse uploaded document and store results."""
    conn = get_connection()
    try:
        # Set intermediate status
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE documents SET status = '解析中', updated_at = ? WHERE id = ?",
            (now, doc_id),
        )
        conn.commit()

        result = parse_document(file_path)

        # AI cleaning step
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE documents SET status = 'AI清洗中', updated_at = ? WHERE id = ?",
            (now, doc_id),
        )
        conn.commit()

        cleaned = clean_doc_text(
            result["raw_text"],
            result["image_urls"],
            result.get("image_base64_list"),
        )

        conn.execute(
            """UPDATE documents
               SET raw_content = ?,
                   cleaned_content = ?,
                   image_assets = ?,
                   status = '待审核',
                   updated_at = ?
               WHERE id = ?""",
            (
                result["raw_text"],
                cleaned,
                json.dumps(result["image_urls"]),
                datetime.utcnow().isoformat(),
                doc_id,
            ),
        )
        conn.commit()
        return {"status": "success", "doc_id": doc_id}
    except Exception as e:
        try:
            now = datetime.utcnow().isoformat()
            conn.execute(
                "UPDATE documents SET status = '处理失败', updated_at = ? WHERE id = ?",
                (now, doc_id),
            )
            conn.commit()
        except Exception:
            pass
        return {"status": "error", "doc_id": doc_id, "error": str(e)}
    finally:
        conn.close()


@celery_app.task(bind=True)
def approve_document_task(self, doc_id: str):
    """Async task: embed chunks + build fingerprint index after approval."""
    from core.embeddings import embed_texts
    from core.indexer import index_entity
    from db.chroma_client import get_docs_collection, get_image_collection
    from core.multimodal_embeddings import embed_image_with_context

    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, title, category, cleaned_content, image_assets FROM documents WHERE id = ?",
            (doc_id,),
        ).fetchone()
        if not row:
            return {"status": "error", "doc_id": doc_id, "error": "not found"}

        cleaned = row["cleaned_content"] or ""
        if not cleaned.strip():
            return {"status": "error", "doc_id": doc_id, "error": "no content"}

        # Chunk text
        chunks = _chunk_text(cleaned, max_chars=2000)

        # Embed and upsert into ChromaDB
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE documents SET status = '向量入库中', updated_at = ? WHERE id = ?",
            (now, doc_id),
        )
        conn.commit()

        collection = get_docs_collection()
        ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
        embeddings = embed_texts(chunks)
        metadatas = [
            {
                "doc_id": doc_id,
                "title": row["title"],
                "category": row["category"] or "",
                "status": "已审核",
                "chunk_index": i,
            }
            for i in range(len(chunks))
        ]
        collection.upsert(
            ids=ids, embeddings=embeddings,
            documents=chunks, metadatas=metadatas,
        )

        # Build fingerprint index
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE documents SET status = '索引构建中', updated_at = ? WHERE id = ?",
            (now, doc_id),
        )
        conn.commit()

        try:
            index_entity("doc", doc_id)
        except Exception:
            pass

        # Index images into multimodal vector collection
        try:
            image_assets_raw = row["image_assets"] or "[]"
            image_urls = json.loads(image_assets_raw)
            if image_urls:
                _index_doc_images(
                    doc_id, row["title"], image_urls,
                    get_image_collection, embed_image_with_context,
                )
        except Exception:
            pass

        # Final status
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE documents SET status = '已审核', updated_at = ? WHERE id = ?",
            (now, doc_id),
        )
        conn.commit()
        return {"status": "success", "doc_id": doc_id, "chunks": len(chunks)}
    except Exception as e:
        try:
            now = datetime.utcnow().isoformat()
            conn.execute(
                "UPDATE documents SET status = '索引失败', updated_at = ? WHERE id = ?",
                (now, doc_id),
            )
            conn.commit()
        except Exception:
            pass
        return {"status": "error", "doc_id": doc_id, "error": str(e)}
    finally:
        conn.close()


def _chunk_text(text: str, max_chars: int = 2000) -> list[str]:
    """Split text into chunks by paragraphs."""
    paragraphs = text.split("\n\n")
    chunks = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) + 2 > max_chars and current:
            chunks.append(current.strip())
            current = para
        else:
            current = current + "\n\n" + para if current else para
    if current.strip():
        chunks.append(current.strip())
    return chunks if chunks else [text[:max_chars]]


def _index_doc_images(doc_id, title, image_urls, get_collection, embed_fn):
    """Index document images into multimodal vector collection."""
    import config
    collection = get_collection()

    for i, img_url in enumerate(image_urls):
        relative = img_url.replace("/uploads/", "", 1) if img_url.startswith("/uploads/") else img_url
        img_path = os.path.join(config.UPLOAD_DIR, relative)
        if not os.path.exists(img_path):
            continue

        # Use file:// URL for DashScope local file access
        embedding = embed_fn(
            f"file://{img_path}",
            context_text=f"文档《{title}》中的第{i+1}张图片",
        )
        if not embedding:
            continue

        vec_id = f"{doc_id}_img_{i}"
        metadata = {
            "doc_id": doc_id,
            "title": title,
            "image_url": img_url,
            "image_index": i,
            "entity_type": "doc_image",
        }
        collection.upsert(
            ids=[vec_id],
            embeddings=[embedding],
            documents=[f"文档《{title}》图片{i+1}"],
            metadatas=[metadata],
        )
