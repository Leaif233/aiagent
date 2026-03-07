import os
import logging
import time
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import config
from db.sqlite_db import init_db
from api.chat import router as chat_router
from api.docs import router as docs_router
from api.tickets import router as tickets_router
from api.admin import router as admin_router
from api.tasks import router as tasks_router
from api.settings import router as settings_router
from api.feedback import router as feedback_router
from api.versions import router as versions_router
from api.sessions import router as sessions_router
from api.auth import router as auth_router

app = FastAPI(title="AI Technical Support System", version="1.0.0")

# Rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("app")

# CORS
_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176")
_allowed_origins = [o.strip() for o in _cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler — prevent stack trace leaks
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", "unknown")
    logger.error("Unhandled error [%s] %s %s: %s",
                 req_id, request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# Request logging middleware
@app.middleware("http")
async def request_logging(request: Request, call_next):
    req_id = uuid.uuid4().hex[:8]
    request.state.request_id = req_id
    start = time.time()
    response = await call_next(request)
    ms = round((time.time() - start) * 1000)
    logger.info("[%s] %s %s → %s (%dms)",
                req_id, request.method, request.url.path, response.status_code, ms)
    return response

# Routers
app.include_router(chat_router)
app.include_router(docs_router)
app.include_router(tickets_router)
app.include_router(admin_router)
app.include_router(tasks_router)
app.include_router(settings_router)
app.include_router(feedback_router)
app.include_router(versions_router)
app.include_router(sessions_router)
app.include_router(auth_router)

# Static files for uploaded images
app.mount("/uploads", StaticFiles(directory=config.UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def startup():
    init_db()
    logger.info("Application started — CORS origins: %s", _allowed_origins)


@app.get("/")
async def root():
    return {"message": "AI Technical Support System API", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
