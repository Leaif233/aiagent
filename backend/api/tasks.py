from fastapi import APIRouter, HTTPException, Depends

from tasks.celery_app import celery_app

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/{task_id}")
async def get_task_status(task_id: str):
    """Check async task status by Celery task ID."""
    result = celery_app.AsyncResult(task_id)

    response = {
        "task_id": task_id,
        "state": result.state,
    }

    if result.ready():
        response["result"] = result.result
    elif result.state == "FAILURE":
        response["error"] = str(result.info)

    return response
