// app/nearby/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCENT = "rgb(90, 180, 197)";

// 先用 3 個台北的美術館
const MUSEUMS = [
  { name: "台北市立美術館", lat: 25.0726, lng: 121.5240 },
  { name: "台北當代藝術館", lat: 25.0496, lng: 121.5169 },
  { name: "國立故宮博物院", lat: 25.1024, lng: 121.5485 },
];

export default function NearbyPage() {
  const router = useRouter();

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);          // Leaflet.Map
  const userMarkerRef = useRef<any>(null);   // Leaflet.Marker
  const userCircleRef = useRef<any>(null);   // Leaflet.Circle
  const watchIdRef = useRef<number | null>(null);

  const [hasGeo, setHasGeo] = useState(false);

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    (async () => {
      // 動態載入，避免 SSR "window is not defined"
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      // 修正 Next.js 下 Leaflet 預設圖示無法載入（改用 CDN）
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // 初始中心抓第一個點
      const initial = MUSEUMS[0];
      const map = L.map(mapDivRef.current, {
        center: [initial.lat, initial.lng],
        zoom: 12,
        zoomControl: true,
      });
      mapRef.current = map;

      // OSM 公共磚塊
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // 放三個美術館點
      MUSEUMS.forEach((p) => {
        L.marker([p.lat, p.lng]).addTo(map).bindPopup(`<b>${p.name}</b>`);
      });

      // 讓地圖以目前容器尺寸重算（避免 flex 佈局下初始閃爍）
      setTimeout(() => map.invalidateSize(), 0);

      // 嘗試抓使用者座標
      if (navigator.geolocation) {
        setHasGeo(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            placeOrUpdateUser(pos.coords.latitude, pos.coords.longitude, true);
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            placeOrUpdateUser(pos.coords.latitude, pos.coords.longitude, false);
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000 }
        );
      }

      function placeOrUpdateUser(lat: number, lng: number, fly: boolean) {
        const map = mapRef.current!;
        if (!userMarkerRef.current) {
          userMarkerRef.current = L.marker([lat, lng], {
            title: "你的位置",
          }).addTo(map);
          userCircleRef.current = L.circle([lat, lng], {
            radius: 60,
            color: ACCENT,
            fillColor: ACCENT,
            fillOpacity: 0.15,
            weight: 1,
          }).addTo(map);
        } else {
          userMarkerRef.current.setLatLng([lat, lng]);
          userCircleRef.current?.setLatLng([lat, lng]);
        }
        if (fly) map.flyTo([lat, lng], 14, { duration: 0.8 });
      }
    })();

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const locateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current!.flyTo([latitude, longitude], 15, { duration: 0.6 });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  return (
    <div className="min-h-dvh w-full bg-neutral-50 flex flex-col">
      {/* 置頂標題列（在最上面） */}
      <div className="w-full">
        <div className="mx-auto max-w-[420px] px-3">
          <header className="mt-3 mb-3 h-12 flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 shadow-sm">
            <div className="text-base font-semibold text-neutral-800 text-center">
              藝文地圖
            </div>
            <div className="w-12" />
          </header>
        </div>
      </div>

      {/* 地圖區（佔滿剩餘高度） */}
      <div className="relative flex-1">
        <div
          ref={mapDivRef}
          className="h-full w-full overflow-hidden bg-neutral-200"
        />

        {/* 右下角浮動鈕：定位到我 */}
        <button
          onClick={locateMe}
          className="absolute bottom-5 right-4 z-50 grid h-12 w-12 place-items-center rounded-full text-white shadow-lg active:scale-95"
          style={{ backgroundColor: ACCENT, opacity: hasGeo ? 1 : 0.6 }}
          title={hasGeo ? "定位到我" : "此裝置不支援定位"}
          aria-label="定位到我"
        >
          📍
        </button>
      </div>
    </div>
  );
}