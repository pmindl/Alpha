
from google import genai
import json
import logging
from config import Config
from pydantic import BaseModel, Field
from typing import Optional
from label_taxonomy import TAXONOMY, get_taxonomy_for_prompt

# Setup logger
logger = logging.getLogger("GeminiClient")

# Pydantic model for validation
class ClassificationResult(BaseModel):
    status: str
    type: str
    finance: Optional[str] = None
    action: str
    priority: str
    reason: str


def _build_system_prompt():
    """Build the system prompt with dynamically injected taxonomy values."""
    taxonomy_block = get_taxonomy_for_prompt()
    return f"""You are an email classification assistant for an e-commerce store management team.
You analyze email threads and classify them using a predefined label taxonomy.

You must return ONLY valid JSON. No explanation, no markdown, no preamble.

ALLOWED LABEL VALUES (you MUST use ONLY these exact values):
{taxonomy_block}

Your output must follow this exact schema:
{{
  "status": "<one of: {' | '.join(TAXONOMY['STATUS'])}>",
  "type": "<one of: {' | '.join(TAXONOMY['TYPE'])}>",
  "finance": "<one of: {' | '.join(TAXONOMY['FINANCE'])}, or null if not applicable>",
  "action": "<one of: {' | '.join(TAXONOMY['ACTION'])}>",
  "priority": "<one of: {' | '.join(TAXONOMY['PRIORITY'])}>",
  "reason": "<brief English explanation of classification decisions, max 2 sentences>"
}}

Rules:
- IMPORTANT: Use ONLY the exact label values listed above. Do NOT invent new labels.
- Read ALL messages in the thread before deciding
- If the last message is from us (the store), set status to Waiting-for-reply
- If the thread shows resolution or a closed matter, set status to Closed
- If there are signs of legal threats, aggression, or overdue financial demands, set priority to Urgent
- For FINANCE emails, always set an appropriate FINANCE label
- ACTION/Prepare-reply means the LLM draft agent will write a response
- ACTION/Escalate means a human must handle this — do not use Prepare-reply together with Escalate
"""


def _build_update_system_prompt():
    """Build the update system prompt with dynamically injected taxonomy values."""
    taxonomy_block = get_taxonomy_for_prompt()
    return f"""You are an email classification assistant for an e-commerce store management team.
An email thread was previously classified. A new message has arrived in this thread.
Based on the new message and the existing labels, decide if the classification should change.

You must return ONLY valid JSON with the same schema as the original classification.
If the labels should stay the same, return the existing values. Only change what's needed.

ALLOWED LABEL VALUES (you MUST use ONLY these exact values):
{taxonomy_block}

Schema:
{{
  "status": "<one of: {' | '.join(TAXONOMY['STATUS'])}>",
  "type": "<one of: {' | '.join(TAXONOMY['TYPE'])}>",
  "finance": "<one of: {' | '.join(TAXONOMY['FINANCE'])}, or null if not applicable>",
  "action": "<one of: {' | '.join(TAXONOMY['ACTION'])}>",
  "priority": "<one of: {' | '.join(TAXONOMY['PRIORITY'])}>",
  "reason": "<brief explanation of what changed or why labels stay the same>"
}}

IMPORTANT: Use ONLY the exact label values listed above. Do NOT invent new labels.
"""


class GeminiClient:
    def __init__(self):
        if not Config.GEMINI_API_KEY:
            logger.error("Gemini API Key missing")
            raise ValueError("GEMINI_API_KEY is not set")
            
        self.client = genai.Client(api_key=Config.GEMINI_API_KEY)
        self.model_name = "gemini-2.0-flash"
        
        # Build prompts dynamically from taxonomy
        self.system_prompt = _build_system_prompt()
        self.update_system_prompt = _build_update_system_prompt()

    def _parse_response(self, text):
        """Parse and validate LLM JSON response."""
        # Clean markdown code blocks if present
        if text.startswith("```json"):
            text = text.replace("```json", "").replace("```", "")
        elif text.startswith("```"):
            text = text.replace("```", "")

        data = json.loads(text.strip())
        validated = ClassificationResult.model_validate(data)
        return validated.model_dump()

    def classify_thread(self, subject, message_count, thread_text):
        """
        Full thread classification. Sends entire thread context to Gemini.
        """
        user_prompt = f"""Classify the following email thread:

Subject: {subject}
Number of messages: {message_count}

--- THREAD START ---
{thread_text}
--- THREAD END ---

Return only JSON."""

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=user_prompt,
                config={
                    "system_instruction": self.system_prompt,
                }
            )
            
            usage = getattr(response, 'usage_metadata', None)
            tokens = {
                "prompt_tokens": usage.prompt_token_count if usage else 0,
                "completion_tokens": usage.candidates_token_count if usage else 0
            }
            
            return self._parse_response(response.text), tokens
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from Gemini: {e}")
            return None, None
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return None, None

    def classify_thread_update(self, subject, new_message_text, current_labels):
        """
        Minimal update classification. Only sends the new message + existing labels.
        Much more token-efficient than re-classifying the entire thread.
        """
        labels_str = ", ".join(current_labels)
        
        user_prompt = f"""A new message arrived in this thread:

Subject: {subject}
Current labels: [{labels_str}]

--- NEW MESSAGE ---
{new_message_text}
--- END ---

Should the classification change? Return the full JSON (updated or same)."""

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=user_prompt,
                config={
                    "system_instruction": self.update_system_prompt,
                }
            )
            
            usage = getattr(response, 'usage_metadata', None)
            tokens = {
                "prompt_tokens": usage.prompt_token_count if usage else 0,
                "completion_tokens": usage.candidates_token_count if usage else 0
            }
            
            return self._parse_response(response.text), tokens
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from Gemini (update): {e}")
            return None, None
        except Exception as e:
            logger.error(f"Gemini API error (update): {e}")
            return None, None
