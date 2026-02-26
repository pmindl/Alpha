import uuid
from fastapi import FastAPI, HTTPException
import uvicorn

from models import TaskRequest, TaskStatusResponse, TaskResultResponse, ExtractRequest, NavigateRequest
from service import browser_use_service

app = FastAPI(title="Browser Use API Service")

@app.post("/task", response_model=TaskStatusResponse)
async def create_task(request: TaskRequest):
    task_id = str(uuid.uuid4())
    status = await browser_use_service.start_task(task_id, request)
    return TaskStatusResponse(task_id=task_id, state=status["state"])

@app.get("/task/{task_id}", response_model=TaskStatusResponse)
async def get_task(task_id: str):
    status = browser_use_service.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskStatusResponse(task_id=task_id, state=status["state"])

@app.get("/task/{task_id}/result", response_model=TaskResultResponse)
async def get_task_result(task_id: str):
    status = browser_use_service.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found")
    
    result = status.get("result")
    if not result:
        # Not finished yet
        return TaskResultResponse(
            task_id=task_id, 
            is_successful=False,
            errors=["Task is still running or pending"]
        )
        
    return TaskResultResponse(
        task_id=task_id,
        is_successful=result.get("is_successful", False),
        final_result=result.get("final_result"),
        structured_output=result.get("structured_output"),
        urls=result.get("urls", []),
        errors=result.get("errors", [])
    )

@app.post("/actor/navigate")
async def navigate(request: NavigateRequest):
    try:
        return await browser_use_service.navigate(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/actor/extract")
async def extract(request: ExtractRequest):
    try:
        return await browser_use_service.extract_content(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3324, reload=True)
