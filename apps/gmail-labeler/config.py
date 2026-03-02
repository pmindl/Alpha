
import os
import sys
from dotenv import load_dotenv

# App Mode Detection
# In Vault Mode (run-with-secrets), keys are already in os.environ.
# In Standalone Mode, we need to load from .env or .env.local.

# Try loading .env.local first (common for local dev)
load_dotenv(".env.local")
# Fallback to .env
load_dotenv(".env")

class Config:
    # Google Credentials (Shared with Invoice Processor)
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN")
    
    # Gemini API
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

    # App Config
    DAYS_LOOKBACK = int(os.getenv("DAYS_LOOKBACK", 14))
    
    # Autonomous Runner Config
    INCREMENTAL_INTERVAL_MINUTES = int(os.getenv("INCREMENTAL_INTERVAL_MINUTES", 5))
    FULL_SWEEP_HOUR = int(os.getenv("FULL_SWEEP_HOUR", 3))  # 03:00 daily
    STATE_DB_PATH = os.getenv(
        "STATE_DB_PATH", 
        os.path.join(os.path.dirname(__file__), "data", "labeler_state.db")
    )
    
    @classmethod
    def validate(cls):
        missing = []
        if not cls.GOOGLE_CLIENT_ID: missing.append("GOOGLE_CLIENT_ID")
        if not cls.GOOGLE_CLIENT_SECRET: missing.append("GOOGLE_CLIENT_SECRET")
        if not cls.GOOGLE_REFRESH_TOKEN: missing.append("GOOGLE_REFRESH_TOKEN")
        if not cls.GEMINI_API_KEY: missing.append("GEMINI_API_KEY")
        
        if missing:
            print(f"❌ Critical Error: Missing configuration variables: {', '.join(missing)}")
            print("   Ensure you are running via 'npm run dev' (Vault Mode) or have a valid .env.local (Standalone Mode).")
            sys.exit(1)
