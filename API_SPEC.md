# Art Pass - API 規格文件

## 數據格式說明

### Event 完整資料結構

根據後端爬蟲提供的數據格式：

```typescript
interface Event {
  // === 識別資訊 ===
  event_id: string;                    // UUID
  detail_page_url: string;             // 詳情頁面 URL
  
  // === 基本資訊 ===
  title: string;                       // 展演標題
  category: string;                    // 類別（音樂現場、展覽等）
  raw_text: string;                    // 原始文字
  
  // === 時間資訊 ===
  date_time: string;                   // 原始時間字串 "114/11/09 (日) 14:00-16:30"
  start_date: string;                  // 開始日期 "114/11/09"
  end_date: string;                    // 結束日期 "114/11/09"
  start_time: string;                  // 開始時間 "14:00"
  end_time: string;                    // 結束時間 "16:30"
  event_timezone: string;              // 時區 "Asia/Taipei"
  start_datetime_iso: string;          // ISO 格式開始時間
  start_timestamp: number;             // Unix timestamp (秒)
  end_datetime_iso: string;            // ISO 格式結束時間
  end_timestamp: number;               // Unix timestamp (秒)
  
  // === 地點資訊 ===
  venue_preview: string;               // 場館名稱
  latitude: number;                    // 緯度
  longitude: number;                   // 經度
  google_maps_url: string;             // Google Maps 連結
  
  // === 票務資訊 ===
  ticket_type_preview: string;         // 票券類型預覽 "售票"
  ticket_type: string;                 // 票券類型 "售票" | "免費" | "報名"
  ticket_price: string;                // 票價（分號分隔）"300;500"
  ticket_url: string;                  // 購票連結
  
  // === 媒體資訊 ===
  image_url_preview: string;           // 預覽圖 URL
  image_url: string;                   // 完整圖片 URL
  local_image_path: string;            // 本地圖片路徑
  
  // === 詳細資訊 ===
  event_description: string;           // 活動描述
  organizer: string;                   // 主辦單位
  contact_person: string;              // 聯絡人
  contact_phone: string;               // 聯絡電話
  event_url: string;                   // 活動官網
  
  // === 系統資訊 ===
  scraped_at: string;                  // 爬取時間 ISO 格式
}
```

---

## API 端點詳細規格

### 通用回應格式

#### 成功回應
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功" // 可選
}
```

#### 錯誤回應
```json
{
  "success": false,
  "error": "錯誤訊息",
  "code": "ERROR_CODE" // 可選
}
```

---

## 1. 熱門展演

### `GET /api/events/featured`

**描述**: 獲取熱門展演列表

**Query Parameters**:
```typescript
{
  limit?: number;  // 返回數量，預設 10
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "event_id": "b12c795b-baed-4aae-ac3c-2883f78b9cd3",
      "title": "TCO【溫馨飛魔力系列】逐夢．初心─TCO青年國樂團音樂會",
      "category": "音樂現場",
      "start_datetime_iso": "2025-11-09T14:00:00+08:00",
      "venue_preview": "臺北市中山堂中正廳",
      "image_url": "https://...",
      "ticket_type": "售票",
      "ticket_price": "300;500",
      "latitude": 25.043,
      "longitude": 121.5102
    }
    // ... 更多展演
  ]
}
```

**MVP 實作邏輯**:
```typescript
// 簡單排序：隨機或按 ID
// 未來可加入：瀏覽數、評分、收藏數等
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');
  
  // 讀取資料
  const events = await loadEvents();
  
  // 簡單處理：取前 N 筆
  const featured = events.slice(0, limit);
  
  return Response.json({
    success: true,
    data: featured
  });
}
```

---

## 2. 近期展演

### `GET /api/events/upcoming`

**描述**: 獲取即將開始的展演

**Query Parameters**:
```typescript
{
  limit?: number;  // 返回數量，預設 10
  from?: string;   // 起始時間 ISO 格式，預設為當前時間
}
```

**Response**: 同 featured

**實作邏輯**:
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');
  const from = searchParams.get('from') || new Date().toISOString();
  
  const events = await loadEvents();
  
  // 篩選未來的活動
  const upcoming = events
    .filter(e => e.start_datetime_iso > from)
    .sort((a, b) => a.start_timestamp - b.start_timestamp)
    .slice(0, limit);
  
  return Response.json({
    success: true,
    data: upcoming
  });
}
```

---

## 3. 展演列表（含篩選）

### `GET /api/events/list`

**描述**: 獲取展演列表，支援多條件篩選

**Query Parameters**:
```typescript
{
  // 篩選條件
  region?: string;        // 地區（部分匹配 venue_preview）
  category?: string;      // 類別（完全匹配）
  minPrice?: number;      // 最低票價
  maxPrice?: number;      // 最高票價
  timeRange?: string;     // today | week | month | all
  venue?: string;         // 場館（部分匹配）
  
  // 分頁
  page?: number;          // 頁碼，預設 1
  limit?: number;         // 每頁數量，預設 20
  
  // 排序
  sortBy?: string;        // date | price | title
  order?: string;         // asc | desc
}
```

**Response**:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**實作邏輯**:
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // 解析參數
  const filters = {
    region: searchParams.get('region'),
    category: searchParams.get('category'),
    minPrice: parseFloat(searchParams.get('minPrice') || '0'),
    maxPrice: parseFloat(searchParams.get('maxPrice') || 'Infinity'),
    timeRange: searchParams.get('timeRange') || 'all',
    venue: searchParams.get('venue'),
  };
  
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  
  let events = await loadEvents();
  
  // 篩選
  events = events.filter(event => {
    // 地區篩選
    if (filters.region && !event.venue_preview.includes(filters.region)) {
      return false;
    }
    
    // 類別篩選
    if (filters.category && event.category !== filters.category) {
      return false;
    }
    
    // 票價篩選
    const prices = event.ticket_price.split(';').map(p => parseFloat(p));
    const minEventPrice = Math.min(...prices);
    const maxEventPrice = Math.max(...prices);
    if (maxEventPrice < filters.minPrice || minEventPrice > filters.maxPrice) {
      return false;
    }
    
    // 時間範圍篩選
    if (filters.timeRange !== 'all') {
      const now = Date.now() / 1000;
      const eventTime = event.start_timestamp;
      
      switch (filters.timeRange) {
        case 'today':
          const dayEnd = now + 86400; // 24小時
          if (eventTime < now || eventTime > dayEnd) return false;
          break;
        case 'week':
          const weekEnd = now + 604800; // 7天
          if (eventTime < now || eventTime > weekEnd) return false;
          break;
        case 'month':
          const monthEnd = now + 2592000; // 30天
          if (eventTime < now || eventTime > monthEnd) return false;
          break;
      }
    }
    
    // 場館篩選
    if (filters.venue && !event.venue_preview.includes(filters.venue)) {
      return false;
    }
    
    return true;
  });
  
  // 分頁
  const total = events.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedEvents = events.slice(start, end);
  
  return Response.json({
    success: true,
    data: paginatedEvents,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: end < total,
      hasPrev: page > 1
    }
  });
}
```

---

## 4. 附近展演

### `GET /api/events/nearby`

**描述**: 根據地理位置獲取附近的展演，按場館分組

**Query Parameters**:
```typescript
{
  lat: number;      // 緯度（必填）
  lng: number;      // 經度（必填）
  radius?: number;  // 搜尋半徑（公里），預設 10
  limit?: number;   // 每個場館最多返回幾個展演，預設 5
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "userLocation": {
      "lat": 25.0330,
      "lng": 121.5654
    },
    "venues": [
      {
        "venue_name": "臺北市中山堂中正廳",
        "latitude": 25.043,
        "longitude": 121.5102,
        "distance": 1.2,  // 公里
        "events": [
          {
            "event_id": "...",
            "title": "...",
            // ... 完整 event 資料
          }
        ]
      },
      {
        "venue_name": "國家戲劇院",
        "latitude": 25.0374,
        "longitude": 121.5186,
        "distance": 2.5,
        "events": [ ... ]
      }
    ]
  }
}
```

**實作邏輯**:
```typescript
// lib/geo.ts - 距離計算
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // 地球半徑（公里）
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// API Route
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const lat = parseFloat(searchParams.get('lat')!);
  const lng = parseFloat(searchParams.get('lng')!);
  const radius = parseFloat(searchParams.get('radius') || '10');
  const limit = parseInt(searchParams.get('limit') || '5');
  
  if (!lat || !lng) {
    return Response.json({
      success: false,
      error: '缺少位置參數'
    }, { status: 400 });
  }
  
  const events = await loadEvents();
  
  // 計算距離並篩選
  const eventsWithDistance = events.map(event => ({
    ...event,
    distance: calculateDistance(lat, lng, event.latitude, event.longitude)
  })).filter(event => event.distance <= radius);
  
  // 按場館分組
  const venueMap = new Map<string, any>();
  
  eventsWithDistance.forEach(event => {
    const venueName = event.venue_preview;
    
    if (!venueMap.has(venueName)) {
      venueMap.set(venueName, {
        venue_name: venueName,
        latitude: event.latitude,
        longitude: event.longitude,
        distance: event.distance,
        events: []
      });
    }
    
    const venue = venueMap.get(venueName);
    if (venue.events.length < limit) {
      venue.events.push(event);
    }
  });
  
  // 轉換為陣列並按距離排序
  const venues = Array.from(venueMap.values())
    .sort((a, b) => a.distance - b.distance);
  
  return Response.json({
    success: true,
    data: {
      userLocation: { lat, lng },
      venues
    }
  });
}
```

---

## 5. 觀展記錄

### `GET /api/passport/list`

**描述**: 獲取用戶的觀展歷程

**Response**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalVisits": 12,
      "currentStreak": 3,
      "favoriteVenue": "國立故宮博物院",
      "favoriteCategory": "展覽"
    },
    "passport": [
      {
        "id": "visit-uuid",
        "eventId": "event-uuid",
        "visitDate": "2025-11-09",
        "addedAt": "2025-11-09T18:30:00+08:00",
        "event": {
          // 完整 event 資料
        }
      }
    ]
  }
}
```

**MVP 實作**:
```typescript
// 從 LocalStorage 讀取
export async function GET() {
  // 這裡暫時返回空資料
  // 實際會在客戶端用 LocalStorage
  return Response.json({
    success: true,
    data: {
      stats: {
        totalVisits: 0,
        currentStreak: 0
      },
      passport: []
    }
  });
}
```

---

### `POST /api/passport/add`

**描述**: 新增觀展記錄

**Request Body**:
```json
{
  "eventId": "b12c795b-...",
  "visitDate": "2025-11-09",  // 可選，預設今天
  "notes": "很棒的展覽！"      // 可選
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "visit-uuid",
    "eventId": "event-uuid",
    "visitDate": "2025-11-09",
    "addedAt": "2025-11-09T18:30:00+08:00"
  }
}
```

---

### `DELETE /api/passport/:id`

**描述**: 刪除觀展記錄

**Response**:
```json
{
  "success": true,
  "message": "已刪除記錄"
}
```

---

## 6. 收藏功能

### LocalStorage 格式

```typescript
// key: 'art-pass-favorites'
type Favorites = string[]; // eventId 陣列

// 範例
localStorage.setItem('art-pass-favorites', JSON.stringify([
  'b12c795b-baed-4aae-ac3c-2883f78b9cd3',
  'another-event-id'
]));
```

### 客戶端實作

```typescript
// hooks/useFavorites.ts
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  
  useEffect(() => {
    const stored = localStorage.getItem('art-pass-favorites');
    if (stored) {
      setFavorites(JSON.parse(stored));
    }
  }, []);
  
  const toggleFavorite = (eventId: string) => {
    const newFavorites = favorites.includes(eventId)
      ? favorites.filter(id => id !== eventId)
      : [...favorites, eventId];
    
    setFavorites(newFavorites);
    localStorage.setItem('art-pass-favorites', JSON.stringify(newFavorites));
  };
  
  const isFavorited = (eventId: string) => favorites.includes(eventId);
  
  return { favorites, toggleFavorite, isFavorited };
}
```

---

## 資料載入邏輯

### 開發環境

```typescript
// lib/data.ts
import fs from 'fs';
import path from 'path';

export async function loadEvents(): Promise<Event[]> {
  // 從 public/data/events.json 讀取
  const filePath = path.join(process.cwd(), 'public', 'data', 'events.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(fileContent);
}
```

### 生產環境（未來）

```typescript
export async function loadEvents(): Promise<Event[]> {
  // 從資料庫或外部 API 獲取
  const response = await fetch('https://api.example.com/events');
  return response.json();
}
```

---

## 錯誤處理

### 標準錯誤碼

```typescript
enum ErrorCode {
  INVALID_PARAMS = 'INVALID_PARAMS',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

// 使用範例
return Response.json({
  success: false,
  error: '缺少必要參數',
  code: ErrorCode.INVALID_PARAMS
}, { status: 400 });
```

---

## 效能優化建議

### 1. 快取策略

```typescript
// Next.js App Router 快取
export const revalidate = 3600; // 1 小時重新驗證

// 或使用 fetch 的 cache 選項
const events = await fetch('...', {
  next: { revalidate: 3600 }
});
```

### 2. 圖片優化

```typescript
// 使用 Next.js Image 組件
import Image from 'next/image';

<Image
  src={event.image_url}
  alt={event.title}
  width={300}
  height={200}
  loading="lazy"
  placeholder="blur"
  blurDataURL="data:image/..."
/>
```

### 3. 無限滾動

```typescript
// 使用 Intersection Observer
const { ref, inView } = useInView();

useEffect(() => {
  if (inView && hasMore) {
    loadMore();
  }
}, [inView]);
```

---

## 測試資料

在開發階段，可以使用後端提供的 JSON 檔案作為測試資料：

```bash
# 將資料放置於
art-pass/public/data/events.json
```

---

**最後更新**: 2025/11/08  
**版本**: v1.0

