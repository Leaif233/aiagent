from celery import Celery

import config

celery_app = Celery(
    "ai_support",
    broker=config.REDIS_URL,
    backend=config.REDIS_URL,
    include=[
        "tasks.doc_tasks",
        "tasks.ticket_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
)
