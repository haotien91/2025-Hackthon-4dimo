// app/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
import UidLink from "@/components/uid-link";
import { Ticket, Map, Search } from "lucide-react";
import MorphDialog, { type MorphOrigin, type MorphDialogEvent } from "@/components/passport/morph-dialog";

// ====== 可調整 ======
const BRAND = "rgb(90, 180, 197)";
const API_BASE = "https://4dimo.020908.xyz:8443"; // 統一走 8000
const HERO_ASPECT = "aspect-[16/8]";
const AUTOPLAY_MS = 3000;
const DEFAULT_TZ = "Asia/Taipei";

function toDate(iso?: string, ts?: number) {
  if (iso) return new Date(iso);
  if (typeof ts === "number") return new Date(ts * 1000);
  return null;
}

function fmtDate(d: Date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function fmtTime(d: Date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

function sameYMD(a: Date, b: Date, tz = DEFAULT_TZ) {
  // 用格式化後的字串比，避免時區落差
  return fmtDate(a, tz) === fmtDate(b, tz);
}

/** 只顯示日期：YYYY/MM/DD 或 YYYY/MM/DD - YYYY/MM/DD */
function formatDateRangeOnly(e: EventItem) {
  const tz = e.event_timezone || DEFAULT_TZ;
  const s = toDate(e.start_datetime_iso, e.start_timestamp);
  const t = toDate(e.end_datetime_iso, e.end_timestamp);
  if (s && t) {
    return sameYMD(s, t, tz) ? fmtDate(s, tz) : `${fmtDate(s, tz)} - ${fmtDate(t, tz)}`;
  }
  if (s) return fmtDate(s, tz);
  if (t) return fmtDate(t, tz);
  return e.date_time || "";
}

/** 智慧時間：同日顯示「日期 HH:mm - HH:mm」，跨日顯示「日期 - 日期」 */
function formatSmartRange(e: EventItem) {
  const tz = e.event_timezone || DEFAULT_TZ;
  const s = toDate(e.start_datetime_iso, e.start_timestamp);
  const t = toDate(e.end_datetime_iso, e.end_timestamp);
  if (s && t) {
    if (sameYMD(s, t, tz)) {
      return `${fmtDate(s, tz)} ${fmtTime(s, tz)} - ${fmtTime(t, tz)}`;
    }
    return `${fmtDate(s, tz)} - ${fmtDate(t, tz)}`;
  }
  if (s) return `${fmtDate(s, tz)} ${fmtTime(s, tz)}`;
  if (t) return `${fmtDate(t, tz)} ${fmtTime(t, tz)}`;
  return e.date_time || "";
}

// ====== 工具：抓 API，容錯去掉收尾多餘的 % ======
async function fetchEvents(url: string): Promise<unknown[]> {
  try {
    const res = await fetch(url);
    const text = await res.text();
    const cleaned = text.trim().replace(/%+$/, "");
    const json = JSON.parse(cleaned);
    return Array.isArray(json) ? json : [];
  } catch (e) {
    console.error("fetchEvents error:", e);
    return [];
  }
}

type EventItem = {
  event_id?: string | number;
  image_url?: string;
  title?: string;
  detail_page_url?: string;

  start_datetime_iso?: string;
  end_datetime_iso?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  event_timezone?: string;

  date_time?: string;
  venue_name?: string;
};

// 取得 event id（兼容多種欄位）
function getEventId(e: Partial<EventItem> & Record<string, unknown>) {
  return e.event_id ?? e.id ?? e.eventId;
}

// ====== 輪播（自動播放、左右滑、點圓點、可點進 template） ======
function Swiper({
  slides,
  aspectClass = HERO_ASPECT,
  autoMs = AUTOPLAY_MS,
  onSlideClick,
}: {
  slides: { src: string; id?: string | number }[];
  aspectClass?: string;
  autoMs?: number;
  onSlideClick?: (id: string, el: HTMLElement) => void;
}) {
  const [idx, setIdx] = useState(0);
  const n = slides.length;

  const timerRef = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const pause = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  const resume = () => {
    if (n <= 1 || timerRef.current) return;
    timerRef.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % n);
    }, autoMs);
  };

  useEffect(() => {
    resume();
    return pause;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, autoMs]);

  const go = (to: number) => setIdx(((to % n) + n) % n);
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    containerRef.current?.setPointerCapture?.(e.pointerId);
    pause();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    const TH = 32;
    if (dx > TH) prev();
    if (dx < -TH) next();
    startX.current = null;
    resume();
  };
  const onPointerCancel = () => {
    startX.current = null;
    resume();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
      <div
        ref={containerRef}
        className={`relative w-full ${aspectClass} bg-neutral-200 touch-pan-y select-none`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {slides.map((s, i) => (
          <span
            key={`${s.src}-${i}`}
            className={`absolute inset-0 block ${i === idx ? "pointer-events-auto" : "pointer-events-none"}`}
            onClick={s.id != null && onSlideClick ? (ev) => onSlideClick(String(s.id!), ev.currentTarget as HTMLElement) : undefined}
            role={s.id != null && onSlideClick ? "button" : undefined}
          >
            <img
              src={s.src}
              alt=""
              loading="lazy"
              className={`h-full w-full object-cover transition-opacity duration-500 ${i === idx ? "opacity-100" : "opacity-0"}`}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </span>
        ))}

        {n > 1 && (
          <>
            {/* 左右隱形點擊區（桌機可點） */}
            <button
              aria-label="上一張"
              onClick={prev}
              className="absolute inset-y-0 left-0 w-1/4 opacity-0 active:opacity-10"
            />
            <button
              aria-label="下一張"
              onClick={next}
              className="absolute inset-y-0 right-0 w-1/4 opacity-0 active:opacity-10"
            />
            {/* 圓點 */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  className={`h-1.5 w-1.5 rounded-full transition ${
                    i === idx ? "bg-white" : "bg-white/50"
                  }`}
                  aria-label={`slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ====== 條列卡片（圖片上、資訊下） → 點擊先到 /template?id=xxx ======
function EventCard({
  e,
  onCardClick,
}: {
  e: EventItem;
  onCardClick?: (e: EventItem, el: HTMLElement) => void;
}) {
  const img = e.image_url ?? "";
  const venue = e.venue_name ?? "";
  const timeText = formatDateRangeOnly(e);

  const body = (
    <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
      <div className="w-full aspect-[16/9] bg-neutral-200">
        {img ? (
          <img
            src={img}
            alt={e.title ?? ""}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : null}
      </div>
      <div className="px-3.5 py-3">
        <div className="text-[15px] font-semibold text-neutral-900 line-clamp-2">
          {e.title || "未命名活動"}
        </div>

        {timeText && <div className="mt-1 text-sm text-neutral-600">{timeText}</div>}
        {venue && <div className="mt-0.5 text-sm text-neutral-500">{venue}</div>}
      </div>
    </div>
  );

  return (
    <div
      className="block cursor-pointer"
      onClick={(ev) => onCardClick?.(e, ev.currentTarget as HTMLElement)}
    >
      {body}
    </div>
  );
}

export default function HomePage() {
  const [recent, setRecent] = useState<EventItem[]>([]);
  const [random, setRandom] = useState<EventItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingRandom, setLoadingRandom] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<MorphDialogEvent | null>(null);
  const [dialogOrigin, setDialogOrigin] = useState<MorphOrigin | null>(null);
  const [passportEventIds, setPassportEventIds] = useState<Set<string>>(new Set());
  const uid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("uid") || "" : "";

  // ====== 抓 /hot（上方：輪播） ======
  useEffect(() => {
    (async () => {
      setLoadingRecent(true);
      const data = await fetchEvents(`${API_BASE}/hot`);
      setRecent(data.slice(0, 6) as EventItem[]);
      setLoadingRecent(false);
    })();
  }, []);

  // ====== 抓 /recent（下方：條列） ======
  useEffect(() => {
    (async () => {
      setLoadingRandom(true);
      const data = await fetchEvents(`${API_BASE}/recent`);
      // 條列給多一點，讓頁面可往下捲
      setRandom(data.slice(0, 12) as EventItem[]);
      setLoadingRandom(false);
    })();
  }, []);

  // 護照初始載入
  useEffect(() => {
    (async () => {
      if (!uid) return;
      try {
        const url = `${API_BASE}/users/${encodeURIComponent(uid)}/passport`;
        const res = await fetch(url);
        const text = await res.text();
        const cleaned = text.trim().replace(/%+$/, "");
        const json = JSON.parse(cleaned);
        const s = new Set<string>();
        if (Array.isArray(json)) {
          // 兼容：直接回傳陣列（可能是字串 event_id 或物件）
          for (const it of json) {
            if (typeof it === "string") s.add(it);
            else if (it && typeof it === "object" && (it as any).event_id != null) s.add(String((it as any).event_id));
          }
        } else if (json && typeof json === "object" && Array.isArray(json.passport)) {
          // 物件形式：{ passport: [{ event_id, added_at }], ... }
          for (const it of json.passport) {
            if (it?.event_id != null) s.add(String(it.event_id));
          }
        }
        setPassportEventIds(s);
      } catch (e) {
        console.warn("fetch passport error:", e);
      }
    })();
  }, [uid]);

  const handlePassportChange = (eventId: string, added: boolean) => {
    setPassportEventIds((prev) => {
      const next = new Set(prev);
      if (added) next.add(eventId);
      else next.delete(eventId);
      return next;
    });
  };

  async function fetchEventById(eventId: string): Promise<MorphDialogEvent | null> {
    try {
      const url = `${API_BASE}/event/${encodeURIComponent(eventId)}`;
      const res = await fetch(url);
      const text = await res.text();
      const cleaned = text.trim().replace(/%+$/, "");
      const data = JSON.parse(cleaned);
      return {
        event_id: data.event_id ?? data.id ?? eventId,
        image_url: data.image_url ?? data.cover ?? data.image ?? data.image_url_preview ?? "",
        title: data.title ?? "",
        category: data.category ?? "",
        venue_name: data.venue_name ?? data.venue ?? data.place ?? "",
        date_time: data.date_time ?? "",
        start_datetime_iso: data.start_datetime_iso ?? data.start_datetime ?? "",
        end_datetime_iso: data.end_datetime_iso ?? data.end_datetime ?? "",
        start_timestamp: data.start_timestamp ?? data.start_time,
        end_timestamp: data.end_timestamp ?? data.end_time,
        event_timezone: data.event_timezone ?? data.timezone ?? "Asia/Taipei",
        event_description: data.event_description ?? data.description ?? data.summary ?? data.content ?? "",
        organizer: data.organizer ?? data.organizer_name ?? "",
        ticket_type: data.ticket_type ?? "",
        ticket_price: data.ticket_price ?? "",
        ticket_url: data.ticket_url ?? "",
        contact_person: data.contact_person ?? "",
        contact_phone: data.contact_phone ?? "",
        event_url: data.event_url ?? data.url ?? "",
      };
    } catch (err) {
      console.error("fetchEventById error:", err);
      return null;
    }
  }

  const handleCardClick = async (e: EventItem, el: HTMLElement) => {
    const id = getEventId(e);
    if (!id) return;
    const rect = el.getBoundingClientRect();
    setDialogOrigin({ x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height });
    const full = await fetchEventById(String(id));
    if (full) setSelectedEvent(full);
  };

  const handleSlideClick = async (idStr: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setDialogOrigin({ x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height });
    const full = await fetchEventById(String(idStr));
    if (full) setSelectedEvent(full);
  };
  // 輪播 slides：帶 id，點擊進 /template?id=xxx
  const recentSlides = recent
    .map((e) => {
      const src = e.image_url ?? "";
      const id = getEventId(e);
      if (!src) return null;
      return { src, id };
    })
    .filter(Boolean) as { src: string; id?: string | number }[];

  return (
    <div className="min-h-1 w-full bg-neutral-50">
      <div className="mx-auto max-w-[420px] px-4 pb-8">
        {/* 熱門展演（/recent） */}
        <section>
          <h2 className="text-xl font-bold mb-3 pt-5 text-black">熱門展演</h2>
          {loadingRecent ? (
            <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
              <div
                className={`w-full ${HERO_ASPECT} animate-pulse bg-gradient-to-br from-indigo-100 to-cyan-100`}
              />
            </div>
          ) : recentSlides.length > 0 ? (
            <Swiper slides={recentSlides} aspectClass={HERO_ASPECT} onSlideClick={handleSlideClick} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
              <div
                className={`w-full ${HERO_ASPECT} grid place-items-center text-neutral-400`}
              >
                無可用圖片
              </div>
            </div>
          )}
        </section>

        {/* 三個圓形按鈕（可上色 SVG） */}
        <section className="mt-6">
          <div className="grid grid-cols-3 gap-4 font-bold">
            <RoundBtn
              label="藝術護照"
              href="/passport"
              icon={<Ticket className="w-7 h-7" strokeWidth={2} />}
              color={BRAND}
            />
            <RoundBtn
              label="藝文地圖"
              href="/nearby"
              icon={<Map className="w-7 h-7" strokeWidth={2} />}
              color={BRAND}
            />
            <RoundBtn
              label="展覽搜尋"
              href="/search"
              icon={<Search className="w-7 h-7" strokeWidth={2} />}
              color={BRAND}
            />
          </div>
        </section>

        {/* 近期展演（/random → 條列） */}
        <section className="mt-4">
          <h2 className="text-xl font-bold mb-3 pt-2 text-black">近期展演</h2>

          {loadingRandom ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm"
                >
                  <div className="w-full aspect-[16/9] animate-pulse bg-gradient-to-br from-amber-100 to-rose-100" />
                  <div className="p-3">
                    <div className="h-4 w-2/3 rounded bg-neutral-200" />
                    <div className="mt-2 h-3 w-1/3 rounded bg-neutral-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : random.length > 0 ? (
            <div className="space-y-4">
              {random.map((e, i) => (
                <EventCard
                  e={e}
                  key={String(getEventId(e) ?? e.detail_page_url ?? e.title ?? i)}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-neutral-500">目前沒有資料</div>
          )}
        </section>

        {/* CTA：搜尋更多展演 */}
        <UidLink
          href={{ pathname: "/search", query: { openFilter: "1" } }}
          className="mt-3 mb-2 block rounded-xl border border-neutral-200 px-1 py-2 text-center text-xs font-medium text-neutral-500 bg-white shadow-sm active:scale-95"
        >
          沒看到想看的嗎？搜尋更多展演
        </UidLink>
      </div>
      {selectedEvent && dialogOrigin && (
        <MorphDialog
          open={!!selectedEvent}
          event={selectedEvent}
          origin={dialogOrigin}
          onClose={() => {
            setSelectedEvent(null);
            setDialogOrigin(null);
          }}
          maxHeight={900}
          showAll={true}
          dateOnImage={true}
          organizerOverlay={true}
          organizerInContent={false}
          centerContact={true}
          centerVisitButton={true}
          enableFootprint={true}
          apiBase={API_BASE}
          isInPassport={!!(selectedEvent?.event_id && passportEventIds.has(String(selectedEvent.event_id)))}
          onPassportChange={handlePassportChange}
        />
      )}
    </div>
  );
}

function RoundBtn({
  label,
  href,
  icon,
  color = BRAND,
}: {
  label: string;
  href: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <UidLink
      href={href}
      className="flex flex-col items-center gap-3 text-neutral-800 no-underline"
    >
      <div
        className="grid size-16 place-items-center rounded-full border border-neutral-200 bg-white shadow-sm transition hover:shadow"
        style={{ color }}
      >
        {icon /* 使用 currentColor，因此會吃到上層 color */}
      </div>
      <div className="text-sm">{label}</div>
    </UidLink>
  );
}