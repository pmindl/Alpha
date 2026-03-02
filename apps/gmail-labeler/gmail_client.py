
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from datetime import datetime, timedelta
import logging
from config import Config
from label_taxonomy import get_full_label_list

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
        self._managed_label_ids = None

    def get_label_map(self):
        """Returns Name->ID map, cached."""
        if not self._label_map_cache:
            results = self.service.users().labels().list(userId='me').execute()
            self._label_map_cache = {l['name']: l['id'] for l in results.get('labels', [])}
        return self._label_map_cache

    def get_managed_label_ids(self):
        """Returns set of label IDs that belong to our taxonomy."""
        if self._managed_label_ids is None:
            label_map = self.get_label_map()
            taxonomy_names = set(get_full_label_list())
            self._managed_label_ids = {
                label_map[name] for name in taxonomy_names if name in label_map
            }
        return self._managed_label_ids

    def get_current_history_id(self):
        """Get current historyId from Gmail profile."""
        try:
            profile = self.service.users().getProfile(userId='me').execute()
            return profile.get('historyId')
        except HttpError as error:
            self.logger.error(f"Error getting profile/historyId: {error}")
            return None

    def fetch_changed_threads_since(self, history_id):
        """
        Use Gmail history.list to find threads that changed since history_id.
        Returns a list of unique thread IDs.
        """
        changed_thread_ids = set()
        try:
            page_token = None
            while True:
                results = self.service.users().history().list(
                    userId='me',
                    startHistoryId=history_id,
                    historyTypes=['messageAdded', 'labelAdded', 'labelRemoved'],
                    pageToken=page_token
                ).execute()

                for record in results.get('history', []):
                    # messagesAdded contains new messages with threadId
                    for msg_added in record.get('messagesAdded', []):
                        tid = msg_added.get('message', {}).get('threadId')
                        if tid:
                            changed_thread_ids.add(tid)
                    # Also check labelsAdded/labelsRemoved for thread changes
                    for msg_changed in record.get('labelsAdded', []) + record.get('labelsRemoved', []):
                        tid = msg_changed.get('message', {}).get('threadId')
                        if tid:
                            changed_thread_ids.add(tid)

                page_token = results.get('nextPageToken')
                if not page_token:
                    break

        except HttpError as error:
            if error.resp.status == 404:
                # historyId is too old, Gmail purged it. Need full sweep.
                self.logger.warning(f"History ID {history_id} expired (404). Full sweep needed.")
                return None  # Signal caller to do full sweep
            self.logger.error(f"Error fetching history: {error}")
            return None

        return list(changed_thread_ids)

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
                # Invalidate cache since we created new labels
                self._label_map_cache = {}
                self._managed_label_ids = None
                
        except HttpError as error:
            print(f"An error occurred listing labels: {error}")

    def fetch_recent_threads(self, days_lookback=14, limit=None):
        """
        Fetch threads newer than X days.
        """
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

