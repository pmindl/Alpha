# Invoice Downloader (Ingest Node)

Tato aplikace slouží k automatickému sběru faktur z různých zdrojů a jejich ukládání na centrální Google Drive (dle firmy).

## Hlavní funkce
- **Gmail Ingestion**: Sleduje určený label (standardně INBOX) a stahuje přílohy s fakturami.
- **Packeta (Zásilkovna) API**: Přímé stahování PDF faktur z klientského portálu Packety přes REST API.
- **GDrive Routing**: Automatické (nebo AI-driven) třídění faktur do složek firem na Google Drive.

## API Endpointy (pro CRON)
- `GET /api/ingest/email`: Spustí stahování z Gmailu. (Vyžaduje Authorization Bearer token).
- `GET /api/ingest/packeta`: Spustí stahování faktur z Packeta API.

## MCP Server
Vystavuje stejné funkce pro komunikaci s AI agenty (Antigravity):
- `ingest-emails`: Ruční spuštění Gmail stahovače.
- `ingest-packeta`: Ruční spuštění Packeta stahovače.

## Nezávislost
Tato aplikace je zcela oddělena od `invoice-processor`. Zajišťuje pouze "fyzický příjem" souborů. Pokud processor spadne, downloader stále bezpečně sbírá faktury do archivu na GDrive.
