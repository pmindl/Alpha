# Customer Responder

The Customer Responder is an automated system that monitors a designated Gmail inbox, extracts order numbers and entities from incoming customer emails, queries WooCommerce for context, uses a Retrieval-Augmented Generation (RAG) system with LanceDB to fetch knowledge base articles, and generates automatic responses via the Gemini API as drafts in Gmail.

## Application Architecture
1.  **Ingestion & Classification:** Fetches latest unread emails. Uses AI to assign intent (e.g., "Order Inquiry", "Supplier", "Finance") and priority.
2.  **Entity Extraction:** Extracts exact order IDs, tracking links, and named entities (names, companies).
3.  **Context Assembly:** Queries WooCommerce for those order IDs to fetch product states and shipment data.
4.  **RAG / Knowledge Retrieval:** Uses an embedded local **LanceDB** database to find internal FAQ/Standard Operating Procedure knowledge snippets matching the email's intent.
5.  **Drafting:** Uses Gemini to synthesize an answer based strictly on WooCommerce facts and the Knowledge Base, saving it directly into Gmail as a draft in the same thread.

---

## 🚀 RAG (Knowledge Base) Management

The embedded RAG database uses [LanceDB](https://lancedb.com/), a local vector database. 

### Where is the data?
By default, the application is configured to read its knowledge base directly from the GitHub repository at:
`apps/customer-responder/data/lancedb`

Because the RAG dataset is relatively small and deterministic, **it is version-controlled via Git.** This guarantees that updates to the knowledge base deploy atomically with code changes, and rolling back a bad deployment also rolls back the corresponding knowledge base version.

### How to update the knowledge base:
1. Navigate to the local ingestor folder (currently external to this repo at `..\..\knowledge-ingestor`).
2. Add, edit, or remove your source documents (PDFs, DOCs, TXT) in the `documents/` folder.
3. Run the ingestor app (`npm start` inside the `knowledge-ingestor` folder) to rebuild the `data/lancedb` database.
4. Copy the entire updated `data/lancedb/` folder over to your monorepo at `Alpha/apps/customer-responder/data/lancedb` replacing the old one.
5. Commit the changes and push to GitHub:
   ```bash
   git add apps/customer-responder/data/lancedb
   git commit -m "docs(rag): update knowledge base with new shipping policies"
   git push origin master
   ```
6. The Coolify pipeline will automatically fetch the new database, package it into the Docker container (`node:20-slim`), and restart the service seamlessly.

### Alternative (Advanced) Setup for Coolify: Docker Volumes
If in the future the database becomes too large to store in Git (hundreds of megabytes), you can switch to a mapped volume:
1. In Coolify, go to the **Storage** tab for this application.
2. Map a Persistent Volume to `/app/apps/customer-responder/data`.
3. Set an environment variable in Coolify `LANCEDB_URI=/app/apps/customer-responder/data/lancedb`
4. You will then manually `scp` or `rsync` your local built database directory directly into the Coolify server's Docker volume.

_Note: For now, tracking it in `git` is faster, easier to debug, and automatically links your documentation version to your application code version._
