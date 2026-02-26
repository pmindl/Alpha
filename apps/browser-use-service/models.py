from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union

class TaskRequest(BaseModel):
    task: str
    max_steps: int = 100
    allowed_domains: Optional[List[str]] = None
    output_schema: Optional[Dict[str, Any]] = None
    llm_provider: str = "openai" # "openai" or "anthropic"
    api_key: str
    headless: bool = True

class TaskStatusResponse(BaseModel):
    task_id: str
    state: str # "pending", "running", "done", "error"
    progress: Optional[str] = None

class TaskResultResponse(BaseModel):
    task_id: str
    is_successful: bool
    final_result: Optional[str] = None
    structured_output: Optional[Any] = None
    urls: List[str] = []
    errors: List[str] = []

class ExtractRequest(BaseModel):
    url: str
    extraction_prompt: str
    output_schema: Dict[str, Any]
    llm_provider: str = "openai"
    api_key: str
    headless: bool = True

class NavigateRequest(BaseModel):
    url: str
    action: Optional[str] = None # 'click', 'fill', 'screenshot'
    selector: Optional[str] = None
    text: Optional[str] = None
    headless: bool = True
