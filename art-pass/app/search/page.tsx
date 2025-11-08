// app/search/page.tsx
"use client";

import { useEffect, useRef, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import UidLink from "@/components/uid-link";
import MorphDialog, { type MorphOrigin, type MorphDialogEvent } from "@/components/passport/morph-dialog";

/* ========= 可調整 ========= */
const ACCENT = "rgb(90, 180, 197)";
const API_BASE = "http://142.91.103.69:8000";
const PAGE_SIZE = 10;

/* ========= UI 常數 ========= */
const CATEGORIES = [
  "全部","表演藝術","展覽","音樂現場","講座","電影",
  "城市生活圈","親子活動","城外行腳","專題特區","封面故事",
] as const;

const PRICE_OPTS = ["全部", "免費", "售票", "索票"] as const;
const TIME_OPTS  = ["今日", "明日", "近30日", "本星期", "週末"] as const;

const DEFAULTS = {
  categories: new Set<string>(["全部"]),
  prices: new Set<string>(["全部"]),
  times: new Set<string>(),
};

/* ========= 型別 ========= */
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
  return e.event_id ?? (e as any)?.id ?? (e as any)?.eventId ?? e.detail_page_url;
}

/* ========= 共用：時間格式 ========= */
const DEFAULT_TZ = "Asia/Taipei";
function toDate(iso?: string, ts?: number) {
  if (iso) return new Date(iso);
  if (typeof ts === "number") return new Date(ts * 1000);
  return null;
}
function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: DEFAULT_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}
function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: DEFAULT_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}
function sameYMD(a: Date, b: Date) { return fmtDate(a) === fmtDate(b); }
function formatDateRangeOnly(e: EventItem) {
  const s = toDate(e.start_datetime_iso, e.start_timestamp);
  const t = toDate(e.end_datetime_iso, e.end_timestamp);
  if (s && t) return sameYMD(s, t) ? fmtDate(s) : `${fmtDate(s)} - ${fmtDate(t)}`;
  if (s) return fmtDate(s);
  if (t) return fmtDate(t);
  return e.date_time || "";
}

/* ========= 工具：時間區間計算（本地時區） ========= */
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
function endOfDay(d: Date)   { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function toSec(d: Date) { return Math.floor(d.getTime() / 1000); }

function useDelayedVisible(active: boolean, delayMs = 1000) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setVisible(true), delayMs);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [active, delayMs]);
  return visible;
}

function Spinner({ size = 22, className = "" }: { size?: number; className?: string }) {
  const bw = Math.max(2, Math.floor(size / 10));
  return (
    <div
      className={`inline-block animate-spin rounded-full border border-neutral-300 border-t-transparent ${className}`}
      style={{ width: size, height: size, borderWidth: bw }}
      aria-label="載入中"
    />
  );
}

/** 將多個 time tag 合併成一個 [start,end]（取最早開始、最晚結束） */
function computeTimeRange(times: Set<string>): { start?: number; end?: number } {
  if (times.size === 0) return {};
  const now = new Date();

  const ranges: Array<{ s: Date; e: Date }> = [];
  for (const t of times) {
    if (t === "今日") {
      const s = startOfDay(now);
      const e = endOfDay(now);
      ranges.push({ s, e });
    } else if (t === "明日") {
      const d = addDays(startOfDay(now), 1);
      ranges.push({ s: d, e: endOfDay(d) });
    } else if (t === "近30日") {
      const s = now;
      const e = endOfDay(addDays(now, 30));
      ranges.push({ s, e });
    } else if (t === "本星期") {
      // 以週一為週首
      const day = now.getDay() || 7; // Sun=0 -> 7
      const monday = addDays(startOfDay(now), 1 - day);
      const sunday = addDays(monday, 6);
      ranges.push({ s: monday, e: endOfDay(sunday) });
    } else if (t === "週末") {
      const dow = now.getDay(); // 0 Sun ~ 6 Sat
      const daysToSat = (6 - dow + 7) % 7;
      const sat = addDays(startOfDay(now), daysToSat);
      const sun = addDays(sat, 1);
      ranges.push({ s: sat, e: endOfDay(sun) });
    }
  }
  if (ranges.length === 0) return {};
  const minS = ranges.reduce((m, r) => (r.s < m ? r.s : m), ranges[0].s);
  const maxE = ranges.reduce((m, r) => (r.e > m ? r.e : m), ranges[0].e);
  return { start: toSec(minS), end: toSec(maxE) };
}

/* ========= API 呼叫 ========= */
async function fetchSearch(params: URLSearchParams, signal?: AbortSignal): Promise<EventItem[]> {
  const url = `${API_BASE}/search?${params.toString()}`;
  const res = await fetch(url, { signal });
  const text = await res.text();
  const cleaned = text.trim().replace(/%+$/, "");
  const json = JSON.parse(cleaned);
  return Array.isArray(json) ? json : [];
}

async function fetchPassport(uid: string): Promise<Set<string>> {
  try {
    const url = `${API_BASE}/users/${encodeURIComponent(uid)}/passport`;
    const res = await fetch(url);
    const text = await res.text();
    const cleaned = text.trim().replace(/%+$/, "");
    const json = JSON.parse(cleaned) as { passport?: Array<{ event_id: string; added_at: number }> };
    const eventIds = json.passport?.map((e) => String(e.event_id)) || [];
    return new Set(eventIds);
  } catch (err) {
    console.error("fetchPassport error:", err);
    return new Set();
  }
}

/* ========= 卡片（沿用首頁 CSS） ========= */
function EventCard({
  e,
  passportEventIds,
  onPassportChange,
  onCardClick,
}: {
  e: EventItem;
  passportEventIds?: Set<string>;
  onPassportChange?: (eventId: string, added: boolean) => void;
  onCardClick?: (e: EventItem, cardElement: HTMLElement) => void;
}) {
  const img = e.image_url ?? "";
  const venue = e.venue_name ?? "";
  const timeText = formatDateRangeOnly(e);

  // ✅ 從各種可能欄位拿 id
  const id = e.event_id ?? (e as any)?.id ?? (e as any)?.eventId;
  const eventIdStr = id ? String(id) : null;
  const isInPassport = eventIdStr ? passportEventIds?.has(eventIdStr) ?? false : false;

  const [marked, setMarked] = useState(isInPassport);
  const [posting, setPosting] = useState(false);

  // 當 passportEventIds 改變時，同步更新 marked 狀態
  useEffect(() => {
    if (eventIdStr) {
      setMarked(passportEventIds?.has(eventIdStr) ?? false);
    }
  }, [eventIdStr, passportEventIds]);

  const CardInner = (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
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
    <div className="relative">
      <button
        type="button"
        aria-label={marked ? "取消標記" : "標記為去過（暫無功能）"}
        aria-pressed={marked}
        title={marked ? "取消標記" : "標記為去過"}
        onClick={async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!id || posting) return;
          try {
            setPosting(true);
            // 從網址取得 uid
            const uid =
              typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("uid") || ""
                : "";
            if (!uid) {
              console.warn("Missing uid in URL; skip passport POST");
              return;
            }
            const eventId = String(id);

            if (!marked) {
              // 新增到 passport（POST）
              const url = `${API_BASE}/users/${encodeURIComponent(uid)}/passport?event_id=${encodeURIComponent(
                eventId
              )}`;
              console.log("[passport] POST", url);
              const res = await fetch(url, { method: "POST" });
              const text = await res.text();
              const cleaned = text.trim().replace(/%+$/, "");
              const json = JSON.parse(cleaned) as { added?: boolean; message?: string };
              const success = typeof json.added === "boolean" ? json.added : true;
              setMarked(success);
              if (success && onPassportChange) {
                onPassportChange(eventId, true);
              }
              if (json?.message) console.log("[passport]", json.message);
              return;
            }

            // 取消（DELETE）
            const delUrl = `${API_BASE}/users/${encodeURIComponent(uid)}/passport/${encodeURIComponent(
              eventId
            )}`;
            console.log("[passport] DELETE", delUrl);
            const res = await fetch(delUrl, { method: "DELETE" });
            const text = await res.text();
            const cleaned = text.trim().replace(/%+$/, "");
            const json = JSON.parse(cleaned) as { removed?: boolean; message?: string };
            const success = typeof json.removed === "boolean" ? json.removed : true;
            setMarked(!success);
            if (success && onPassportChange) {
              onPassportChange(eventId, false);
            }
            if (json?.message) console.log("[passport]", json.message);
          } catch (err) {
            console.error("passport POST error:", err);
          } finally {
            setPosting(false);
          }
        }}
        className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full shadow-md backdrop-blur
                   hover:opacity-95 active:scale-95 transition border border-neutral-200"
        style={{ backgroundColor: "#fff", color: marked ? ACCENT : "#8E8E8E" }}
      >
        <span
          className="block h-5 w-5 bg-current
                     [mask-image:url('/footprint.png')]
                     [mask-repeat:no-repeat]
                     [mask-position:center]
                     [mask-size:contain]"
          aria-hidden="true"
        />
      </button>

      {id ? (
        <div
          className="block cursor-pointer"
          onClick={(ev) => {
            if (onCardClick) {
              onCardClick(e, ev.currentTarget);
            }
          }}
        >
          {CardInner}
        </div>
      ) : (
        <div className="block cursor-not-allowed opacity-60" title="此活動缺少 ID">{CardInner}</div>
      )}
    </div>
  );
}

/* ========= 頁面 ========= */
export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-neutral-500">載入中…</div>}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);

  // 篩選狀態
  const [categories, setCategories] = useState<Set<string>>(new Set(DEFAULTS.categories));
  const [prices, setPrices]         = useState<Set<string>>(new Set(DEFAULTS.prices));
  const [times, setTimes]           = useState<Set<string>>(new Set(DEFAULTS.times));
  const [tab, setTab]               = useState<"分類" | "票價" | "時間">("分類");

  // 結果 + 分頁
  const [items, setItems]     = useState<EventItem[]>([]);
  const [offset, setOffset]   = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirst] = useState(true);

  // Passport 狀態（已標記的 event_id）
  const [passportEventIds, setPassportEventIds] = useState<Set<string>>(new Set());

  // MorphDialog 狀態
  const [selectedEvent, setSelectedEvent] = useState<MorphDialogEvent | null>(null);
  const [dialogOrigin, setDialogOrigin] = useState<MorphOrigin | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(false);

  // Fetch 完整事件詳情
  async function fetchEventById(eventId: string): Promise<MorphDialogEvent | null> {
    try {
      const url = `${API_BASE}/event/${encodeURIComponent(eventId)}`;
      const res = await fetch(url);
      const textRaw = await res.text();
      const text = textRaw.trim().replace(/%+$/, "");
      const data = JSON.parse(text);
      return {
        event_id: data.event_id ?? data.id ?? eventId,
        image_url: data.image_url ?? data.cover ?? data.image,
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

  // 處理卡片點擊
  const handleCardClick = async (e: EventItem, cardElement: HTMLElement) => {
    const id = getEventId(e);
    if (!id) return;

    const rect = cardElement.getBoundingClientRect();
    setDialogOrigin({
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    });

    setLoadingEvent(true);
    const fullEvent = await fetchEventById(String(id));
    setLoadingEvent(false);

    if (fullEvent) {
      setSelectedEvent(fullEvent);
    }
  };

  const FIRST_MIN_SPIN_MS = 1200; // 首次載入至少轉 2 秒
  const NEXT_MIN_SPIN_MS  = 800;  // 無限捲動每頁至少轉 0.6 秒（可視覺感受調整）

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 只有從首頁 CTA 帶 openFilter=1 才自動打開
  useEffect(() => {
    if (searchParams.get("openFilter") === "1") {
      setOpen(true);
      const sp = new URLSearchParams(searchParams);
      sp.delete("openFilter");
      // 確保 uid 一直保留在網址上（若有帶進來）
      const uid = searchParams.get("uid");
      if (uid && !sp.has("uid")) sp.set("uid", uid);
      const qs = sp.toString();
      router.replace(`/search${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }, [searchParams, router]);

  // Esc 關閉
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 載入 passport（當 uid 改變時）
  useEffect(() => {
    const uid = searchParams.get("uid");
    if (uid) {
      fetchPassport(uid).then((ids) => {
        setPassportEventIds(ids);
      });
    } else {
      setPassportEventIds(new Set());
    }
  }, [searchParams]);

  // Passport 變更 handler
  const handlePassportChange = useCallback((eventId: string, added: boolean) => {
    setPassportEventIds((prev) => {
      const next = new Set(prev);
      if (added) {
        next.add(eventId);
      } else {
        next.delete(eventId);
      }
      return next;
    });
  }, []);

  // 建立查詢參數
  function buildParams(nextOffset: number) {
    const sp = new URLSearchParams();
    // 類別（去掉「全部」）
    const cats = Array.from(categories).filter((c) => c !== "全部");
    cats.forEach((c) => sp.append("category", c));

    // 票價（去掉「全部」）
    const tix = Array.from(prices).filter((p) => p !== "全部");
    tix.forEach((t) => sp.append("ticket_type", t));

    // 時間（合併為一個範圍）
    const { start, end } = computeTimeRange(times);
    if (start) sp.set("start_timestamp", String(start));
    if (end)   sp.set("end_timestamp", String(end));

    // 分頁 & 排序
    sp.set("limit", String(PAGE_SIZE));
    sp.set("offset", String(nextOffset));
    sp.set("sort", "start_asc");

    return sp;
  }

  // 第一次載入（用預設條件）
  useEffect(() => {
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cancelInFlight() {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
  }

  async function loadFirstPage() {
    cancelInFlight();
    setLoading(true);
    setFirst(true);
    setHasMore(true);
    setOffset(0);
    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const params = buildParams(0);
      const start = Date.now();
      const data = await fetchSearch(params, ctrl.signal);

      // 最小轉圈 gate：確保 spinner 至少顯示 FIRST_MIN_SPIN_MS
      const elapsed = Date.now() - start;
      if (elapsed < FIRST_MIN_SPIN_MS) {
        await sleep(FIRST_MIN_SPIN_MS - elapsed);
      }
      setItems(data);
      setHasMore(data.length === PAGE_SIZE);
      setOffset(data.length);
    } catch (err) {
      console.error("search first page error:", err);
    } finally {
      setLoading(false);
      setFirst(false);
      abortRef.current = null;
    }
  }

  async function loadNextPage() {
    if (loading || !hasMore) return;
    cancelInFlight();
    setLoading(true);
    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const params = buildParams(offset);
      const start = Date.now();
      const data = await fetchSearch(params, ctrl.signal);

      // 最小轉圈 gate：確保底部 spinner 至少顯示 NEXT_MIN_SPIN_MS
      const elapsed = Date.now() - start;
      if (elapsed < NEXT_MIN_SPIN_MS) {
        await sleep(NEXT_MIN_SPIN_MS - elapsed);
      }
      setItems((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setOffset((prev) => prev + data.length);
    } catch (err) {
      console.error("search next page error:", err);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  // 觀察最底部 → 觸發載入下一頁
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting) loadNextPage();
    }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentinelRef.current, offset, hasMore, loading, categories, prices, times]);

  // ---- 切換邏輯 ----
  const toggleWithAll = (
    name: string,
    current: Set<string>,
    setState: (s: Set<string>) => void,
    allLabel = "全部"
  ) => {
    if (name === allLabel) {
      setState(new Set([allLabel]));
      return;
    }
    const next = new Set(current);
    next.delete(allLabel);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    if (next.size === 0) next.add(allLabel);
    setState(next);
  };
  const toggleCategory = (name: string) => toggleWithAll(name, categories, setCategories, "全部");
  const togglePrice    = (name: string) => toggleWithAll(name, prices, setPrices, "全部");
  const toggleTime = (name: string) => {
    const next = new Set(times);
    if (next.has(name)) next.delete(name); else next.add(name);
    setTimes(next);
  };

  const resetFilters = () => {
    setCategories(new Set(DEFAULTS.categories));
    setPrices(new Set(DEFAULTS.prices));
    setTimes(new Set(DEFAULTS.times));
    setTab("分類");
  };

  const applyAndClose = () => {
    // 重新抓第一頁
    loadFirstPage();
    setOpen(false);
  };

  // ---- 已選擇 chips（不顯示「全部」）----
  const selectedCats  = Array.from(categories).filter((c) => c !== "全部");
  const selectedPrice = Array.from(prices).filter((p) => p !== "全部");
  const selectedTime  = Array.from(times);
  const chips = [
    ...selectedCats.map((c) => ({ label: c, remove: () => toggleCategory(c) })),
    ...selectedPrice.map((p) => ({ label: p, remove: () => togglePrice(p) })),
    ...selectedTime.map((t) => ({ label: t, remove: () => toggleTime(t) })),
  ];

  return (
    <div className="min-h-dvh w-full bg-neutral-50">
      <div className="mx-auto max-w-[420px] px-4 pb-4">
        <header className="h-14 flex items-center">
          <div className="text-2xl font-bold pt-5 mt-10 mb-15 text-neutral-800">搜尋</div>
        </header>

        {/* 已選擇 chips（簡潔） */}
        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {chips.map((c, i) => (
              <span
                key={`${c.label}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                style={{ borderColor: ACCENT, color: ACCENT }}
              >
                {c.label}
                <button
                  aria-label={`清除 ${c.label}`}
                  onClick={c.remove}
                  className="rounded-full px-1 leading-none hover:bg黑/5"
                  style={{ color: ACCENT }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 結果列表 */}
        <section className="space-y-4">
          {firstLoad && (
            <div className="py-10 flex items-center justify-center text-neutral-500 text-sm">
              <Spinner />
              <span className="ml-2">載入中…</span>
            </div>
          )}

          {!firstLoad && items.length === 0 && (
            <div className="text-sm text-neutral-500">目前沒有資料</div>
          )}

          {items.map((e, i) => (
            <EventCard
              e={e}
              key={String(getEventId(e) ?? `${e.detail_page_url ?? "k"}-${i}`)}
              passportEventIds={passportEventIds}
              onPassportChange={handlePassportChange}
              onCardClick={handleCardClick}
            />
          ))}

          {/* 底部載入中 / 沒有更多 */}
          <div ref={sentinelRef} />
          {loading && !firstLoad && (
            <div className="py-3 flex items-center justify-center text-neutral-500 text-xs">
              <Spinner />
              <span className="ml-2">載入中…</span>
            </div>
          )}
          {!hasMore && items.length > 0 && (
            <div className="py-3 text-center text-xs text-neutral-400">已無更多結果</div>
          )}
        </section>
      </div>

      {/* MorphDialog for event details */}
      {selectedEvent && dialogOrigin && (
        <MorphDialog
          open={!!selectedEvent}
          event={selectedEvent}
          origin={dialogOrigin}
          onClose={() => {
            setSelectedEvent(null);
            setDialogOrigin(null);
          }}
          maxHeight={800}
          showAll={true}
          dateOnImage={true}
          organizerOverlay={true}
          organizerInContent={false}
          centerContact={true}
          centerVisitButton={true}
        />
      )}

      {/* 浮動按鈕：開啟篩選 */}
      <button
        aria-label="篩選"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-4 z-50 grid w-14 h-14 place-items-center rounded-full text-white shadow-lg active:scale-95 transition"
        style={{ backgroundColor: ACCENT }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />}

      {/* Bottom Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[420px] ${
          open ? "translate-y-0" : "translate-y-full"
        } transition-transform duration-300 will-change-transform`}
      >
        <div className="rounded-t-3xl bg-white shadow-2xl border border-neutral-200">
          <div className="px-4 pt-3">
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-neutral-200" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-2xl font-bold pt-5 text-neutral-800">篩選</h3>
              <button onClick={() => setOpen(false)} className="p-2 text-neutral-500 hover:text-neutral-700" aria-label="關閉篩選">✕</button>
            </div>
          </div>

          <div className="max-h-[60dvh] overflow-y-auto px-4 pb-20">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1 flex flex-col gap-2 pr-1">
                <TabButton label="分類" active={tab === "分類"} onClick={() => setTab("分類")} />
                <TabButton label="票價" active={tab === "票價"} onClick={() => setTab("票價")} />
                <TabButton label="時間" active={tab === "時間"} onClick={() => setTab("時間")} />
              </div>

              <div className="col-span-3 pl-3 border-l border-neutral-200 min-h-64">
                {tab === "分類" && (
                  <OptionGrid2Multi
                    options={CATEGORIES as unknown as string[]}
                    selected={categories}
                    onToggle={toggleCategory}
                    accent={ACCENT}
                    hasAll
                  />
                )}
                {tab === "票價" && (
                  <OptionGrid2Multi
                    options={PRICE_OPTS as unknown as string[]}
                    selected={prices}
                    onToggle={togglePrice}
                    accent={ACCENT}
                    hasAll
                  />
                )}
                {tab === "時間" && (
                  <OptionGrid2Multi
                    options={TIME_OPTS as unknown as string[]}
                    selected={times}
                    onToggle={toggleTime}
                    accent={ACCENT}
                  />
                )}
              </div>
            </div>

            {/* 已選擇 chips（縮小版） */}
            <div className="mt-4">
              <p className="mb-1.5 text-xs text-neutral-500">已選擇</p>
              <div className="flex flex-wrap gap-1.5">
                {chips.length > 0 ? (
                  chips.map((c, i) => (
                    <span
                      key={`${c.label}-${i}`}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                      style={{ borderColor: ACCENT, color: ACCENT }}
                    >
                      {c.label}
                      <button
                        aria-label={`清除 ${c.label}`}
                        onClick={c.remove}
                        className="rounded-full px-1 leading-none hover:bg-black/5"
                        style={{ color: ACCENT }}
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-400">尚未選擇條件</span>
                )}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 w-full bg白/80 backdrop-blur p-4 border-t border-neutral-200 rounded-b-3xl">
            <div className="flex gap-3">
              <button
                onClick={resetFilters}
                className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm text-neutral-600"
              >
                重設
              </button>
              <button
                onClick={applyAndClose}
                className="flex-1 rounded-xl text-white px-4 py-3 text-sm"
                style={{ backgroundColor: ACCENT }}
              >
                套用
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 左側標籤按鈕（固定高度、置中） */
function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void; }) {
  return (
    <button
      onClick={onClick}
      className="w-full h-11 rounded-lg border px-3 text-sm transition flex items-center justify-center"
      style={
        active
          ? { backgroundColor: ACCENT, borderColor: ACCENT, color: "#fff" }
          : { backgroundColor: "#fff", borderColor: "#d4d4d8", color: "#525252" }
      }
    >
      {label}
    </button>
  );
}

/* 右側選項（複選，兩欄；可選擇是否包含「全部」邏輯） */
function OptionGrid2Multi({
  options, selected, onToggle, accent, hasAll = false,
}: {
  options: string[]; selected: Set<string>;
  onToggle: (name: string) => void; accent: string;
  hasAll?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const active = selected.has(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className="h-10 w-full rounded-md border text-sm text-center leading-10 transition whitespace-nowrap overflow-hidden text-ellipsis"
            title={opt}
            style={
              active
                ? { backgroundColor: accent, borderColor: accent, color: "#fff" }
                : { backgroundColor: "#fff", borderColor: "#d4d4d8", color: "#525252" }
            }
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}