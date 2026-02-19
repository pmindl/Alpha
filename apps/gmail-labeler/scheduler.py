
from apscheduler.schedulers.blocking import BlockingScheduler
from labeler import Labeler
import logging
import signal
import sys

logger = logging.getLogger("Scheduler")

def job():
    try:
        logger.info("Starting scheduled run...")
        labeler = Labeler(trigger="scheduler")
        labeler.run()
    except Exception as e:
        logger.error(f"Error in scheduled job: {e}")

def run_scheduler():
    scheduler = BlockingScheduler()
    # Run every 10 minutes
    scheduler.add_job(job, 'interval', minutes=10)
    
    logger.info("Scheduler started. Running every 10 minutes.")
    
    # Handle graceful shutdown
    def signal_handler(sig, frame):
        logger.info("Stopping scheduler...")
        scheduler.shutdown(wait=False)
        sys.exit(0)
        
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        pass
