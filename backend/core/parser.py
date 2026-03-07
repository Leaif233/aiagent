import base64
import os
import uuid

import config


def parse_document(file_path: str) -> dict:
    """Parse a document file (PDF/PPT/Docx) into Markdown with images.

    Returns:
        {
            "raw_text": str,
            "cleaned_markdown": str,
            "image_urls": list[str]
        }
    """
    ext = os.path.splitext(file_path)[1].lower()

    # Markdown files: read directly, no need for unstructured
    if ext in (".md", ".markdown"):
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {
            "raw_text": content,
            "cleaned_markdown": content,
            "image_urls": [],
        }

    try:
        from unstructured.partition.auto import partition
        elements = partition(filename=file_path)
    except ImportError:
        return _fallback_parse(file_path)

    raw_parts = []
    markdown_parts = []
    image_urls = []
    image_base64_list = []

    for element in elements:
        text = str(element)
        raw_parts.append(text)

        element_type = type(element).__name__
        if element_type == "Title":
            markdown_parts.append(f"## {text}")
        elif element_type == "NarrativeText":
            markdown_parts.append(text)
        elif element_type == "ListItem":
            markdown_parts.append(f"- {text}")
        elif element_type == "Image":
            img_base64 = getattr(getattr(element, "metadata", None), "image_base64", None)
            if img_base64:
                img_id = uuid.uuid4().hex[:12]
                img_filename = f"{img_id}.png"
                img_path = os.path.join(config.IMAGE_DIR, img_filename)
                img_url = f"/uploads/images/{img_filename}"
                try:
                    with open(img_path, "wb") as img_f:
                        img_f.write(base64.b64decode(img_base64))
                    image_urls.append(img_url)
                    image_base64_list.append({
                        "data": img_base64,
                        "media_type": "image/png",
                    })
                    markdown_parts.append(f"![image]({img_url})")
                except Exception:
                    pass
        else:
            markdown_parts.append(text)

    return {
        "raw_text": "\n".join(raw_parts),
        "cleaned_markdown": "\n\n".join(markdown_parts),
        "image_urls": image_urls,
        "image_base64_list": image_base64_list,
    }


def _fallback_parse(file_path: str) -> dict:
    """Fallback parser when unstructured is not available."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext in (".md", ".markdown"):
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"raw_text": content, "cleaned_markdown": content, "image_urls": []}

    # For other formats without unstructured, return error hint
    return {
        "raw_text": f"[解析失败] 未安装 unstructured 库，无法解析 {ext} 文件",
        "cleaned_markdown": "",
        "image_urls": [],
    }
