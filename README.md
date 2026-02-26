# Invoice Processor

Automated invoice processing system using Google Gemini AI and SuperFaktura.

## Features
- **Auto-Ingestion**: Monitors Google Drive for new invoice PDFs.
- **AI Parsing**: Uses Gemini 2.0 Flash to extract data (Supplier, ICO, Variable Symbol, Dates, Line Items).
- **Duplicate Protection**: Robust protection against double-exports using n8n-style logic (Base64 encoded search + custom date filters).
- **SuperFaktura Integration**: Automatically creates expenses/bills in SuperFaktura.
- **Database**: Stores all processed invoices in a local SQLite database (via Prisma).

## Setup

1.  **Clone & Install**
    ```bash
    npm install
    ```

2.  **Database Setup**
    ```bash
    npx prisma generate
    npx prisma db push
    ```

3.  **Environment Variables**
    Create a `.env` file with the following:
    ```env
    # Database
    DATABASE_URL="file:./dev.db"

    # Gemini AI
    GEMINI_API_KEY="your_gemini_key"

    # Google Drive Auth
    GOOGLE_CLIENT_ID="..."
    GOOGLE_CLIENT_SECRET="..."
    GOOGLE_REDIRECT_URI="http://localhost:5678/oauth2callback"
    GOOGLE_REFRESH_TOKEN="..." # Generated via scripts/auth-server.ts

    # SuperFaktura
    SF_API_EMAIL="..."
    SF_API_KEY="..."
    SF_COMPANY_ID="..."
    SF_BASE_URL="https://moje.superfaktura.cz"
    ```

## Usage Scripts

### 1. Manual File Processing
Process a specific local PDF file to test the whole pipeline.
```bash
npx tsx scripts/test-processing.ts <path/to/invoice.pdf>
```

### 2. End-to-End Batch Test
Process the oldest pending invoice from the database and try to export it.
```bash
npx tsx scripts/test-export.ts
```

### 3. Google Drive Integration Tests
1. Run the test script (simulates the entire flow):
   ```bash
   npx tsx scripts/test-e2e.ts
   ```

2. Run Batch Test (Processes all files in GDrive):
   ```bash
   npx tsx scripts/run-batch-test.ts
   ```

## Logging
The system maintains a detailed `ProcessingLog` in the database for every action.
- **Levels**: INFO, WARN, ERROR
- **Sources**: API, BatchProcessor, Gemini, SuperFaktura
- **Content**: Timestamp, Message, JSON Details

You can audit these logs to trace exactly what happened to any invoice file.

### 4. Auth Token Generation
If you need to generate a new Google Refresh Token:
```bash
npx tsx scripts/auth-server.ts
# Open the printed URL in your browser
```

## Duplicate Detection Logic
The system uses a specific logic to prevent duplicates in SuperFaktura:
1.  **Encoding**: The Variable Symbol is Base64 encoded with special character replacements (`+`->`-`, `/`->`_`, `=`->`,`).
2.  **Search**: Queries `/expenses/index.json` with `created:3` and a date range of 2020-2030 to find existing invoices regardless of creation date.
3.  **Prevention**: If a match is found, the export is skipped.

## Deployment
1.  Build the project: `npm run build`
2.  Start the server: `npm start`
