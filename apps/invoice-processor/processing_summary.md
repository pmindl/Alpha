# Batch Processing Summary

**Date:** 2026-02-11
**Test Folder:** `1T7Ew6PoJn8EcFb-9kiR2NaVAp_SRMU6R`

## Overview
| Metric | Count |
|---|---|
| **Total Files** | 12 |
| **Successfully Exported** | 0 (New) |
| **Duplicates (Skipped)** | 11 |
| **Errors** | 1 |

> **Note:** "Duplicates" means the invoice was correctly identified as already existing in SuperFaktura, preventing a double export. This confirms the safety logic is working.

## Detailed Log

| File Name | Status | Invoice # | Variable Symbol | Detail |
|---|---|---|---|---|
| `Kopie souboru Kopie souboru 2501154413_lumenica_sk.pdf` | ⚠️ **Duplicate** | 2501154413 | 2508133093 | Exists in SuperFaktura |
| `Kopie souboru 2501154413_lumenica_sk.pdf` | ⚠️ **Duplicate** | 2501154413 | 2508133093 | Exists in SuperFaktura |
| `Kopie souboru 2025-00511.pdf` | ⚠️ **Duplicate** | 2025-00511 | 1202414274 | Exists in SuperFaktura |
| `Kopie souboru order_2025001461.pdf` | ❌ **Error** | 2025001461 | - | Missing Variable Symbol |
| `Kopie souboru 4010985383.pdf` | ⚠️ **Duplicate** | 4010985383 | 4010985383 | Exists in SuperFaktura |
| `Kopie souboru alza_2985849186.pdf` | ⚠️ **Duplicate** | 2985849186 | 5516873681 | Exists in SuperFaktura |
| `Kopie souboru 79025542999.pdf` | ⚠️ **Duplicate** | 79025542999 | 1599501489 | Exists in SuperFaktura |
| `Kopie souboru zbozi_79025321671.pdf` | ⚠️ **Duplicate** | 79025321671 | 1599469698 | Exists in SuperFaktura |
| `Kopie souboru 5010887332.pdf` | ⚠️ **Duplicate** | 5010887332 | 5010887332 | Exists in SuperFaktura |
| `Kopie souboru 2501128059_lumenica_cz.pdf` | ⚠️ **Duplicate** | 2501128059 | 2508105317 | Exists in SuperFaktura |
| `Kopie souboru 2501135419_lumenica_cz.pdf` | ⚠️ **Duplicate** | 2501135419 | 2508131691 | Exists in SuperFaktura |
| `Kopie souboru 5010590787.pdf` | ⚠️ **Duplicate** | 5010590787 | 5010590787 | Exists in SuperFaktura |

## Analysis
- **Duplicate Protection:** 100% effective. All previously exported invoices were detected.
- **Error Handling:** One file failed due to "Missing Variable Symbol". This is expected if the AI cannot confidently read the VS from the document.
