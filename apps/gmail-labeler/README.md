
# Gmail Email Labeler

A Python-based application that automatically analyzes and labels emails from the last 14 days using Gmail API and Gemini AI. It runs both on a schedule and on-demand via MCP server calls.

## Features

- **Automated Labeling**: Classifies threads into STATUS, TYPE, FINANCE, ACTION, and PRIORITY categories.
- **Dual Mode**: 
    - **Scheduler**: Runs periodically (every 10 minutes) to keep inbox organized.
    - **MCP Tool**: Can be triggered by LLM agents to scan specific threads or perform ad-hoc runs.
- **Smart Logic**:
    - Updates labels based on new messages.
    - Respects manual overrides (doesn't overwrite "Closed" status if valid).
    - Idempotent label creation.
    - "Waiting for reply" detection.

## Architecture

- **Core**: Python 3.11+
- **MCP Interface**: Node.js wrapper (`src/mcp-server.ts`) using `@modelcontextprotocol/sdk`.
- **Secrets**: Integrated with Alpha Vault (`run-with-secrets.js`) using shared `GOOGLE_*` credentials.

## Configuration

The app requires the following environment variables (automatically injected in Vault Mode):

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GEMINI_API_KEY`
- `DAYS_LOOKBACK` (Optional, default 14)

## Installation & Usage

### 1. Install Dependencies
```bash
# In apps/gmail-labeler/
pip install -r requirements.txt
npm install
```

### 2. Run Locally (Vault Mode)
```bash
# From root
npm run dev --workspace=apps/gmail-labeler
# Or
npm run mcp --workspace=apps/gmail-labeler
```

### 3. Run Standalone (Dev Mode)
Create a `.env.local` file in `apps/gmail-labeler/` with the required credentials.
```bash
python main.py --mode manual
# Or 
python main.py --mode scheduler
```

### 4. CLI Options
```bash
python main.py --help
# usage: main.py [-h] [--mode {scheduler,mcp,manual,taxonomy}] [--days DAYS] [--limit LIMIT] [--force]
```

## Logging

Logs are stored in `logs/runs/{DATE}/{UUID}.[json|txt]`.

- **JSON**: Machine-readable full execution report.
- **TXT**: Human-readable summary of actions taken.
