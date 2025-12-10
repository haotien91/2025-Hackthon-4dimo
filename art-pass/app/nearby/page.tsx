// app/nearby/page.tsx
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import type * as LeafletNS from "leaflet";

const ACCENT = "rgb(90, 180, 197)";
const YELLOW = "#facc15";
const RED = "#ef4444";

const MUSEUMS = [
  { name: "台北市立美術館", lat: 25.0726, lng: 121.524 },
  { name: "台北當代藝術館", lat: 25.0496, lng: 121.5169 },
  { name: "國立故宮博物院", lat: 25.1024, lng: 121.5485 },
];

const DEFAULT_BASEMAP = {
  url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  options: {
    maxZoom: 20,
    subdomains: "abcd",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
  },
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://4dimo.020908.xyz:8443";
const VENUE_API = `${API_BASE}/venue`;
const platformApiUrl = (platformName: string) => {
  const now = Math.floor(Date.now() / 1000);
  const fourteenDays = now + 14 * 24 * 60 * 60;
  return `${API_BASE}/platform/${encodeURIComponent(
    platformName
  )}?start_timestamp=${now}&end_timestamp=${fourteenDays}`;
};

type Venue = {
  platform?: string;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
};

type EventItem = {
  event_id?: string | number;
  title?: string;
  image_url?: string;
  start_datetime_iso?: string;
  end_datetime_iso?: string;
  date_time?: string;
  event_url?: string;
  venue_name?: string;
};

function ensureLeafletCss() {
  const id = "leaflet-css-cdn";
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

/* === ① Marker 點擊修復 CSS（只動到 marker pane，不碰 overlay svg） === */
function injectMarkerClickFixCSS() {
  const id = "leaflet-marker-clickfix";
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `
    .leaflet-marker-pane * { pointer-events: auto !important; }
    .leaflet-marker-icon, .leaflet-marker-shadow { pointer-events: auto !important; }
    .venue-dot-wrapper { pointer-events: auto !important; cursor: pointer; }
  `;
  document.head.appendChild(s);
}

// 距離（公里）
function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// 縮放→圓點半徑（px）
const computeRadius = (z: number) => Math.max(3, Math.min(8, 0.8 * (z - 10) + 5));

// 時間字串美化
function formatEventTime(e: EventItem) {
  const pick = e.start_datetime_iso || e.date_time || "";
  const start = pick ? new Date(pick) : null;
  const end = e.end_datetime_iso ? new Date(e.end_datetime_iso) : null;
  const fmtFull = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const fmtTime = new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const v = (d: Date | null) => (d && !isNaN(d.getTime()) ? d : null);
  const s = v(start);
  const t = v(end);

  if (s && t) {
    if (s.toDateString() === t.toDateString()) return `${fmtFull.format(s)}–${fmtTime.format(t)}`;
    return `${fmtFull.format(s)} – ${fmtFull.format(t)}`;
  }
  if (s) return fmtFull.format(s);
  return e.date_time || "";
}

const FALLBACK_NAME = "台北市立美術館";

export default function NearbyPage() {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const userMarkerRef = useRef<any>(null);
  const userCircleRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  const [hasGeo, setHasGeo] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const venueMarkersRef = useRef<any[]>([]); // L.Marker (DivIcon)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const [userLL, setUserLL] = useState<{ lat: number; lng: number } | null>(null);
  const didGeoAutoPickRef = useRef(false);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [evIdx, setEvIdx] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(false);

  const sortedVenueIdxRef = useRef<number[]>([]);
  const evAbortRef = useRef<AbortController | null>(null);

  const hitCirclesRef = useRef<any[]>([]);
  // 讓 Leaflet 事件永遠讀到最新資料
  const venuesRef = useRef<Venue[]>([]);
  useEffect(() => { venuesRef.current = venues; }, [venues]);

  const selectedIdxRef = useRef<number | null>(null);
  useEffect(() => { selectedIdxRef.current = selectedIdx; }, [selectedIdx]);

  useEffect(() => {
    selectVenueRef.current = async (i: number, fly = false) => {
      const v = venuesRef.current[i];
      if (!mapRef.current || !v) return; // 用最新 venuesRef

      setSelectedIdx(i);
      recolor(i);

      if (hasLatLng(v) && fly) {
        mapRef.current.flyTo([v.latitude as number, v.longitude as number], 14, { duration: 0.5 });
      }

      setEventsLoading(true);
      setEvIdx(0);

      if (evAbortRef.current) evAbortRef.current.abort();
      const ac = new AbortController();
      evAbortRef.current = ac;

      try {
        const url = platformApiUrl(v.platform || "");
        const res = await fetch(url, { cache: "no-store", signal: ac.signal });
        if (res.status === 404) {
          setEvents([]);
        } else {
          const text = await res.text();
          const cleaned = text.trim().replace(/%+$/, "");
          const arr: EventItem[] = cleaned ? JSON.parse(cleaned) : [];
          setEvents(Array.isArray(arr) ? arr : []);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("載入活動失敗：", e);
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    };
    // 沒有 deps：因為讀的是 *ref.current*，始終是最新
  }, []);

  // 用來存「最新版本」的 selectVenue（事件只呼叫這個 ref）
  const selectVenueRef = useRef<(i: number, fly?: boolean) => void>(() => { });
  // 提供一個穩定函式給 React 內部呼叫（會轉呼 ref）
  const selectVenue = (i: number, fly = false) => selectVenueRef.current(i, fly);


  const hasLatLng = (v?: Venue) =>
    typeof v?.latitude === "number" && typeof v?.longitude === "number";

  const orderByDistance = (u: { lat: number; lng: number }, vs: Venue[]) =>
    vs
      .map((v, i) => ({
        i,
        d: hasLatLng(v) ? distKm(u, { lat: v!.latitude as number, lng: v!.longitude as number }) : Infinity,
      }))
      .sort((a, b) => a.d - b.d)
      .map((x) => x.i);

  const firstValidIndex = (vs: Venue[]) => {
    const byName = vs.findIndex((v) => (v.platform || "").includes(FALLBACK_NAME) && hasLatLng(v));
    if (byName >= 0) return byName;
    const byCoord = vs.findIndex(hasLatLng);
    return byCoord >= 0 ? byCoord : 0;
  };

  // --- DivIcon：小圓點
  const makeVenueIcon = (diameter: number, color: string) => {
    const html = `<div class="venue-dot" style="
      width:${diameter}px;height:${diameter}px;border-radius:9999px;
      background:${color};box-shadow:0 0 0 2px #fff;"></div>`;
    return (window as any).L.divIcon({
      className: "venue-dot-wrapper",
      html,
      iconSize: [diameter, diameter],
    });
  };

  const recolor = (sel: number | null) => {
    venueMarkersRef.current.forEach((m, idx) => {
      const el: HTMLElement | null = m?.getElement?.() ?? null;
      if (!el) return;
      const dot = el.querySelector(".venue-dot") as HTMLElement | null;
      if (!dot) return;
      dot.style.background = sel === idx ? RED : YELLOW;
    });
  };

  const syncDivMarkerSize = () => {
    if (!mapRef.current) return;
    const d = Math.round(computeRadius(mapRef.current.getZoom()) * 2);

    venueMarkersRef.current.forEach((m) => {
      const el: HTMLElement | null = m?.getElement?.() ?? null;
      if (!el) return;
      el.style.width = `${d}px`;
      el.style.height = `${d}px`;
      const dot = el.querySelector(".venue-dot") as HTMLElement | null;
      if (dot) {
        dot.style.width = `${d}px`;
        dot.style.height = `${d}px`;
      }
    });

    // ✅ 命中圈半徑（比視覺點更大、好點）
    const hitR = Math.max(16, Math.round(computeRadius(mapRef.current.getZoom()) * 2.2));
    hitCirclesRef.current.forEach((h) => h && h.setRadius(hitR));

    if (userMarkerRef.current) userMarkerRef.current.setRadius(Math.max(d / 2 + 1, 4));
  };

  // === mount 初始化地圖 ===
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    (async () => {
      ensureLeafletCss();
      injectMarkerClickFixCSS(); // ① 先注入 click 修復 CSS

      const L = (await import("leaflet")).default as unknown as typeof LeafletNS;

      const el: any = mapDivRef.current;
      if (el && el._leaflet_id) {
        try { el._leaflet_id = undefined; } catch { }
        el.innerHTML = "";
      }

      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initial = MUSEUMS[0];
      const map = L.map(mapDivRef.current!, {
        center: [initial.lat, initial.lng],
        zoom: 12,
        zoomControl: true,
      });
      mapRef.current = map;
      setMapReady(true);

      L.tileLayer(DEFAULT_BASEMAP.url, DEFAULT_BASEMAP.options).addTo(map);

      const onZoom = () => { syncDivMarkerSize(); };
      map.on("zoomend", onZoom);
      map.once("unload", () => map.off("zoomend", onZoom));

      requestAnimationFrame(() => {
        map.invalidateSize();
        syncDivMarkerSize();
      });

      // 載入場地
      const venueAbort = new AbortController();
      try {
        const res = await fetch(VENUE_API, { cache: "no-store", signal: venueAbort.signal });
        const text = await res.text();
        const cleaned = text.trim().replace(/%+$/, "");
        const list: Venue[] = (JSON.parse(cleaned) || []) as Venue[];
        setVenues(list);

        const pts: [number, number][] = [];
        venueMarkersRef.current = [];
        const diameter = Math.round(computeRadius(map.getZoom()) * 2);

        list.forEach((v, i) => {
          if (!hasLatLng(v)) return;
          const ll: [number, number] = [v.latitude as number, v.longitude as number];
          pts.push(ll);

          const marker = (L as any)
            .marker(ll, {
              icon: makeVenueIcon(diameter, YELLOW),
              interactive: true,
              keyboard: false,
              bubblingMouseEvents: true,
              zIndexOffset: 1000,
              riseOnHover: true,
            })
            .addTo(map)
            .on("click", () => selectVenueRef.current(i, true));

          // ✅ 透明可點擊圈（比較好點、也不受 overlay 影響）
          const hit = (L as any)
            .circleMarker(ll, {
              radius: 16,           // 命中半徑，下面會跟著 zoom 調整
              stroke: false,
              fill: true,
              fillColor: "#000",
              fillOpacity: 0.001,       // 完全透明，但仍可接收事件
              interactive: true,
              bubblingMouseEvents: false, // 避免點到後又冒泡到 map click
            })
            .addTo(map)
            .on("click", () => selectVenueRef.current(i, true))
            .on("mouseover", () => map.getContainer().style.cursor = "pointer")
            .on("mouseout", () => map.getContainer().style.cursor = "");

          venueMarkersRef.current[i] = marker;
          hitCirclesRef.current[i] = hit;
        });

        recolor(selectedIdx);
        if (pts.length && (L as any).latLngBounds) {
          map.fitBounds((L as any).latLngBounds(pts).pad(0.06));
        }
        syncDivMarkerSize();
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("載入場地失敗：", e);
      }

      // 取得使用者座標
      if (navigator.geolocation) {
        setHasGeo(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => { placeOrUpdateUser(pos.coords.latitude, pos.coords.longitude, true); },
          () => { },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => { placeOrUpdateUser(pos.coords.latitude, pos.coords.longitude, false); },
          () => { },
          { enableHighAccuracy: true, maximumAge: 5000 }
        );
      }

      function placeOrUpdateUser(lat: number, lng: number, fly: boolean) {
        setUserLL({ lat, lng });
        if (!mapRef.current) return;
        if (!userMarkerRef.current) {
          userMarkerRef.current = (L as any)
            .circleMarker([lat, lng], {
              radius: Math.max(computeRadius(map.getZoom()) + 1, 4),
              stroke: false,
              fillColor: ACCENT,
              fillOpacity: 1,
            })
            .addTo(map);
          userCircleRef.current = (L as any)
            .circle([lat, lng], {
              radius: 60,
              color: ACCENT,
              fillColor: ACCENT,
              fillOpacity: 0.15,
              weight: 1,
            })
            .addTo(map);
        } else {
          userMarkerRef.current.setLatLng([lat, lng]);
          userCircleRef.current?.setLatLng([lat, lng]);
        }
        if (fly) map.flyTo([lat, lng], 14, { duration: 0.8 });
      }

      function selectNearestVenueAt(latlng: { lat: number; lng: number }) {
        const map = mapRef.current;
        if (!map || !venues.length) return;
        map.on("click", (e: any) => selectNearestVenueAt(e.latlng));
        const p = map.latLngToLayerPoint(latlng);

        let bestI = -1;
        let bestD = Infinity;
        venues.forEach((v, i) => {
          if (!hasLatLng(v)) return;
          const q = map.latLngToLayerPoint([v.latitude as number, v.longitude as number]);
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d < bestD) { bestD = d; bestI = i; }
        });

        // 門檻（像素）：越放大門檻越小、越縮小門檻越大
        const pxThreshold = Math.max(20, computeRadius(map.getZoom()) * 3);
        if (bestI >= 0 && bestD <= pxThreshold) {
          selectVenue(bestI, true);
        }
      }

      return () => {
        try {
          venueAbort.abort();
          if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
          mapRef.current?.off();
          mapRef.current?.remove();
        } finally {
          mapRef.current = null;
          setMapReady(false);
        }
      };
    })();
  }, []);

  // === 自動選擇 ===
  useEffect(() => {
    if (!mapReady || !venues.length) return;

    if (userLL) {
      const order = orderByDistance(userLL, venues).filter((i) => !!venueMarkersRef.current[i]);
      if (order.length) {
        sortedVenueIdxRef.current = order;
        if (selectedIdx === null || !didGeoAutoPickRef.current) {
          selectVenue(order[0], true);
          didGeoAutoPickRef.current = true;
        }
      }
      return;
    }

    if (selectedIdx === null) {
      const idx = firstValidIndex(venues);
      sortedVenueIdxRef.current = venues.map((_, i) => i);
      selectVenue(idx, true);
    }
  }, [mapReady, venues, userLL, selectedIdx]);

  const gotoNeighborVenue = (dir: -1 | 1) => {
    if (selectedIdx === null) return;
    const rawOrder = sortedVenueIdxRef.current.length
      ? sortedVenueIdxRef.current
      : venues.map((_, idx) => idx);
    const order = rawOrder.filter((i) => !!venueMarkersRef.current[i]);
    if (!order.length) return;
    const pos = order.indexOf(selectedIdx);
    const nextPos = pos === -1 ? 0 : (pos + dir + order.length) % order.length;
    selectVenue(order[nextPos], true);
  };

  const moveLeft = () => {
    if (!events.length) { gotoNeighborVenue(-1); return; }
    if (evIdx > 0) setEvIdx((x) => x - 1);
    else gotoNeighborVenue(-1);
  };

  const moveRight = () => {
    if (!events.length) { gotoNeighborVenue(1); return; }
    if (evIdx < events.length - 1) setEvIdx((x) => x + 1);
    else gotoNeighborVenue(1);
  };

  const locateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current!.flyTo([latitude, longitude], 15, { duration: 0.6 });
      },
      () => { },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const selectedVenueName = useMemo(
    () => (selectedIdx != null ? (venues[selectedIdx]?.platform || "") : ""),
    [selectedIdx, venues]
  );

  // === 活動卡 ===
  const CurrCard = () => {
    if (eventsLoading) {
      return (
        <div className="h-[220px] grid place-items-center text-sm text-neutral-500">
          載入中…
        </div>
      );
    }

    const hasEv = !!events.length;
    const isLastSlide = hasEv ? evIdx === events.length - 1 : true;
    const e = hasEv ? (events[evIdx] || {}) : {};

    return (
      <div className="w-full">
        <div className="relative w-full overflow-hidden rounded-xl">
          {e.image_url ? (
            <a href={e.event_url}>
              <img
                src={e.image_url}
                alt={e.title || ""}
                className="w-full aspect-[16/9] object-cover"
                loading="lazy"
                onError={(ev) => ((ev.currentTarget as HTMLImageElement).style.display = "none")}
              />
            </a>
          ) : (
            <div className="w-full aspect-[16/9] bg-neutral-200" />
          )}

          <div className="pointer-events-none absolute inset-y-0 left-0 w-35 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-35 bg-gradient-to-l from-black/60 via-black/20 to-transparent" />


          {/* 透明遮罩：擴大「不可點擊（不穿透）」區域 */}
          <div
            className="absolute inset-y-0 left-0 w-28 z-20 bg-transparent pointer-events-auto"
            onPointerDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 right-0 w-28 z-20 bg-transparent pointer-events-auto"
            onPointerDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
            aria-hidden
          />
          <button
            onClick={moveLeft}
            className="absolute left-1 top-1/2 -translate-y-1/2 p-1 text-2xl text-white select-none z-30"
            aria-label="上一張或上一個地點"
            title="上一張或上一個地點"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,.6)" }}
          >
            ←
          </button>

          {!isLastSlide ? (
            <button
              onClick={moveRight}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-2xl text-white select-none z-30"
              aria-label="下一張"
              title="下一張"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,.6)" }}
            >
              →
            </button>
          ) : (
            <button
              onClick={moveRight}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-white select-none leading-none z-30"
              aria-label="下一個地點"
              title="下一個地點"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,.6)" }}
            >
              <span className="block text-[15px] font-bold">N</span>
              <span className="block text-[15px] font-bold -mt-0.5">E</span>
              <span className="block text-[15px] font-bold -mt-0.5">X</span>
              <span className="block text-[15px] font-bold -mt-0.5">T</span>
            </button>
          )}
        </div>

        <div className="mt-3">
          <div
            className="truncate text-[15px] font-semibold text-neutral-900"
            title={e.title || (hasEv ? "未命名活動" : "這個場地目前沒有活動")}
          >
            {e.title || (hasEv ? "未命名活動" : "這個場地目前沒有活動")}
          </div>
          <div className="mt-1 text-[12px] text-neutral-600">
            {hasEv ? formatEventTime(e) : ""}
          </div>
        </div>
      </div>
    );
  };

  const pagerText = eventsLoading ? "載入中…" : events.length ? `${evIdx + 1} / ${events.length}` : "—";

  return (
    <div className="min-h-dvh w-full bg-neutral-50 flex flex-col">
      <div className="w-full">
        <div className="mx-auto max-w-[420px] px-3">
          <header className="mt-3 mb-3 h-12 flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 shadow-sm">
            <div className="w-12" />
            <div className="text-base font-semibold text-neutral-800 text-center">藝文地圖</div>
            <div className="w-12" />
          </header>
        </div>
      </div>

      <div className="relative flex-1">
        <div
          ref={mapDivRef}
          className="w-full overflow-hidden bg-neutral-200"
          style={{ height: "calc(100dvh - 72px)" }}
        />

        {selectedVenueName && (
          <div className="pointer-events-none absolute left-1/2 z-[1100] top-[8px] -translate-x-1/2">
            <div className="pointer-events-auto rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-sm text-neutral-800 shadow-sm backdrop-blur whitespace-nowrap max-w-[90vw]">
              {selectedVenueName}
            </div>
          </div>
        )}

        <button
          onClick={locateMe}
          className="absolute bottom-5 right-4 z-[1100] grid h-12 w-12 place-items-center rounded-full text-white shadow-lg active:scale-95"
          style={{ backgroundColor: ACCENT, opacity: hasGeo ? 1 : 0.6 }}
          title={hasGeo ? "定位到我" : "此裝置不支援定位"}
          aria-label="定位到我"
        >
          📍
        </button>

        {selectedIdx != null && (
          <div className="pointer-events-none absolute left-0 right-0 bottom-0 z-[1100]">
            <div className="pointer-events-auto mx-auto max-w-[480px] px-3 pb-4">
              <div className="rounded-2xl border border-neutral-200 bg-white/95 shadow-lg backdrop-blur p-3">
                <CurrCard />
                <div className="mt-2 text-center text-xs text-neutral-500">{pagerText}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}