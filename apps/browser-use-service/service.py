import asyncio
from typing import Dict, Any, Optional
from browser_use import Agent, Browser, BrowserConfig
from browser_use.actor import Page
from pydantic import BaseModel, create_model

class BrowserUseService:
    def __init__(self):
        self.tasks: Dict[str, Any] = {}

    def get_llm(self, provider: str, api_key: str):
        if provider == "openai":
            from browser_use.agent.llm import ChatOpenAI
            return ChatOpenAI(api_key=api_key, model="gpt-4o")
        elif provider == "anthropic":
            from browser_use.agent.llm import ChatAnthropic
            return ChatAnthropic(api_key=api_key, model="claude-3-5-sonnet-20241022")
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")

    def create_pydantic_model_from_schema(self, schema: Dict[str, Any], model_name: str = "DynamicModel") -> type[BaseModel]:
        # Very basic conversion from JSON schema to Pydantic model for dynamic structures
        fields = {}
        properties = schema.get("properties", {})
        required = schema.get("required", [])
        
        for k, v in properties.items():
            field_type = str
            if v.get("type") == "integer":
                field_type = int
            elif v.get("type") == "number":
                field_type = float
            elif v.get("type") == "boolean":
                field_type = bool
            elif v.get("type") == "array":
                field_type = list
            # Note: This is a simplified dynamic typing and doesn't handle nested objects well.
            # In a real scenario we'd use a more robust schema-to-pydantic converter.
            
            if k in required:
                fields[k] = (field_type, ...)
            else:
                fields[k] = (Optional[field_type], None)
                
        return create_model(model_name, **fields)

    async def run_task(self, task_id: str, request: Any):
        try:
            self.tasks[task_id]["state"] = "running"
            
            llm = self.get_llm(request.llm_provider, request.api_key)
            
            browser_args = {"headless": request.headless}
            if request.allowed_domains:
                # Browser object configuration doesn't accept it directly in some versions,
                # checking if we pass it via BrowserConfig or directly
                # For safety, let's keep it simple for now or we wait for context7 snippet info.
                pass
                
            browser = Browser(config=BrowserConfig(headless=request.headless))
            
            output_schema_model = None
            if request.output_schema:
                try:
                    output_schema_model = self.create_pydantic_model_from_schema(request.output_schema)
                except Exception as e:
                    print(f"Failed to create Pydantic model: {e}")

            agent = Agent(
                task=request.task,
                llm=llm,
                browser=browser,
                output_model_schema=output_schema_model
            )
            
            history = await agent.run(max_steps=request.max_steps)
            
            self.tasks[task_id]["state"] = "done"
            # Get the result from history
            is_success = history.is_successful()
            if is_success is None:
                is_success = history.is_done()
                
            self.tasks[task_id]["result"] = {
                "is_successful": bool(is_success),
                "final_result": history.final_result(),
                "structured_output": getattr(history, 'structured_output', None),
                "urls": history.urls() if hasattr(history, 'urls') else [],
                "errors": history.errors() if hasattr(history, 'errors') else [],
            }
            
            # Clean up browser
            if hasattr(browser, 'close'):
                await browser.close()
                pass
                
        except Exception as e:
            self.tasks[task_id]["state"] = "error"
            self.tasks[task_id]["result"] = {
                "is_successful": False,
                "errors": [str(e)],
            }
            print(f"Task {task_id} failed: {e}")

    async def start_task(self, task_id: str, request: Any):
        self.tasks[task_id] = {"state": "pending", "result": None}
        asyncio.create_task(self.run_task(task_id, request))
        return self.tasks[task_id]

    def get_task_status(self, task_id: str):
        return self.tasks.get(task_id)

    async def extract_content(self, request: Any) -> Any:
        llm = self.get_llm(request.llm_provider, request.api_key)
        browser = Browser(config=BrowserConfig(headless=request.headless))
        
        output_schema_model = self.create_pydantic_model_from_schema(request.output_schema, "ExtractModel")
        
        try:
            # We initialize a session to use the page API
            await browser.start()
            page = Page(browser_session=browser, target_id=browser.get_current_tab_id())
            await page.goto(request.url)
            await page.wait_for_navigation()
            
            result = await page.extract_content(
                request.extraction_prompt,
                output_schema_model,
                llm=llm
            )
            return result.model_dump() if hasattr(result, "model_dump") else result
        finally:
            await browser.kill()
            
    async def navigate(self, request: Any) -> Dict[str, Any]:
        browser = Browser(config=BrowserConfig(headless=request.headless))
        try:
            await browser.start()
            page = Page(browser_session=browser, target_id=browser.get_current_tab_id())
            await page.goto(request.url)
            await page.wait_for_navigation()
            
            result = {"status": "success", "url": request.url}
            
            if request.action == "click" and request.selector:
                await page.click(request.selector)
                result["action"] = "clicked"
            elif request.action == "fill" and request.selector and request.text:
                await page.type(request.selector, request.text)
                result["action"] = "filled"
            elif request.action == "screenshot":
                screenshot = await page.screenshot()
                result["screenshot"] = screenshot # Depending on size, might want to be careful returning this directly
                
            return result
        finally:
            await browser.kill()

browser_use_service = BrowserUseService()
