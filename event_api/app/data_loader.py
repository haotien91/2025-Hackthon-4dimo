from __future__ import annotations

import os
import random
import threading
from typing import Any, Dict, List, Optional, Sequence

import orjson

from .config import API_BASE_URL, EVENTS_JSON_PATH


class EventsDataStore:
	"""Thread-safe in-memory event store with auto-reload on file changes."""
	
	def __init__(self, json_path: Optional[str] = None) -> None:
		self._json_path: str = json_path or EVENTS_JSON_PATH
		self._lock = threading.Lock()
		self._last_mtime: float = 0.0
		self._events: List[Dict[str, Any]] = []
		self._sorted_indices_start_desc: List[int] = []
		self._category_to_indices: Dict[str, List[int]] = {}
		self._ticket_type_to_indices: Dict[str, List[int]] = {}
		self._venue_key_to_indices: Dict[str, List[int]] = {}

	def _file_mtime(self) -> float:
		try:
			return os.path.getmtime(self._json_path)
		except OSError:
			return 0.0

	def _rebuild_indices(self) -> None:
		self._sorted_indices_start_desc = sorted(
			range(len(self._events)),
			key=lambda i: int(self._events[i].get("start_timestamp") or 0),
			reverse=True,
		)
		self._category_to_indices.clear()
		self._ticket_type_to_indices.clear()
		self._venue_key_to_indices.clear()
		
		for idx, ev in enumerate(self._events):
			category = str(ev.get("category") or "").strip()
			if category:
				self._category_to_indices.setdefault(category, []).append(idx)
			ticket_type = str(ev.get("ticket_type") or "").strip()
			if ticket_type:
				self._ticket_type_to_indices.setdefault(ticket_type, []).append(idx)
			venue_key = self._compute_venue_key(ev)
			self._venue_key_to_indices.setdefault(venue_key, []).append(idx)

	def _compute_venue_key(self, ev: Dict[str, Any]) -> str:
		"""Compute venue key from first session's platform or coordinates."""
		sessions = ev.get("sessions")
		if sessions and isinstance(sessions, list) and len(sessions) > 0:
			first_session = sessions[0]
			platform = str(first_session.get("platform") or "").strip()
			if platform:
				return platform
			lat, lon = first_session.get("latitude"), first_session.get("longitude")
			if lat is not None and lon is not None:
				try:
					return f"{float(lat):.5f},{float(lon):.5f}"
				except Exception:
					pass
		return ""

	def _load_file(self) -> None:
		with open(self._json_path, "rb") as f:
			data = orjson.loads(f.read())
		if not isinstance(data, list):
			raise ValueError("events.json must be a JSON array")
		self._events = data
		self._rebuild_indices()

	def ensure_loaded(self) -> None:
		"""Load or reload data if file changed."""
		mtime = self._file_mtime()
		if self._events and mtime <= self._last_mtime:
			return
		with self._lock:
			mtime_inner = self._file_mtime()
			if self._events and mtime_inner == self._last_mtime:
				return
			self._load_file()
			self._last_mtime = mtime_inner

	def get_random(self, amount: int, seed: Optional[int] = None, distinct_venue: bool = False) -> List[Dict[str, Any]]:
		self.ensure_loaded()
		n = len(self._events)
		if n == 0 or amount <= 0:
			return []
		
		if distinct_venue:
			r = random.Random(seed) if seed is not None else random.SystemRandom()
			venue_keys = list(self._venue_key_to_indices.keys())
			r.shuffle(venue_keys)
			selected_indices: List[int] = []
			for vk in venue_keys:
				group = self._venue_key_to_indices.get(vk) or []
				if group:
					selected_indices.append(r.choice(group))
					if len(selected_indices) >= amount:
						break
			return [self._events[i] for i in selected_indices]
		
		if seed is not None:
			r = random.Random(seed)
			indices = list(range(n))
			r.shuffle(indices)
			selected = indices[:min(amount, n)]
		else:
			selected = random.sample(range(n), k=min(amount, n))
		return [self._events[i] for i in selected]

	def get_recent(self, amount: int) -> List[Dict[str, Any]]:
		self.ensure_loaded()
		if amount <= 0:
			return []
		return [self._events[i] for i in self._sorted_indices_start_desc[:amount]]

	def get_event_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
		self.ensure_loaded()
		for event in self._events:
			if event.get("event_id") == event_id:
				return event
		return None

	def get_events_by_ids(self, event_ids: Sequence[str]) -> List[Dict[str, Any]]:
		self.ensure_loaded()
		events_dict = {event.get("event_id"): event for event in self._events}
		return [events_dict[eid] for eid in event_ids if eid in events_dict]

	def _has_valid_session_in_timeframe(
		self, event: Dict[str, Any], 
		start_min: Optional[int] = None, end_max: Optional[int] = None
	) -> bool:
		if start_min is None and end_max is None:
			return True
		sessions = event.get("sessions")
		if not sessions or not isinstance(sessions, list):
			return False
		for session in sessions:
			s_start = int(session.get("start_timestamp") or 0)
			s_end = int(session.get("end_timestamp") or 0)
			if start_min is not None and s_end < start_min:
				continue
			if end_max is not None and s_start > end_max:
				continue
			return True
		return False

	def get_events_by_platform(
		self, platform: str,
		start_timestamp_min: Optional[int] = None,
		end_timestamp_max: Optional[int] = None
	) -> List[Dict[str, Any]]:
		self.ensure_loaded()
		platform_lower = platform.lower().strip()
		if not platform_lower:
			return []
		
		matching_indices = []
		for idx, event in enumerate(self._events):
			sessions = event.get("sessions")
			if not sessions or not isinstance(sessions, list):
				continue
			for session in sessions:
				if str(session.get("platform") or "").strip().lower() != platform_lower:
					continue
				if start_timestamp_min is not None or end_timestamp_max is not None:
					s_start = int(session.get("start_timestamp") or 0)
					s_end = int(session.get("end_timestamp") or 0)
					if start_timestamp_min is not None and s_end < start_timestamp_min:
						continue
					if end_timestamp_max is not None and s_start > end_timestamp_max:
						continue
				matching_indices.append(idx)
				break
		
		matching_indices.sort(key=lambda i: int(self._events[i].get("start_timestamp") or 0), reverse=True)
		return [self._events[i] for i in matching_indices]

	def get_all_venues(self) -> List[Dict[str, Any]]:
		self.ensure_loaded()
		venues_dict: Dict[str, Dict[str, Any]] = {}
		
		for event in self._events:
			sessions = event.get("sessions")
			if not sessions or not isinstance(sessions, list):
				continue
			for session in sessions:
				platform = str(session.get("platform") or "").strip()
				if not platform or platform in venues_dict:
					continue
				lat, lon = session.get("latitude"), session.get("longitude")
				if lat is not None and lon is not None:
					try:
						lat, lon = float(lat), float(lon)
						venues_dict[platform] = {
							"platform": platform,
							"latitude": lat,
							"longitude": lon,
							"google_maps_url": f"https://www.google.com/maps/search/?api=1&query={lat},{lon}"
						}
					except (ValueError, TypeError):
						continue
		
		return sorted(venues_dict.values(), key=lambda x: x["platform"])

	def filter_events(
		self, *,
		categories: Optional[Sequence[str]] = None,
		ticket_types: Optional[Sequence[str]] = None,
		start_timestamp_min: Optional[int] = None,
		end_timestamp_max: Optional[int] = None,
		limit: Optional[int] = None,
		offset: int = 0,
		sort: str = "start_desc",
	) -> List[Dict[str, Any]]:
		self.ensure_loaded()
		if not self._events:
			return []

		candidate_indices: Optional[set[int]] = None

		if categories:
			cat_set = set[int]()
			for cat in categories:
				if cat in self._category_to_indices:
					cat_set.update(self._category_to_indices[cat])
			candidate_indices = cat_set if candidate_indices is None else (candidate_indices & cat_set)

		if ticket_types:
			tt_set = set[int]()
			for tt in ticket_types:
				if tt in self._ticket_type_to_indices:
					tt_set.update(self._ticket_type_to_indices[tt])
			candidate_indices = tt_set if candidate_indices is None else (candidate_indices & tt_set)

		if candidate_indices is None:
			candidate_indices = set(range(len(self._events)))

		filtered = [i for i in candidate_indices if self._has_valid_session_in_timeframe(
			self._events[i], start_timestamp_min, end_timestamp_max
		)]

		if sort == "start_desc":
			filtered.sort(key=lambda i: int(self._events[i].get("start_timestamp") or 0), reverse=True)
		elif sort == "start_asc":
			filtered.sort(key=lambda i: int(self._events[i].get("start_timestamp") or 0))

		if offset < 0:
			offset = 0
		if limit is None or limit == 0:
			return [self._events[i] for i in filtered[offset:]]
		return [self._events[i] for i in filtered[offset:offset + limit]]

	@staticmethod
	def transform_image_urls(events: List[Dict[str, Any]], base_url: Optional[str] = None) -> List[Dict[str, Any]]:
		"""Replace image URLs with local API endpoints."""
		if base_url is None:
			base_url = API_BASE_URL
		transformed = []
		for event in events:
			event_copy = event.copy()
			local_path = event.get("local_image_path", "")
			if local_path:
				filename = local_path.replace("\\", "/").split("/")[-1]
				event_copy["image_url"] = f"{base_url}/images/{filename}"
			transformed.append(event_copy)
		return transformed


events_store = EventsDataStore()
