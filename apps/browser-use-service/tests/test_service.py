import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

# Add parent directory to path to import service and models
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from models import TaskRequest, NavigateRequest
from service import browser_use_service

class MockHistory:
    def __init__(self, success=True, final_res="test result", urls=["http://test.com"]):
        self.success = success
        self.final_res = final_res
        self._urls = urls
        self.structured_output = None
        
    def is_successful(self):
        return self.success
        
    def is_done(self):
        return True
        
    def final_result(self):
        return self.final_res
        
    def urls(self):
        return self._urls
        
    def errors(self):
        return [] if self.success else ["Test error"]

@pytest.fixture
def mock_task_request():
    return TaskRequest(
        task="Test task",
        api_key="test_key",
        llm_provider="openai"
    )

@pytest.mark.asyncio
async def test_start_and_run_task_success(mock_task_request):
    with patch('service.Agent') as MockAgent, \
         patch('service.Browser') as MockBrowser, \
         patch('service.BrowserUseService.get_llm') as mock_get_llm:
         
        # Setup mocks
        mock_agent_instance = MagicMock()
        mock_agent_instance.run = AsyncMock(return_value=MockHistory())
        MockAgent.return_value = mock_agent_instance
        
        # Start task
        status = await browser_use_service.start_task("test_id_1", mock_task_request)
        
        assert status["state"] == "pending"
        
        # Allow the background task to run
        await asyncio.sleep(0.1)
        
        # Check final state
        task_status = browser_use_service.get_task_status("test_id_1")
        assert task_status["state"] == "done"
        assert task_status["result"]["is_successful"] is True
        assert task_status["result"]["final_result"] == "test result"

@pytest.mark.asyncio
async def test_start_and_run_task_failure(mock_task_request):
    with patch('service.Agent') as MockAgent, \
         patch('service.Browser') as MockBrowser, \
         patch('service.BrowserUseService.get_llm') as mock_get_llm:
         
        # Setup mocks to throw Exception
        mock_agent_instance = MagicMock()
        mock_agent_instance.run = AsyncMock(side_effect=Exception("Mocked run error"))
        MockAgent.return_value = mock_agent_instance
        
        # Start task
        status = await browser_use_service.start_task("test_id_2", mock_task_request)
        
        # Let background task run
        await asyncio.sleep(0.1)
        
        task_status = browser_use_service.get_task_status("test_id_2")
        assert task_status["state"] == "error"
        assert task_status["result"]["is_successful"] is False
        assert "Mocked run error" in task_status["result"]["errors"][0]

@pytest.mark.asyncio
async def test_navigate_success():
    req = NavigateRequest(
        url="https://example.com",
        action="click",
        selector="button",
        api_key="test_key"
    )
    with patch('service.Browser') as MockBrowser, \
         patch('service.Page') as MockPage:
         
        mock_page_instance = MagicMock()
        mock_page_instance.goto = AsyncMock()
        mock_page_instance.wait_for_navigation = AsyncMock()
        mock_page_instance.click = AsyncMock()
        MockPage.return_value = mock_page_instance
        
        mock_browser_instance = MagicMock()
        mock_browser_instance.start = AsyncMock()
        mock_browser_instance.kill = AsyncMock()
        MockBrowser.return_value = mock_browser_instance
        
        result = await browser_use_service.navigate(req)
        
        assert result["status"] == "success"
        assert result["action"] == "clicked"
        
        # Ensure cleanup was called
        mock_browser_instance.kill.assert_called_once()
