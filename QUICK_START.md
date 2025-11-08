# Art Pass - 快速開始指南

## 🚀 立即開始

### 1. 環境準備

```bash
# 確認 Node.js 版本
node -v  # 建議 v18+ 或 v20+

# 進入專案目錄
cd art-pass

# 安裝依賴
npm install
```

### 2. 設定環境變數

創建 `.env.local` 檔案：

```bash
# Google Maps API Key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here

# 可選：自訂 API 基礎 URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### 3. 準備測試資料

將後端提供的展演資料放置於：

```bash
art-pass/public/data/events.json
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

訪問 http://localhost:3000

---

## 📁 開發前必讀

### 專案結構總覽

```
art-pass/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 首頁 ✅ 優先開發
│   ├── explore/           # 找展演 ✅ 優先開發
│   ├── nearby/            # 找身邊 🗺️ 需要 Google Maps
│   ├── passport/          # 找記憶 📖
│   └── api/               # API Routes
│
├── components/            # 共用組件
│   ├── EventCard.tsx     # 展演卡片（最重要！）
│   ├── FilterSheet.tsx   # 篩選彈窗
│   ├── MapView.tsx       # 地圖組件
│   └── ui/               # 基礎 UI 組件
│
├── lib/                   # 工具函數
│   ├── types.ts          # 型別定義（先建立！）
│   ├── constants.ts      # 常數定義
│   ├── utils.ts          # 工具函數
│   ├── storage.ts        # LocalStorage 封裝
│   └── geo.ts            # 地理計算
│
└── hooks/                 # 自訂 Hooks
    ├── useFavorites.ts   # 收藏功能
    ├── useTimeline.ts    # 觀展記錄
    └── useEvents.ts      # 資料獲取
```

---

## 🎯 開發順序建議

### Phase 1: 基礎建設（必做）

#### 1.1 建立型別定義

**檔案**: `lib/types.ts`

```typescript
export interface Event {
  event_id: string;
  title: string;
  category: string;
  start_datetime_iso: string;
  end_datetime_iso: string;
  start_timestamp: number;
  venue_preview: string;
  latitude: number;
  longitude: number;
  image_url: string;
  ticket_type: string;
  ticket_price: string;
  event_description: string;
  // ... 其他欄位參考 API_SPEC.md
}

export interface FilterOptions {
  region?: string;
  category?: string;
  priceRange?: [number, number];
  timeRange?: 'today' | 'week' | 'month' | 'all';
  venue?: string;
}

export interface Venue {
  venue_name: string;
  latitude: number;
  longitude: number;
  distance: number;
  events: Event[];
}
```

#### 1.2 建立資料載入工具

**檔案**: `lib/data.ts`

```typescript
import fs from 'fs';
import path from 'path';
import type { Event } from './types';

export async function loadEvents(): Promise<Event[]> {
  const filePath = path.join(process.cwd(), 'public', 'data', 'events.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(fileContent);
}
```

#### 1.3 建立常用工具函數

**檔案**: `lib/utils.ts`

```typescript
// 格式化日期
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short'
  });
}

// 格式化時間
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 格式化票價
export function formatPrice(priceString: string): string {
  const prices = priceString.split(';').filter(Boolean);
  if (prices.length === 0) return '免費';
  if (prices.length === 1) return `$${prices[0]}`;
  return `$${Math.min(...prices.map(Number))} - $${Math.max(...prices.map(Number))}`;
}

// Tailwind cn 工具
export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
```

---

### Phase 2: 基礎 UI 組件

#### 2.1 Button 組件

**檔案**: `components/ui/Button.tsx`

```typescript
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ 
  variant = 'primary', 
  size = 'md',
  className,
  children,
  ...props 
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-lg font-medium transition-colors',
        {
          'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
          'bg-gray-200 text-gray-900 hover:bg-gray-300': variant === 'secondary',
          'hover:bg-gray-100': variant === 'ghost',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2': size === 'md',
          'px-6 py-3 text-lg': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

#### 2.2 其他基礎組件

建議複製使用 shadcn/ui 或類似 UI 庫的組件：
- `Input.tsx`
- `Select.tsx`
- `Slider.tsx`

---

### Phase 3: EventCard 組件（核心！）

**檔案**: `components/EventCard.tsx`

```typescript
'use client';

import Image from 'next/image';
import type { Event } from '@/lib/types';
import { formatDate, formatTime, formatPrice } from '@/lib/utils';
import { HeartIcon } from './icons/HeartIcon';

interface EventCardProps {
  event: Event;
  layout?: 'horizontal' | 'vertical' | 'compact';
  showFavorite?: boolean;
  isFavorited?: boolean;
  onFavoriteClick?: () => void;
  onClick?: () => void;
}

export function EventCard({
  event,
  layout = 'vertical',
  showFavorite = true,
  isFavorited = false,
  onFavoriteClick,
  onClick
}: EventCardProps) {
  if (layout === 'horizontal') {
    return (
      <div 
        className="flex gap-4 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={onClick}
      >
        <div className="relative w-32 h-32 flex-shrink-0">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover rounded-lg"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{event.title}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {formatDate(event.start_datetime_iso)} {formatTime(event.start_datetime_iso)}
          </p>
          <p className="text-sm text-gray-600">{event.venue_preview}</p>
          <div className="flex gap-2 mt-2">
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {event.category}
            </span>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              {formatPrice(event.ticket_price)}
            </span>
          </div>
        </div>
        
        {showFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteClick?.();
            }}
            className="self-start p-2"
          >
            <HeartIcon filled={isFavorited} />
          </button>
        )}
      </div>
    );
  }
  
  // vertical layout
  return (
    <div 
      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      <div className="relative w-full aspect-video">
        <Image
          src={event.image_url}
          alt={event.title}
          fill
          className="object-cover"
        />
        {showFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteClick?.();
            }}
            className="absolute top-2 right-2 p-2 bg-white/80 rounded-full"
          >
            <HeartIcon filled={isFavorited} />
          </button>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-lg line-clamp-2">{event.title}</h3>
        <p className="text-sm text-gray-600 mt-2">
          {formatDate(event.start_datetime_iso)}
        </p>
        <p className="text-sm text-gray-600">{event.venue_preview}</p>
      </div>
    </div>
  );
}
```

---

### Phase 4: API Routes

#### 4.1 Featured Events

**檔案**: `app/api/events/featured/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { loadEvents } from '@/lib/data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const events = await loadEvents();
    const featured = events.slice(0, limit);
    
    return Response.json({
      success: true,
      data: featured
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: '無法載入資料'
    }, { status: 500 });
  }
}
```

其他 API Routes 參考 `API_SPEC.md`

---

### Phase 5: 首頁

**檔案**: `app/page.tsx`

```typescript
import { EventCard } from '@/components/EventCard';
import { ScrollableCards } from '@/components/ScrollableCards';
import Link from 'next/link';

async function getFeaturedEvents() {
  const res = await fetch('http://localhost:3000/api/events/featured', {
    next: { revalidate: 3600 }
  });
  const data = await res.json();
  return data.data;
}

async function getUpcomingEvents() {
  const res = await fetch('http://localhost:3000/api/events/upcoming', {
    next: { revalidate: 3600 }
  });
  const data = await res.json();
  return data.data;
}

export default async function Home() {
  const featured = await getFeaturedEvents();
  const upcoming = await getUpcomingEvents();
  
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Art Pass</h1>
      </header>
      
      {/* 熱門展演 */}
      <section className="py-6">
        <div className="px-6 mb-4">
          <h2 className="text-xl font-semibold">🔥 熱門展演</h2>
        </div>
        
        <ScrollableCards>
          {featured.map((event: any) => (
            <div key={event.event_id} className="w-72 flex-shrink-0">
              <EventCard event={event} layout="vertical" />
            </div>
          ))}
        </ScrollableCards>
      </section>
      
      {/* 近期展演 */}
      <section className="py-6">
        <div className="px-6 mb-4">
          <h2 className="text-xl font-semibold">📅 近期展演</h2>
        </div>
        
        <ScrollableCards>
          {upcoming.map((event: any) => (
            <div key={event.event_id} className="w-72 flex-shrink-0">
              <EventCard event={event} layout="vertical" />
            </div>
          ))}
        </ScrollableCards>
      </section>
      
      {/* Quick Actions */}
      <section className="px-6 py-8">
        <div className="grid grid-cols-3 gap-4">
          <Link href="/explore" className="flex flex-col items-center gap-2 p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <span className="text-3xl">🔍</span>
            <span className="font-medium">找展演</span>
          </Link>
          
          <Link href="/nearby" className="flex flex-col items-center gap-2 p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <span className="text-3xl">📍</span>
            <span className="font-medium">找身邊</span>
          </Link>
          
          <Link href="/passport" className="flex flex-col items-center gap-2 p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <span className="text-3xl">📖</span>
            <span className="font-medium">找記憶</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
```

---

## 🎨 樣式指南

### Tailwind 配置

已內建 Tailwind CSS 4，直接使用即可。

### 常用顏色

```typescript
// 主色調
primary: 'blue-600'
secondary: 'gray-600'

// 背景
bg-main: 'gray-50'
bg-card: 'white'

// 文字
text-primary: 'gray-900'
text-secondary: 'gray-600'
text-hint: 'gray-400'
```

### 常用間距

```typescript
// 容器內距
px-6 (24px)

// 區塊間距
py-6 (24px)

// 卡片圓角
rounded-lg (8px)
```

---

## 🔧 常用指令

```bash
# 開發
npm run dev

# 建置
npm run build

# 啟動生產環境
npm run start

# Linting
npm run lint

# 型別檢查
npx tsc --noEmit
```

---

## 📱 Flutter WebView 整合

在 TownPass 專案中：

```dart
// lib/page/art_pass_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

class ArtPassPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: InAppWebView(
          initialUrlRequest: URLRequest(
            url: WebUri('http://localhost:3000')  // 開發環境
            // url: WebUri('https://your-domain.com')  // 正式環境
          ),
          initialOptions: InAppWebViewGroupOptions(
            crossPlatform: InAppWebViewOptions(
              javaScriptEnabled: true,
              useOnLoadResource: true,
            ),
          ),
        ),
      ),
    );
  }
}
```

---

## 🐛 常見問題

### Q1: 圖片載入失敗

**解決方案**: 檢查 `next.config.ts` 的 `images.domains` 設定

```typescript
// next.config.ts
module.exports = {
  images: {
    domains: ['cultureexpress.taipei'],
  },
};
```

### Q2: API 路由 404

**解決方案**: 確認檔案位置和命名正確
- API 路由必須命名為 `route.ts`
- 位於 `app/api/` 目錄下

### Q3: LocalStorage 在 SSR 中報錯

**解決方案**: 使用 `useEffect` 或 `'use client'` 標記

```typescript
'use client';

import { useEffect, useState } from 'react';

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  
  useEffect(() => {
    // 只在客戶端執行
    const stored = localStorage.getItem('art-pass-favorites');
    if (stored) {
      setFavorites(JSON.parse(stored));
    }
  }, []);
  
  return favorites;
}
```

---

## 🖼️ Timeline 路徑設計重點

- Duolingo 風格：節點圓潤、柔和飽和的漸層背景，加上可愛向量 icon
- 調色建議：`#A6E1FF` / `#B6F0D3` / `#FFE3A6` / `#F8D9FF` 搭配白色高光
- 徽章設計：SVG vector，保留 2-3 種主色與一層高光，方便動畫
- 動畫手感：Framer Motion（bounce/scale/fade）+ CSS `filter: drop-shadow`
- 節點狀態：`locked` 灰階+小鎖、`inProgress` 漸層光圈、`completed` 外圈發光

## 📚 參考資源

- [Next.js 文件](https://nextjs.org/docs)
- [Tailwind CSS 文件](https://tailwindcss.com/docs)
- [Google Maps API](https://developers.google.com/maps/documentation/javascript)
- [Architecture.md](./ARCHITECTURE.md) - 完整架構文件
- [API_SPEC.md](./API_SPEC.md) - API 規格文件

---

## ✅ 檢查清單

開始開發前，確認：

- [ ] Node.js 版本正確 (v18+)
- [ ] 已安裝依賴 `npm install`
- [ ] 已創建 `.env.local`
- [ ] 已準備測試資料 `public/data/events.json`
- [ ] 開發伺服器正常運行 `npm run dev`
- [ ] 已閱讀 `ARCHITECTURE.md`

---

**準備好了嗎？開始開發吧！** 🚀

有任何問題，參考 `ARCHITECTURE.md` 或 `API_SPEC.md` 獲取更詳細的資訊。

