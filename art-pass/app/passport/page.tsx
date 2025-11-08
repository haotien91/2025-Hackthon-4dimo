"use client";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FullBleedCard } from "@/components/passport/fullbleed-card";

const API_BASE = "http://172.20.10.7:8000";

type EventItem = {
  event_id?: string | number;
  image_url?: string;
  image_url_preview?: string;
  title?: string;
  visitDate?: string; // 從 added_at 轉換而來
};

type MonthKey = string; // "2025-11"

function ym(date: string): MonthKey {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function displayYM(key: MonthKey) {
  const [y, m] = key.split("-");
  return `${y} 年 ${Number(m)} 月`;
}

/* ========= API 函數 ========= */
async function fetchPassportWithDates(uid: string): Promise<Array<{ event_id: string; added_at: number }>> {
  try {
    const url = `${API_BASE}/users/${encodeURIComponent(uid)}/passport`;
    const res = await fetch(url);
    const textRaw = await res.text();
    const text = textRaw.trim().replace(/%+$/, "");
    const json = JSON.parse(text) as { passport?: Array<{ event_id: string; added_at: number }> };
    return json.passport || [];
  } catch (err) {
    console.error("fetchPassportWithDates error:", err);
    return [];
  }
}

async function fetchEventById(eventId: string): Promise<EventItem | null> {
  try {
    const url = `${API_BASE}/event/${encodeURIComponent(eventId)}`;
    const res = await fetch(url);
    const textRaw = await res.text();
    const text = textRaw.trim().replace(/%+$/, "");
    const data = JSON.parse(text);
    return {
      event_id: data.event_id ?? data.id ?? eventId,
      image_url: data.image_url ?? data.cover ?? data.image ?? data.image_url_preview ?? "",
      image_url_preview: data.image_url_preview ?? data.image_url ?? data.cover ?? data.image ?? "",
      title: data.title ?? "",
    };
  } catch (err) {
    console.error(`Failed to fetch event ${eventId}:`, err);
    return null;
  }
}

export default function PassportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f1f3f4] flex items-center justify-center text-neutral-500">載入中…</div>}>
      <PassportPageInner />
    </Suspense>
  );
}

function PassportPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Array<EventItem & { visitDate: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  // 載入 passport 資料
  useEffect(() => {
    const uid = searchParams.get("uid");
    if (!uid) {
      setError("請先登入");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. 取得 passport event_id 列表
        const passportList = await fetchPassportWithDates(uid);
        if (passportList.length === 0) {
          setEvents([]);
          setLoading(false);
          return;
        }

        // 2. 並行 fetch 所有 event 詳細資訊
        const eventPromises = passportList.map((p) => fetchEventById(p.event_id));
        const eventResults = await Promise.all(eventPromises);

        // 3. 合併資料：將 added_at 轉為 visitDate
        const eventsWithDates: Array<EventItem & { visitDate: string }> = [];
        for (let i = 0; i < passportList.length; i++) {
          const event = eventResults[i];
          if (event) {
            const addedAt = passportList[i].added_at;
            const visitDate = new Date(addedAt * 1000).toISOString();
            eventsWithDates.push({
              ...event,
              visitDate,
            });
          }
        }

        setEvents(eventsWithDates);
      } catch (err) {
        console.error("Failed to load passport:", err);
        setError("載入失敗，請稍後再試");
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams]);

  // 按照月份分組
  const groups = useMemo(() => {
    const byMonth = new Map<MonthKey, Array<EventItem & { visitDate: string }>>();
    for (const item of [...events].sort(
      (a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
    )) {
      const k = ym(item.visitDate);
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k)!.push(item);
    }
    return Array.from(byMonth.entries());
  }, [events]);

  const monthRefs = useRef<Record<MonthKey, HTMLDivElement | null>>({});
  const [currentMonth, setCurrentMonth] = useState<MonthKey>(
    groups[0]?.[0] ?? ym(new Date().toISOString())
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const key = (visible[0].target as HTMLElement).dataset["month"] as MonthKey;
          if (key) setCurrentMonth(key);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.25, 0.5, 0.75] }
    );
    for (const [key] of groups) {
      const el = monthRefs.current[key];
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [groups]);

  const scrollToMonth = (key: MonthKey) => {
    const el = monthRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 更新 currentMonth 當 groups 改變時
  useEffect(() => {
    if (groups.length > 0 && !groups.some(([key]) => key === currentMonth)) {
      setCurrentMonth(groups[0][0]);
    }
  }, [groups, currentMonth]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f1f3f4] flex items-center justify-center">
        <div className="text-neutral-500">載入中…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f1f3f4] flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </main>
    );
  }

  if (events.length === 0) {
    return (
      <main className="min-h-screen bg-[#f1f3f4] flex items-center justify-center">
        <div className="text-center">
          <div className="text-neutral-500 mb-3">目前還沒有任何足跡，趕快去探索吧！</div>
          <button
            type="button"
            onClick={() => {
              const uid = searchParams.get("uid");
              const searchUrl = `/search${uid ? `?uid=${encodeURIComponent(uid)}` : ""}`;
              // 先把當前頁替換為根路由，確保返回上一頁是 /
              router.replace("/");
              // 再導到 /search
              router.push(searchUrl);
            }}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: "rgb(90, 180, 197)" }}
          >
            去找展演
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f1f3f4]">
      {/* Sticky Header：置中年月（可點擊） */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="relative mx-auto max-w-6xl px-6 py-3 md:px-10 lg:px-16">
          <div
            className="flex cursor-pointer items-center justify-center"
            onClick={() => setPickerOpen((v) => !v)}
          >
            <h1 className="text-black text-l md:text-xl font-semibold">
              {displayYM(currentMonth)}
            </h1>
          </div>
          {pickerOpen ? (
            <div className="absolute left-1/2 z-20 w-56 -translate-x-1/2 rounded-xl border border-white/10 bg-black/80 p-2 shadow-xl backdrop-blur">
              <ul className="max-h-60 overflow-auto">
                {groups.map(([key]) => (
                  <li
                    key={key}
                    className={`rounded-lg px-3 py-2 text-sm text-white/90 hover:bg-white/10 ${
                      key === currentMonth ? "bg-white/10" : ""
                    }`}
                    onClick={() => {
                      setPickerOpen(false);
                      scrollToMonth(key);
                    }}
                  >
                    {displayYM(key)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* 內容：滿版卡片清單 */}
      <div className="mx-auto max-w-6xl px-6 md:px-10 lg:px-16">
        {groups.map(([key, items]) => (
          <section
            key={key}
            ref={(el: HTMLElement | null) => {
              if (el && "align" in el) monthRefs.current[key] = el as HTMLDivElement;
            }}
            data-month={key}
            className="relative"
          >
            <div className="sr-only">{displayYM(key)}</div>
            {items.map((it) => {
              const d = new Date(it.visitDate);
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, "0");
              const dd = String(d.getDate()).padStart(2, "0");
              const stamp = `${yyyy}.${mm}.${dd}`; // 公元年.月月.日日
              const eventId = it.event_id ? String(it.event_id) : undefined;
              const imageUrl = it.image_url || "";
              return (
                <div key={eventId || it.visitDate} className="py-1">
                  <FullBleedCard
                    title={it.title || "未命名活動"}
                    imageUrl={imageUrl}
                    bottomRightText={stamp}
                  />
                </div>
              );
            })}
          </section>
        ))}
        {/* 最底部預留 1 張卡片高度 */}
        <div className="w-screen -mx-6 md:-mx-10 lg:-mx-16 h-[220px] sm:h-[260px] md:h-[300px]" />
      </div>
    </main>
  );
}

