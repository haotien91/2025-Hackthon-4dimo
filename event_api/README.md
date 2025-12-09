# Events API

FastAPI-based event data API with sessions-based structure, local image serving, and user data tracking.

## Quickstart

### Windows (PowerShell)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Linux / macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Open: http://127.0.0.1:8000

## Endpoints

### Events

| Endpoint | Description |
|----------|-------------|
| `GET /random` | Random events. Query: `amount`, `seed`, `distinct_venue` |
| `GET /recent` | Recent events by start_timestamp. Query: `amount` |
| `GET /hot` | Curated featured events |
| `GET /venue` | All unique venues with coordinates |
| `GET /search` | Filter events. Query: `category`, `ticket_type`, `start_timestamp`, `end_timestamp`, `limit`, `offset`, `sort` |
| `GET /event/{event_id}` | Single event by ID |
| `GET /platform/{platform_name}` | Events at a venue. Query: `start_timestamp`, `end_timestamp` |
| `GET /images/{filename}` | Serve cached images |

### User Data (Passport & Favourite)

| Endpoint | Description |
|----------|-------------|
| `GET /users/{uid}` | User profile (passport + favourite) |
| `GET /users/{uid}/passport` | User's attended events |
| `POST /users/{uid}/passport?event_id=xxx` | Add to passport |
| `DELETE /users/{uid}/passport/{event_id}` | Remove from passport |
| `GET /users/{uid}/favourite` | User's favourite events |
| `POST /users/{uid}/favourite?event_id=xxx` | Add to favourite |
| `DELETE /users/{uid}/favourite/{event_id}` | Remove from favourite |

User data features: validates event_id exists, prevents duplicates, auto-creates users, persists to `output/userdata.json`.

### Utility

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /` | API info |

## Data Structure

```json
{
  "event_id": "uuid",
  "title": "Event Title",
  "category": "展覽",
  "ticket_type": "免費",
  "image_url": "http://localhost:8000/images/uuid.jpg",
  "sessions": [
    {
      "platform": "Venue Name",
      "address": "Full Address",
      "latitude": 25.043,
      "longitude": 121.5102,
      "start_timestamp": 1762668000,
      "end_timestamp": 1762677000
    }
  ]
}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `EVENTS_JSON_PATH` | `./output/events.json` | Events data file |
| `USERDATA_JSON_PATH` | `./output/userdata.json` | User data file |
| `IMAGES_DIR_PATH` | `./output/images` | Images directory |
| `MAX_LIMIT` | `500` | Max items returned |
| `DEFAULT_RANDOM_AMOUNT` | `5` | Default for /random |
| `DEFAULT_RECENT_AMOUNT` | `5` | Default for /recent |
| `DEFAULT_FILTER_LIMIT` | `0` | Default for /search (0 = unlimited) |
| `ENABLE_CORS` | `true` | Enable CORS |
