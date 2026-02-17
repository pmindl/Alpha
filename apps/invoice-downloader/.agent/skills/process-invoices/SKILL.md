---
name: process-invoices
description: Process invoices from Gmail using the Invoice Processor logic
---

# Invoice Processing Skill

This skill allows you to run the invoice processing logic directly. It scans Gmail for emails matching specific criteria (default: `subject:Antigravity -label:PROCESSED`), extracts invoices using AI, and uploads them to Google Drive.

## Usage

Run the processing script using `tsx`.

### Basic Usage (Default settings)
```bash
npx tsx scripts/process.ts
```

### Custom Query
Process emails matching a custom Gmail query:
```bash
npx tsx scripts/process.ts "subject:Invoice -label:DONE"
```

### Custom Limit
Process a specific number of emails (default is 5):
```bash
npx tsx scripts/process.ts 10
```

### Query and Limit
```bash
npx tsx scripts/process.ts "subject:Invoice" 20
```

## Output
The script outputs a JSON object with:
- `success`: boolean
- `processedCount`: number of emails processed
- `results`: details of each processed email and file
- `fullLogs`: execution logs

## Prerequisites
- `.env.local` must be configured with `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN`.
