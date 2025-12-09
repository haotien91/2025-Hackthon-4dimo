from __future__ import annotations

import os
import threading
import time
from typing import Any, Dict, List, Optional

import orjson

from .config import USERDATA_JSON_PATH


class UserDataStore:
	"""Thread-safe user data store for passport and favourite events."""
	
	def __init__(self, json_path: Optional[str] = None) -> None:
		self._json_path: str = json_path or USERDATA_JSON_PATH
		self._lock = threading.Lock()
		self._data: Dict[str, Dict[str, Any]] = {"users": {}}
		self._ensure_file_exists()
		self._load_file()
	
	def _ensure_file_exists(self) -> None:
		if not os.path.exists(self._json_path):
			os.makedirs(os.path.dirname(self._json_path), exist_ok=True)
			with open(self._json_path, "wb") as f:
				f.write(orjson.dumps({"users": {}}, option=orjson.OPT_INDENT_2))
	
	def _load_file(self) -> None:
		try:
			with open(self._json_path, "rb") as f:
				data = orjson.loads(f.read())
			if not isinstance(data, dict) or "users" not in data:
				raise ValueError("Invalid userdata.json format")
			self._data = data
		except (FileNotFoundError, ValueError):
			self._data = {"users": {}}
			self._save_file()
	
	def _save_file(self) -> None:
		with open(self._json_path, "wb") as f:
			f.write(orjson.dumps(self._data, option=orjson.OPT_INDENT_2))
	
	def _get_user(self, uid: str) -> Dict[str, Any]:
		if uid not in self._data["users"]:
			self._data["users"][uid] = {"passport": [], "favourite": []}
		return self._data["users"][uid]
	
	def get_user_profile(self, uid: str) -> Dict[str, Any]:
		with self._lock:
			user = self._get_user(uid)
			return {"uid": uid, "passport": list(user["passport"]), "favourite": list(user["favourite"])}
	
	def get_passport(self, uid: str) -> List[Dict[str, Any]]:
		with self._lock:
			return list(self._get_user(uid)["passport"])
	
	def get_favourite(self, uid: str) -> List[Dict[str, Any]]:
		with self._lock:
			return list(self._get_user(uid)["favourite"])
	
	def add_to_passport(self, uid: str, event_id: str) -> Dict[str, Any]:
		with self._lock:
			user = self._get_user(uid)
			for item in user["passport"]:
				if item["event_id"] == event_id:
					return {"added": False, "message": "Event already in passport", "event": item}
			new_entry = {"event_id": event_id, "added_at": int(time.time())}
			user["passport"].append(new_entry)
			self._save_file()
			return {"added": True, "message": "Event added to passport", "event": new_entry}
	
	def add_to_favourite(self, uid: str, event_id: str) -> Dict[str, Any]:
		with self._lock:
			user = self._get_user(uid)
			for item in user["favourite"]:
				if item["event_id"] == event_id:
					return {"added": False, "message": "Event already in favourites", "event": item}
			new_entry = {"event_id": event_id, "added_at": int(time.time())}
			user["favourite"].append(new_entry)
			self._save_file()
			return {"added": True, "message": "Event added to favourites", "event": new_entry}
	
	def remove_from_passport(self, uid: str, event_id: str) -> Dict[str, Any]:
		with self._lock:
			user = self._get_user(uid)
			initial_len = len(user["passport"])
			user["passport"] = [item for item in user["passport"] if item["event_id"] != event_id]
			if len(user["passport"]) < initial_len:
				self._save_file()
				return {"removed": True, "message": "Event removed from passport"}
			return {"removed": False, "message": "Event not found in passport"}
	
	def remove_from_favourite(self, uid: str, event_id: str) -> Dict[str, Any]:
		with self._lock:
			user = self._get_user(uid)
			initial_len = len(user["favourite"])
			user["favourite"] = [item for item in user["favourite"] if item["event_id"] != event_id]
			if len(user["favourite"]) < initial_len:
				self._save_file()
				return {"removed": True, "message": "Event removed from favourites"}
			return {"removed": False, "message": "Event not found in favourites"}
	
	def validate_event_exists(self, event_id: str, events_store) -> bool:
		events_store.ensure_loaded()
		return any(event.get("event_id") == event_id for event in events_store._events)


user_data_store = UserDataStore()
