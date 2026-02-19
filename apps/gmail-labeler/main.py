
import argparse
import sys
import json
from labeler import Labeler
from scheduler import run_scheduler
from label_taxonomy import get_taxonomy_dict
# Config loaded on import

def main():
    parser = argparse.ArgumentParser(description="Gmail Labeler Agent")
    parser.add_argument("--mode", choices=["scheduler", "mcp", "manual", "taxonomy"], default="manual", help="Execution mode")
    parser.add_argument("--days", type=int, help="Lookback window in days (overrides config)")
    parser.add_argument("--limit", type=int, help="Limit number of threads to process")
    parser.add_argument("--force", action="store_true", help="Force rescan of already labeled threads")
    
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

    # One-off modes (manual or mcp)
    trigger = "mcp_call" if args.mode == "mcp" else "manual"
    labeler = Labeler(trigger=trigger)
    
    result = labeler.run(
        days_lookback=args.days,
        limit=args.limit,
        force_rescan=args.force
    )
    
    # If MCP mode, print JSON to stdout for the wrapper to capture
    if args.mode == "mcp":
        print(json.dumps(result, indent=2))
    elif args.mode == "manual":
        # In manual mode, logger already printed to console, but let's print a summary
        print(f"\nRun Complete. Processed {result.get('threads_scanned')} threads.")

if __name__ == "__main__":
    main()
