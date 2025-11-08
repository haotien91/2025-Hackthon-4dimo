"use client";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FullBleedCard } from "@/components/passport/fullbleed-card";
import MorphDialog, { type MorphOrigin } from "@/components/passport/morph-dialog";

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

// 根據 visitDate 計算相對時間標籤
function getRelativeTimeLabel(visitDate: string): string {
  const visit = new Date(visitDate);
  const now = new Date();
  const visitDay = new Date(visit.getFullYear(), visit.getMonth(), visit.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((today.getTime() - visitDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays === 2) return "前天";
  if (diffDays <= 7) return "上週";

  // 判斷是否為上個月
  const visitMonth = visit.getMonth();
  const visitYear = visit.getFullYear();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 上一個月（跨年也考慮）
  const isLastMonth =
    (visitYear === currentYear && visitMonth === currentMonth - 1) ||
    (visitYear === currentYear - 1 && visitMonth === 11 && currentMonth === 0);

  if (isLastMonth) return "上個月";

  // 其他：顯示月份
  return `${visitYear} 年 ${String(visitMonth + 1).padStart(2, "0")} 月`;
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
      // extended fields
      category: data.category,
      date_time: data.date_time,
      start_datetime_iso: data.start_datetime_iso,
      end_datetime_iso: data.end_datetime_iso,
      start_timestamp: data.start_timestamp,
      end_timestamp: data.end_timestamp,
      event_timezone: data.event_timezone,
      venue_name: data.venue_name ?? data.venue ?? data.place ?? data.venue_preview,
      venue_preview: data.venue_preview ?? data.venue_name ?? data.place,
      event_description: data.event_description ?? data.description ?? data.summary ?? data.content,
      organizer: data.organizer,
      ticket_type: data.ticket_type,
      ticket_price: data.ticket_price,
      ticket_url: data.ticket_url,
      contact_person: data.contact_person,
      contact_phone: data.contact_phone,
      event_url: data.event_url,
    } as any;
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
  const [selected, setSelected] = useState<(EventItem & { visitDate: string }) | null>(null);
  const [origin, setOrigin] = useState<MorphOrigin | null>(null);

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

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [currentLabel, setCurrentLabel] = useState<string>("現在");
  const [pickerOpen, setPickerOpen] = useState(false);

  // 初始化：設定第一個卡片的標籤
  useEffect(() => {
    if (events.length > 0) {
      const label = getRelativeTimeLabel(events[0].visitDate);
      setCurrentLabel(label);
    }
  }, [events]);

  // 追蹤最上面的卡片
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => {
            const rect = e.boundingClientRect;
            return {
              element: e.target as HTMLElement,
              top: rect.top,
              visitDate: (e.target as HTMLElement).dataset.visitDate,
            };
          })
          .filter((v) => v.visitDate)
          .sort((a, b) => a.top - b.top); // 最上面的在前

        if (visible[0]?.visitDate) {
          setCurrentLabel(getRelativeTimeLabel(visible[0].visitDate));
        }
      },
      { rootMargin: "-10% 0px -80% 0px", threshold: [0, 0.1, 0.5, 1] }
    );

    cardRefs.current.forEach((el) => {
      if (el) io.observe(el);
    });

    return () => io.disconnect();
  }, [events]);

  const scrollToCard = (event: EventItem & { visitDate: string }) => {
    const eventId = event.event_id ? String(event.event_id) : undefined;
    const cardKey = eventId || event.visitDate;
    const el = cardRefs.current.get(cardKey);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };


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
              {currentLabel}
            </h1>
          </div>
          {pickerOpen ? (
            <div className="absolute left-1/2 z-20 w-72 -translate-x-1/2 rounded-xl border border-white/10 bg-black/80 p-2 shadow-xl backdrop-blur">
              <ul className="max-h-80 overflow-auto">
                {events.map((it) => {
                  const eventId = it.event_id ? String(it.event_id) : undefined;
                  const cardKey = eventId || it.visitDate;
                  const label = getRelativeTimeLabel(it.visitDate);
                  const title = it.title || "未命名活動";
                  const isCurrent = currentLabel === label;

                  return (
                    <li
                      key={cardKey}
                      className={`rounded-lg px-3 py-2 text-sm text-white/90 hover:bg-white/10 cursor-pointer ${
                        isCurrent ? "bg-white/10" : ""
                      }`}
                      onClick={() => {
                        setPickerOpen(false);
                        scrollToCard(it);
                      }}
                    >
                      <div className="font-semibold">{label}</div>
                      <div className="text-xs text-white/70 mt-0.5 truncate">{title}</div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* 內容：滿版卡片清單 */}
      <div className="mx-auto max-w-6xl px-6 md:px-10 lg:px-16">
        {groups.map(([key, items]) => (
          <section key={key} data-month={key} className="relative">
            <div className="sr-only">{displayYM(key)}</div>
            {items.map((it) => {
              const d = new Date(it.visitDate);
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, "0");
              const dd = String(d.getDate()).padStart(2, "0");
              const stamp = `${yyyy}.${mm}.${dd}`; // 公元年.月月.日日
              const eventId = it.event_id ? String(it.event_id) : undefined;
              const cardKey = eventId || it.visitDate;
              const imageUrl = it.image_url || "";
              return (
                <div
                  key={cardKey}
                  ref={(el) => {
                    if (el) cardRefs.current.set(cardKey, el);
                  }}
                  data-visit-date={it.visitDate}
                  className="py-1"
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const ox = rect.left + window.scrollX;
                    const oy = rect.top + window.scrollY;
                    setOrigin({ x: ox, y: oy, width: rect.width, height: rect.height });
                    setSelected(it);
                  }}
                >
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
        {/* 最底部預留半張卡片高度，帶提示文案 */}
        <div className="h-[110px] sm:h-[130px] md:h-[150px] flex items-center justify-center">
          <div className="flex items-center text-neutral-500">
            <span
              className="mr-2 block h-5 w-5 bg-current [mask-image:url('/footprint.png')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain]"
              aria-hidden="true"
            />
            <span>這是專屬於你的，獨一無二的足跡</span>
          </div>
        </div>
      </div>

      {/* Morphing Dialog */}
      {selected && (
        <MorphDialog
          open={!!selected}
          event={selected}
          origin={origin}
          onClose={() => {
            setSelected(null);
            setOrigin(null);
          }}
        />
      )}
    </main>
  );
}

