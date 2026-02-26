This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

## MCP Server (Agent Integration)

This project exposes a generic Model Context Protocol (MCP) server that allows AI agents to interact with the invoice processing logic.

### Tools Exposed
- `process-pending-invoices`: Process emails matching a query.
- `list-recent-emails`: List recent emails from Gmail.
- `process-specific-email`: Process a single email by ID.
- `get-processing-stats`: specific Get recent logs from the processing system.

### Running with Docker

1. Build the image:
```bash
docker build -t invoice-mcp .
```

2. Run the container (ensure `.env.local` is present):
```bash
docker run -i --env-file .env.local invoice-mcp
```
*Note: The `-i` flag is crucial as the MCP server communicates via Stdio.*

### Running Locally
```bash
npm run mcp
```

