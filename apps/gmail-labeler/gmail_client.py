
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from datetime import datetime, timedelta
import logging
from config import Config

SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

class GmailClient:
    def __init__(self):
        self.creds = Credentials(
            None, # No access token initially
            refresh_token=Config.GOOGLE_REFRESH_TOKEN,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=Config.GOOGLE_CLIENT_ID,
            client_secret=Config.GOOGLE_CLIENT_SECRET,
            scopes=SCOPES
        )
        self.service = build('gmail', 'v1', credentials=self.creds)
        self.logger = logging.getLogger("GmailClient")
        self._label_map_cache = {}

    def get_label_map(self):
        """Returns Name->ID map, cached."""
        if not self._label_map_cache:
            results = self.service.users().labels().list(userId='me').execute()
            self._label_map_cache = {l['name']: l['id'] for l in results.get('labels', [])}
        return self._label_map_cache

    def ensure_labels_exist(self, taxonomy_labels):
        """
        Idempotently create labels from the taxonomy list.
        taxonomy_labels: list of strings like "STATUS/New"
        """
        try:
            results = self.service.users().labels().list(userId='me').execute()
            existing_labels = {l['name']: l['id'] for l in results.get('labels', [])}
            
            created_count = 0
            for label_name in taxonomy_labels:
                if label_name not in existing_labels:
                    try:
                        # Define label color/visibility if needed (simplified here)
                        label_object = {
                            'name': label_name,
                            'labelListVisibility': 'labelShow',
                            'messageListVisibility': 'show'
                        }
                        self.service.users().labels().create(userId='me', body=label_object).execute()
                        created_count += 1
                        print(f"Created label: {label_name}")
                    except HttpError as error:
                        print(f"Error creating label {label_name}: {error}")
                        
            if created_count > 0:
                print(f"✅ Initialized {created_count} new labels.")
                
        except HttpError as error:
            print(f"An error occurred listing labels: {error}")

    def fetch_recent_threads(self, days_lookback=14, limit=None):
        """
        Fetch threads newer than X days that are NOT in DRAFT/ (optional filter).
        We fetch ALL threads in window and let logic filter what needs processing.
        """
        date_threshold = (datetime.now() - timedelta(days=days_lookback)).strftime('%Y/%m/%d')
        query = f"newer_than:{days_lookback}d"
        
        threads = []
        try:
            page_token = None
            while True:
                results = self.service.users().threads().list(
                    userId='me', 
                    q=query, 
                    pageToken=page_token
                ).execute()
                
                batch = results.get('threads', [])
                threads.extend(batch)
                
                if limit and len(threads) >= limit:
                    threads = threads[:limit]
                    break
                    
                page_token = results.get('nextPageToken')
                if not page_token:
                    break
                    
        except HttpError as error:
            self.logger.error(f"An error occurred fetching threads: {error}")
            
        return threads

    def get_thread_details(self, thread_id):
        """Get full thread with messages."""
        try:
            thread = self.service.users().threads().get(userId='me', id=thread_id, format='full').execute()
            return thread
        except HttpError as error:
            self.logger.error(f"Error fetching thread {thread_id}: {error}")
            return None

    def modify_thread_labels(self, thread_id, add_labels, remove_labels):
        """Add and remove labels (by Name)."""
        if not add_labels and not remove_labels:
            return

        label_map = self.get_label_map()
        
        add_ids = []
        for name in add_labels:
            if name in label_map:
                add_ids.append(label_map[name])
            else:
                self.logger.warning(f"Label '{name}' not found in map, skipping apply.")
                
        remove_ids = []
        for name in remove_labels:
            if name in label_map:
                remove_ids.append(label_map[name])
            else:
                self.logger.warning(f"Label '{name}' to remove not found in map.")
                
        if not add_ids and not remove_ids:
            return

        body = {
            'addLabelIds': add_ids,
            'removeLabelIds': remove_ids
        }
        
        try:
            self.service.users().threads().modify(userId='me', id=thread_id, body=body).execute()
        except HttpError as error:
            self.logger.error(f"Error modifying labels for thread {thread_id}: {error}")

    def _get_label_map(self):
        """Internal helper, use get_label_map instead."""
        return self.get_label_map()
