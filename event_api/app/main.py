from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, ORJSONResponse

from .config import (
	DEFAULT_FILTER_LIMIT,
	DEFAULT_RANDOM_AMOUNT,
	DEFAULT_RECENT_AMOUNT,
	ENABLE_CORS,
	HOT_EVENT_IDS,
	IMAGES_DIR_PATH,
	MAX_LIMIT,
)
from .data_loader import events_store
from .user_data_store import user_data_store


def get_base_url(request: Request) -> str:
	"""Generate base URL from request for dynamic image URLs."""
	return f"{request.url.scheme}://{request.url.netloc}"


app = FastAPI(default_response_class=ORJSONResponse, title="Events API", version="2.0.0")

if ENABLE_CORS:
	app.add_middleware(
		CORSMiddleware,
		allow_origins=["*"],
		allow_credentials=True,
		allow_methods=["*"],
		allow_headers=["*"],
	)


@app.on_event("startup")
def _warmup() -> None:
	try:
		events_store.ensure_loaded()
	except Exception as exc:
		print(f"[startup] events preload failed: {exc}")


@app.get("/health")
def health() -> dict:
	return {"status": "ok"}


@app.get("/images/{filename}")
def get_image(filename: str):
	"""Serve cached event images."""
	import os
	file_path = os.path.join(IMAGES_DIR_PATH, filename)
	if not os.path.exists(file_path):
		raise HTTPException(status_code=404, detail="Image not found")
	return FileResponse(file_path)


def clamp_amount(amount: int, *, default_amount: int) -> int:
	if amount is None:
		return default_amount
	if amount <= 0:
		raise HTTPException(status_code=400, detail="amount must be > 0")
	return min(amount, MAX_LIMIT)


@app.get("/random")
def random_events(
	request: Request,
	amount: int = Query(default=DEFAULT_RANDOM_AMOUNT, ge=1, le=10_000),
	seed: Optional[int] = Query(default=None),
	distinct_venue: bool = Query(default=True, description="Return at most one event per venue"),
):
	"""Return random events."""
	amount = clamp_amount(amount, default_amount=DEFAULT_RANDOM_AMOUNT)
	events = events_store.get_random(amount=amount, seed=seed, distinct_venue=distinct_venue)
	return events_store.transform_image_urls(events, base_url=get_base_url(request))


@app.get("/recent")
def recent_events(
	request: Request,
	amount: int = Query(default=DEFAULT_RECENT_AMOUNT, ge=1, le=10_000),
):
	"""Return most recent events by start_timestamp."""
	amount = clamp_amount(amount, default_amount=DEFAULT_RECENT_AMOUNT)
	events = events_store.get_recent(amount=amount)
	return events_store.transform_image_urls(events, base_url=get_base_url(request))


@app.get("/hot")
def hot_events(request: Request):
	"""Return curated featured events."""
	events = events_store.get_events_by_ids(HOT_EVENT_IDS)
	return events_store.transform_image_urls(events, base_url=get_base_url(request))


@app.get("/venue")
def get_all_venues():
	"""Return all unique venues with coordinates."""
	return events_store.get_all_venues()


@app.get("/search")
def search_events(
	request: Request,
	category: Optional[List[str]] = Query(default=None),
	ticket_type: Optional[List[str]] = Query(default=None),
	start_timestamp: Optional[int] = Query(default=None, description="Min start_timestamp"),
	end_timestamp: Optional[int] = Query(default=None, description="Max end_timestamp"),
	limit: Optional[int] = Query(default=DEFAULT_FILTER_LIMIT if DEFAULT_FILTER_LIMIT != 0 else None, description="Max items (0=unlimited)"),
	offset: int = Query(default=0, ge=0, le=1_000_000),
	sort: str = Query(default="start_desc", pattern="^(start_desc|start_asc)$"),
):
	"""Search and filter events."""
	if limit is None or limit == 0:
		effective_limit: Optional[int] = None
	else:
		if limit < 1:
			raise HTTPException(status_code=400, detail="limit must be >= 1")
		effective_limit = min(limit, MAX_LIMIT)
	
	events = events_store.filter_events(
		categories=category,
		ticket_types=ticket_type,
		start_timestamp_min=start_timestamp,
		end_timestamp_max=end_timestamp,
		limit=effective_limit,
		offset=offset,
		sort=sort,
	)
	return events_store.transform_image_urls(events, base_url=get_base_url(request))


@app.get("/event/{event_id}")
def get_event_by_id(request: Request, event_id: str):
	"""Get a single event by ID."""
	event = events_store.get_event_by_id(event_id)
	if event is None:
		raise HTTPException(status_code=404, detail=f"Event with ID '{event_id}' not found")
	return events_store.transform_image_urls([event], base_url=get_base_url(request))[0]


@app.get("/platform/{platform_name}")
def get_events_by_platform(
	request: Request, 
	platform_name: str,
	start_timestamp: Optional[int] = Query(default=None, description="Min session start_timestamp"),
	end_timestamp: Optional[int] = Query(default=None, description="Max session start_timestamp"),
):
	"""Get all events at a platform/venue."""
	events = events_store.get_events_by_platform(
		platform_name,
		start_timestamp_min=start_timestamp,
		end_timestamp_max=end_timestamp
	)
	if not events:
		raise HTTPException(status_code=404, detail=f"No events found for platform '{platform_name}'")
	return events_store.transform_image_urls(events, base_url=get_base_url(request))


@app.get("/users/{uid}")
def get_user_profile(uid: str):
	"""Get user profile (passport + favourite)."""
	return user_data_store.get_user_profile(uid)


@app.get("/users/{uid}/passport")
def get_user_passport(uid: str):
	"""Get user's passport events."""
	passport = user_data_store.get_passport(uid)
	return {"uid": uid, "passport": passport, "count": len(passport)}


@app.post("/users/{uid}/passport")
def add_to_passport(uid: str, event_id: str = Query(..., description="Event ID to add")):
	"""Add event to user's passport."""
	if not user_data_store.validate_event_exists(event_id, events_store):
		raise HTTPException(status_code=404, detail=f"Event ID '{event_id}' not found")
	return user_data_store.add_to_passport(uid, event_id)


@app.delete("/users/{uid}/passport/{event_id}")
def remove_from_passport(uid: str, event_id: str):
	"""Remove event from user's passport."""
	result = user_data_store.remove_from_passport(uid, event_id)
	if not result["removed"]:
		raise HTTPException(status_code=404, detail=result["message"])
	return result


@app.get("/users/{uid}/favourite")
def get_user_favourite(uid: str):
	"""Get user's favourite events."""
	favourite = user_data_store.get_favourite(uid)
	return {"uid": uid, "favourite": favourite, "count": len(favourite)}


@app.post("/users/{uid}/favourite")
def add_to_favourite(uid: str, event_id: str = Query(..., description="Event ID to add")):
	"""Add event to user's favourites."""
	if not user_data_store.validate_event_exists(event_id, events_store):
		raise HTTPException(status_code=404, detail=f"Event ID '{event_id}' not found")
	return user_data_store.add_to_favourite(uid, event_id)


@app.delete("/users/{uid}/favourite/{event_id}")
def remove_from_favourite(uid: str, event_id: str):
	"""Remove event from user's favourites."""
	result = user_data_store.remove_from_favourite(uid, event_id)
	if not result["removed"]:
		raise HTTPException(status_code=404, detail=result["message"])
	return result


@app.get("/")
def root() -> dict:
	return {
		"name": "Events API",
		"version": "2.0.0",
		"endpoints": {
			"events": ["/random", "/recent", "/hot", "/venue", "/search", "/event/{id}", "/platform/{name}", "/images/{filename}"],
			"users": ["/users/{uid}", "/users/{uid}/passport", "/users/{uid}/favourite"],
			"utility": ["/health"],
		},
	}
