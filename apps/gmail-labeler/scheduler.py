import logging
import signal
import sys
import threading
from apscheduler.schedulers.blocking import BlockingScheduler
from labeler import Labeler
from config import Config
from http.server import HTTPServer, BaseHTTPRequestHandler

logger = logging.getLogger("Scheduler")

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200)
        self.end_headers()
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"OK")
    def log_message(self, format, *args):
        pass

def run_health_server():
    server = HTTPServer(('localhost', 3003), HealthCheckHandler)
    server.serve_forever()

def incremental_job():
    """Runs every few minutes — checks only changed threads."""
    try:
        logger.info("Starting INCREMENTAL scheduled run...")
        labeler = Labeler(trigger="scheduler-incremental")
        labeler.run_incremental()
    except Exception as e:
        logger.error(f"Error in incremental job: {e}")

def full_sweep_job():
    """Runs daily — catches anything missed by incremental sync."""
    try:
        logger.info("Starting FULL SWEEP scheduled run...")
        labeler = Labeler(trigger="scheduler-sweep")
        labeler.run_full_sweep()
    except Exception as e:
        logger.error(f"Error in full sweep job: {e}")

def run_scheduler():
    # Start health check server
    health_thread = threading.Thread(target=run_health_server, daemon=True)
    health_thread.start()
    
    scheduler = BlockingScheduler()
    
    # Incremental job: every N minutes (default 5)
    scheduler.add_job(
        incremental_job, 'interval', 
        minutes=Config.INCREMENTAL_INTERVAL_MINUTES,
        id='incremental_job',
        name='Incremental Sync'
    )
    
    # Full sweep: daily at configured hour (default 03:00)
    scheduler.add_job(
        full_sweep_job, 'cron', 
        hour=Config.FULL_SWEEP_HOUR,
        id='full_sweep_job',
        name='Daily Full Sweep'
    )
    
    # Run an initial incremental check on startup
    scheduler.add_job(
        incremental_job, 'date',
        id='startup_check',
        name='Startup Check'
    )
    
    logger.info(
        f"Scheduler started. "
        f"Incremental: every {Config.INCREMENTAL_INTERVAL_MINUTES} min | "
        f"Full sweep: daily at {Config.FULL_SWEEP_HOUR}:00"
    )
    
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
