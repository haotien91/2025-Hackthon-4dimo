# Art Pass - 文化展演探索平台

> **2025 Hackathon 專案** - 讓文化活動探索變得簡單有趣

## 📖 專案簡介

Art Pass 是一個現代化的文化展演探索平台，整合台北市文化活動資訊，提供用戶：

- 🔥 **發現熱門展演** - 精選當前最受歡迎的文化活動
- 🔍 **智能篩選搜尋** - 根據地區、類別、票價、時間靈活篩選
- 📍 **探索附近活動** - 基於地理位置找到身邊的展演場館
- 📖 **記錄觀展歷程** - 打造個人的文化體驗時間軸

## 🏗️ 技術架構

```
┌─────────────────────────────────┐
│   Flutter App (TownPass)        │  ← Dart/Flutter 框架
│        WebView Container         │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   Next.js Web App (art-pass)    │  ← 前端應用
│   - React 19                     │
│   - TypeScript                   │
│   - Tailwind CSS                 │
│   - Google Maps API              │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   Backend Data Source            │  ← 資料來源
│   - 爬蟲資料 (JSON)             │
│   - 台北市文化快遞              │
└─────────────────────────────────┘
```

## 📱 應用頁面

### 1️⃣ 首頁
- 熱門展演橫向滾動卡片
- 近期展演推薦
- 快速導航按鈕

### 2️⃣ 找展演
- 類似 UberEats 的卡片式列表
- 多條件篩選（地區、類別、票價、時間、場館）
- 從底部滑出的篩選彈窗

### 3️⃣ 找身邊
- Google Maps 地圖顯示場館位置
- 底部橫向滾動展演卡片
- 智能場館切換（向右滑動切換下一個場館）
- 動態顯示當前場館資訊

### 4️⃣ 找記憶
- Duolingo 風格的里程碑路徑（柔和漸層 + Q 版 icon）
- 解鎖式 gamification：節點狀態、祝賀動畫、徽章收藏
- 顯示觀展進度、下一個目標倒數、最愛類型徽章
- 支援回顧展演與分享記錄（資料儲存在 LocalStorage）

## 🚀 快速開始

### 環境需求
- Node.js 18+ 或 20+
- npm 或 yarn
- Google Maps API Key

### 安裝與啟動

```bash
# 1. 進入 Next.js 專案目錄
cd art-pass

# 2. 安裝依賴
npm install

# 3. 設定環境變數
cp .env.example .env.local
# 編輯 .env.local，填入你的 Google Maps API Key

# 4. 準備測試資料
# 將展演資料放置於 public/data/events.json

# 5. 啟動開發伺服器
npm run dev

# 6. 訪問 http://localhost:3000
```

## 📚 文件導覽

我們準備了完整的技術文件，請按順序閱讀：

### 🎯 必讀文件

1. **[QUICK_START.md](./QUICK_START.md)** ⭐ 從這裡開始！
   - 環境準備
   - 開發步驟
   - 程式碼範例
   - 常見問題

2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** 📐 完整架構設計
   - 整體架構
   - 頁面設計詳解
   - 組件設計規格
   - 開發階段規劃

3. **[API_SPEC.md](./API_SPEC.md)** 🔌 API 規格文件
   - 資料格式定義
   - API 端點規格
   - 實作邏輯範例
   - 效能優化建議

### 📖 閱讀順序建議

```
開始開發前：
└─→ QUICK_START.md (快速上手)
    └─→ ARCHITECTURE.md (了解整體設計)
        └─→ API_SPEC.md (實作 API 時參考)
```

## 🛠️ 技術棧

### 前端 (art-pass/)
- **框架**: Next.js 16 (App Router)
- **語言**: TypeScript
- **樣式**: Tailwind CSS 4
- **UI**: React 19
- **地圖**: Google Maps JavaScript API
- **狀態管理**: React Context + Hooks
- **儲存**: LocalStorage (MVP)

### 原生容器 (TownPass/)
- **框架**: Flutter
- **語言**: Dart
- **WebView**: flutter_inappwebview

## 📊 資料格式

展演資料由後端爬蟲提供，格式範例：

```json
{
  "event_id": "b12c795b-baed-4aae-ac3c-2883f78b9cd3",
  "title": "TCO【溫馨飛魔力系列】逐夢．初心─TCO青年國樂團音樂會",
  "category": "音樂現場",
  "start_datetime_iso": "2025-11-09T14:00:00+08:00",
  "venue_preview": "臺北市中山堂中正廳",
  "latitude": 25.043,
  "longitude": 121.5102,
  "image_url": "https://...",
  "ticket_type": "售票",
  "ticket_price": "300;500",
  "event_description": "..."
}
```

完整資料結構請參考 [API_SPEC.md](./API_SPEC.md)

## 🎨 設計特色

### 卡片式設計
- 現代化的卡片佈局
- 流暢的橫向/縱向滾動
- Scroll Snap 對齊效果

### 互動體驗
- 底部滑出式篩選彈窗
- 地圖與卡片聯動
- 愛心收藏動畫
- Loading 與 Error 狀態

### 響應式設計
- 適配手機、平板
- Touch 友好的操作
- 流暢的動畫過渡

## 📦 專案結構

```
art-pass/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 首頁
│   ├── explore/           # 找展演
│   ├── nearby/            # 找身邊
│   ├── passport/          # 找記憶
│   └── api/               # API Routes
│
├── components/            # 共用組件
│   ├── EventCard.tsx     # 展演卡片（核心組件）
│   ├── FilterSheet.tsx   # 篩選彈窗
│   ├── MapView.tsx       # 地圖組件
│   └── ui/               # 基礎 UI 組件
│
├── lib/                   # 工具函數
│   ├── types.ts          # TypeScript 型別
│   ├── utils.ts          # 通用工具
│   ├── storage.ts        # LocalStorage 封裝
│   └── geo.ts            # 地理計算
│
├── hooks/                 # 自訂 Hooks
│   ├── useFavorites.ts   # 收藏功能
│   └── useMemories.ts    # 觀展記錄
│
└── public/
    └── data/
        └── events.json    # 測試資料
```

## 🎯 開發階段

### ✅ Phase 1: 基礎設施
- 型別定義
- API 路由骨架
- 共用組件
- LocalStorage 封裝

### ⏳ Phase 2: 首頁
- 頁面佈局
- 橫向滾動實作
- 熱門/近期展演

### ⏳ Phase 3: 找展演
- 列表頁面
- 篩選功能
- 篩選彈窗

### ⏳ Phase 4: 找身邊
- Google Maps 整合
- 地圖與卡片聯動
- 智能場館切換

### ⏳ Phase 5: 找記憶
- 時間軸設計
- 觀展記錄
- 統計數據

### ⏳ Phase 6: 收藏功能
- 收藏按鈕
- 狀態管理

### ⏳ Phase 7: 優化
- 響應式調整
- 動畫效果
- 效能優化

## 🔑 環境變數

創建 `.env.local` 檔案：

```bash
# Google Maps API Key (必填)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here

# API Base URL (可選)
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# 資料來源路徑 (可選)
DATA_SOURCE_PATH=public/data/events.json
```

## 🧪 測試

```bash
# 開發環境
npm run dev

# 建置測試
npm run build
npm run start

# 型別檢查
npx tsc --noEmit

# Linting
npm run lint
```

## 📱 Flutter 整合

在 TownPass 中使用 WebView 載入：

```dart
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

InAppWebView(
  initialUrlRequest: URLRequest(
    url: WebUri('http://localhost:3000')  // 開發
    // url: WebUri('https://art-pass.app')  // 正式
  ),
  initialOptions: InAppWebViewGroupOptions(
    crossPlatform: InAppWebViewOptions(
      javaScriptEnabled: true,
    ),
  ),
)
```

## 🎨 MVP 範圍

### ✅ 包含功能
- 4 個核心頁面
- 基本篩選
- 收藏功能（LocalStorage）
- 觀展記錄（LocalStorage）
- Google Maps 整合
- 響應式設計

### ❌ 未來功能
- 用戶登入/註冊
- 後端資料庫
- 社交分享
- 評論/評分
- 通知推播
- 搜尋功能
- 多語言支援

## 🤝 開發團隊

**2025 Hackathon Team**

## 📄 授權

MIT License

---

## 🎉 開始開發

準備好了嗎？從 **[QUICK_START.md](./QUICK_START.md)** 開始你的開發之旅！

---

**最後更新**: 2025/11/08  
**版本**: MVP v1.0  
**狀態**: 📝 規劃完成，開發中

