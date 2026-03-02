# Gmail Email Labeler

A robust, production-grade Python application that automatically categorizes and labels emails using the Gmail API and the Gemini inference engine (Gemini 2.0 Flash). It processes inbox threads and maps them to a centralized taxonomy (e.g., `STATUS/New`, `TYPE/Marketing`, `FINANCE/Invoice`).

## How It Works

The sub-app operates on a highly optimized, state-aware loop:
1. **Google Auth Layer**: Utilizing a shared Dual-Mode Credential Layer (`@alpha/google-auth`), it retrieves the master refresh token from the encrypted vault via `run-with-secrets.js` and silently negotiates fresh OAuth access tokens without any manual intervention.
2. **State & Incremental Sync (`state.py`)**: To eliminate redundant LLM calls, the app maintains a local SQLite database (`labeler_state.db`). It tracks the exact `historyId` cursor of the Gmail mailbox. On incremental runs, it asks Gmail *only* for threads that have changed since the last execution.
3. **Smart Classification (`gemini_client.py`)**: 
   - **Full Sweep**: Sends the whole thread context to Gemini to categorize.
   - **Incremental Updates**: If an existing cached thread gets a new message, the app only sends the *new message* alongside the existing labels to Gemini. This drastically reduces prompt tokens.
4. **Token & Cost Tracking**: For every LLM interaction, the app extracts the `usage_metadata` (prompt tokens and completion tokens) from the Gemini API. It calculates the EXACT USD cost (based on Google's $0.10/1M input, $0.40/1M output pricing) and aggregates this data historically in the SQLite database.

## Architecture

- **Core Engine**: Python 3.11+
- **Database**: SQLite (`data/labeler_state.db`) for caching threads and tracking financial token costs.
- **LLM**: Google Gemini (`gemini-2.0-flash`) via `google-genai` SDK.
- **Credential Storage**: Alpha Encrypted Vault (`run-with-secrets.js`), with a fallback to standalone `.env.local` for local development.

## Features

- **Automated Labeling**: Classifies threads into STATUS, TYPE, FINANCE, ACTION, and PRIORITY categories.
- **Dual Runtime Modes**: 
    - **Incremental Scheduler**: Runs periodically, checking only modified threads via `historyId`.
    - **Full Sweep (Manual/Cron)**: Forces a full 14-day chronological lookback to ensure zero drift.
- **Idempotent Application**: Before hitting the Gmail API, it runs a diff to calculate what labels actually changed. If identical, it skips network requests entirely.
- **Micro-Cost Economics**: Logs total USD cost spent per execution straight to the terminal and database.

## Configuration

The app expects the following environment variables (automatically injected by the Vault):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GEMINI_API_KEY`

## Installation & Usage

### 1. Install Dependencies
```bash
# In apps/gmail-labeler/
pip install -r requirements.txt
npm install
```

### 2. Run Locally (Vault Mode)
```bash
# Via the secure runner at the root of the Monorepo:
node ../../scripts/run-with-secrets.js gmail-labeler python -X utf8 main.py --mode manual --days 14 --limit 50
```

### 3. Run Standalone (Dev Mode)
Create a `.env.local` file in `apps/gmail-labeler/`.
```bash
python main.py --mode manual
```

## Logging & Auditing

Logs are emitted to `logs/runs/{DATE}/{UUID}.[json|txt]`.
- **JSON**: Machine-readable full execution report with strict metadata.
- **TXT**: Human-readable summary detailing EXACT costs, thread identifiers, labels applied, and Gemini's semantic reasoning for its decision.
