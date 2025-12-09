import os
from typing import Optional


def getenv_str(name: str, default: Optional[str] = None) -> Optional[str]:
	value = os.getenv(name)
	return value if value is not None else default


def getenv_int(name: str, default: int) -> int:
	value = os.getenv(name)
	if value is None:
		return default
	try:
		return int(value)
	except ValueError:
		return default


EVENTS_JSON_PATH: str = getenv_str("EVENTS_JSON_PATH", os.path.join(os.getcwd(), "output", "events.json"))  # type: ignore[assignment]
USERDATA_JSON_PATH: str = getenv_str("USERDATA_JSON_PATH", os.path.join(os.getcwd(), "output", "userdata.json"))  # type: ignore[assignment]
IMAGES_DIR_PATH: str = getenv_str("IMAGES_DIR_PATH", os.path.join(os.getcwd(), "output", "images"))  # type: ignore[assignment]
API_BASE_URL: str = getenv_str("API_BASE_URL", "http://localhost:8000")  # type: ignore[assignment]

MAX_LIMIT: int = getenv_int("MAX_LIMIT", 500)
DEFAULT_RANDOM_AMOUNT: int = getenv_int("DEFAULT_RANDOM_AMOUNT", 5)
DEFAULT_RECENT_AMOUNT: int = getenv_int("DEFAULT_RECENT_AMOUNT", 5)
DEFAULT_FILTER_LIMIT: int = getenv_int("DEFAULT_FILTER_LIMIT", 0)  # 0 = unlimited

ENABLE_CORS: bool = getenv_str("ENABLE_CORS", "true") == "true"

HOT_EVENT_IDS: list[str] = [
	"d891f670-6735-4473-8f5d-8cc897a6e81d",
	"d88f6441-5402-41dd-8fae-8cf0ebe082e7",
	"c1031340-af36-436c-8e38-32256170aca1",
	"e382529e-3dcd-4a0e-b579-5073a5cb7b0f",
	"f0c98953-ffda-4991-ba2d-b45af7837f89",
	"e7fbb4b8-d3d2-46b7-a331-c6c8c5550ceb",
]
