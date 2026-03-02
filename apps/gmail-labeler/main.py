
import argparse
import sys
import json
from labeler import Labeler
from scheduler import run_scheduler
from label_taxonomy import get_taxonomy_dict

def main():
    parser = argparse.ArgumentParser(description="Gmail Labeler Agent")
    parser.add_argument("--mode", choices=[
        "scheduler", "mcp", "manual", "incremental", "test-update", "taxonomy"
    ], default="manual", help="Execution mode")
    parser.add_argument("--days", type=int, help="Lookback window in days (overrides config)")
    parser.add_argument("--limit", type=int, help="Limit number of threads to process")
    parser.add_argument("--force", action="store_true", help="Force rescan of already labeled threads")
    parser.add_argument("--dry-run", action="store_true", help="Log proposed changes without applying them")
    parser.add_argument("--thread-id", type=str, help="Thread ID for test-update mode")
    
    args = parser.parse_args()
    
    if args.mode == "taxonomy":
        print(json.dumps(get_taxonomy_dict(), indent=2))
        return

    # For operational modes, validate config
    from config import Config
    Config.validate()

    if args.mode == "scheduler":
        run_scheduler()
        return

    if args.mode == "incremental":
        labeler = Labeler(trigger="incremental")
        result = labeler.run_incremental(dry_run=args.dry_run)
        print(f"\nIncremental run complete. Scanned {result.get('threads_scanned', 0)} threads.")
        return

    if args.mode == "test-update":
        if not args.thread_id:
            print("❌ --thread-id is required for test-update mode")
            sys.exit(1)
        labeler = Labeler(trigger="test-update")
        result = labeler.test_thread_update(args.thread_id, dry_run=True)
        print(f"\nTest-update complete for thread {args.thread_id}.")
        return

    # Full sweep modes (manual or mcp)
    trigger = "mcp_call" if args.mode == "mcp" else "manual"
    labeler = Labeler(trigger=trigger)
    
    result = labeler.run(
        days_lookback=args.days,
        limit=args.limit,
        force_rescan=args.force,
        dry_run=args.dry_run
    )
    
    if args.mode == "mcp":
        print(json.dumps(result, indent=2))
    elif args.mode == "manual":
        skipped = result.get('threads_skipped', 0)
        modified = result.get('threads_modified', 0)
        prefix = "[DRY-RUN] " if args.dry_run else ""
        print(f"\n{prefix}Run Complete. Scanned {result.get('threads_scanned')} threads. "
              f"Modified: {modified}, Skipped: {skipped}")

if __name__ == "__main__":
    main()
