import logging
import signal
import sys
import threading
from apscheduler.schedulers.blocking import BlockingScheduler
from labeler import Labeler
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

def job():
    try:
        logger.info("Starting scheduled run...")
        labeler = Labeler(trigger="scheduler")
        labeler.run()
    except Exception as e:
        logger.error(f"Error in scheduled job: {e}")

def run_scheduler():
    health_thread = threading.Thread(target=run_health_server, daemon=True)
    health_thread.start()
    
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
