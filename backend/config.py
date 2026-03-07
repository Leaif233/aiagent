import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

# API Keys
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")

# Database paths
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "chroma_data")
SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), "metadata.db")

# File storage
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
IMAGE_DIR = os.path.join(UPLOAD_DIR, "images")

# RAG thresholds
CONFIDENCE_THRESHOLD = 0.85
NEAR_MISS_THRESHOLD = 0.15
MAX_CONVERSATION_ROUNDS = 3
MAX_REFINEMENT_ROUNDS = 3
TOP_K_RESULTS = 5

# Embedding model
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# LLM model
LLM_MODEL = "claude-sonnet-4-5-20250929"
LLM_MAX_TOKENS = 2048

# Celery / Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Ensure directories exist
os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)
