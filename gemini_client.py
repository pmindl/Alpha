
import google.generativeai as genai
import json
import logging
from config import Config
from pydantic import BaseModel, Field
from typing import Optional

# Setup logger
logger = logging.getLogger("GeminiClient")

# Pydantic model for validation (Optional but good for documentation of expectation)
class ClassificationResult(BaseModel):
    status: str
    type: str
    finance: Optional[str] = None
    action: str
    priority: str
    reason: str

SYSTEM_PROMPT = """You are an email classification assistant for an e-commerce store management team.
You analyze email threads and classify them using a predefined label taxonomy.

You must return ONLY valid JSON. No explanation, no markdown, no preamble.

Your output must follow this exact schema:
{
  "status": "<one of: New | Processed | Waiting-for-reply | Closed>",
  "type": "<one of the TYPE/ values without prefix>",
  "finance": "<one of the FINANCE/ values without prefix, or null if not applicable>",
  "action": "<one of the ACTION/ values without prefix>",
  "priority": "<one of: Urgent | Normal | Low>",
  "reason": "<brief English explanation of classification decisions, max 2 sentences>"
}

Rules:
- Read ALL messages in the thread before deciding
- If the last message is from us (the store), set status to Waiting-for-reply
- If the thread shows resolution or a closed matter, set status to Closed
- If there are signs of legal threats, aggression, or overdue financial demands, set priority to Urgent
- For FINANCE emails, always set an appropriate FINANCE label
- ACTION/Prepare-reply means the LLM draft agent will write a response
- ACTION/Escalate means a human must handle this — do not use Prepare-reply together with Escalate
"""

class GeminiClient:
    def __init__(self):
        if not Config.GEMINI_API_KEY:
            logger.error("Gemini API Key missing")
            raise ValueError("GEMINI_API_KEY is not set")
            
        genai.configure(api_key=Config.GEMINI_API_KEY)
        self.model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=SYSTEM_PROMPT
        )

    def classify_thread(self, subject, message_count, thread_text):
        """
        Sends thread context to Gemini and validates response.
        """
        user_prompt = f"""Classify the following email thread:

Subject: {subject}
Number of messages: {message_count}

--- THREAD START ---
{thread_text}
--- THREAD END ---

Return only JSON."""

        try:
            # Generate content
            response = self.model.generate_content(user_prompt)
            text = response.text
            
            # Clean markdown code blocks if present
            if text.startswith("```json"):
                text = text.replace("```json", "").replace("```", "")
            elif text.startswith("```"):
                text = text.replace("```", "")

            data = json.loads(text.strip())
            
            # Basic schema validation via Pydantic
            # (We use .model_validate only if we want strict typing failure, 
            # here we just want to ensure it's a dict that looks right)
            # But let's use pydantic for safety
            validated = ClassificationResult.model_validate(data)
            
            return validated.model_dump()
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from Gemini: {e}")
            logger.debug(f"Raw response: {text}")
            return None
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return None
