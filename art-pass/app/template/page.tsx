// app/template/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
// import Link from "next/link";
import UidLink from "@/components/uid-link";

export const dynamic = "force-dynamic"; // 只包一層，避免 /template 在 build/prerender 時報錯

const ACCENT = "rgb(90, 180, 197)";
const DEFAULT_TZ = "Asia/Taipei";
const API_BASE = "http://142.91.103.69:8000";

type EventItem = {
  event_id?: string | number;
  image_url?: string;
  title?: string;
  event_url?: string;
  start_datetime_iso?: string;
  end_datetime_iso?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  event_timezone?: string;
  date_time?: string;
  venue_name?: string;
  event_description?: string;
};

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
function sameYMD(a: Date, b: Date) { return fmtDate(a) === fmtDate(b); }
function formatDateRangeOnly(e: EventItem) {
  const s = toDate(e.start_datetime_iso, e.start_timestamp);
  const t = toDate(e.end_datetime_iso, e.end_timestamp);
  if (s && t) return sameYMD(s, t) ? fmtDate(s) : `${fmtDate(s)} - ${fmtDate(t)}`;
  if (s) return fmtDate(s);
  if (t) return fmtDate(t);
  return e.date_time || "";
}

/* 與 search 頁相同風格的 Spinner（保留你的寫法） */
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

/* ===== Suspense fallback：只包外層，不動你原本的 loading UI ===== */
function SuspenseFallback() {
  return (
    <div className="min-h-dvh w-full bg-neutral-50">
      <div className="mx-auto max-w-[480px] px-4 pb-8">
        <header className="h-14 flex items-center justify-between">
          <div className="text-lg font-semibold text-neutral-800">活動資訊</div>
          <div className="w-16" />
        </header>
        <div className="py-10 flex items-center justify-center text-neutral-500 text-sm">
          <Spinner />
          <span className="ml-2">載入中…</span>
        </div>
      </div>
    </div>
  );
}

/* ===== 你的原本頁面（僅把 default 改成內層，其他不改） ===== */
function TemplateInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const idParam = searchParams.get("id");
  const id = idParam ? decodeURIComponent(idParam) : "";

  const [ev, setEv] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/event/${encodeURIComponent(String(id))}`);
        const text = await res.text();
        const cleaned = text.trim().replace(/%+$/, "");
        const data = JSON.parse(cleaned);

        const normalized: EventItem = {
          ...data,
          event_id: data.event_id ?? data.id ?? id,
          image_url: data.image_url ?? data.cover ?? data.image ?? "",
          venue_name: data.venue_name ?? data.venue ?? data.place ?? "",
          event_description: data.event_description ?? data.description ?? data.summary ?? data.content ?? "",
        };
        setEv(normalized);
      } catch (e: unknown) {
        console.error(e);
        setError("載入活動資料失敗");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (!id) {
    return (
      <div className="min-h-dvh mx-auto max-w-[480px] p-4">
        <header className="h-14 flex items-center">
          <button onClick={() => router.back()} className="rounded-lg border px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-50">
            返回
          </button>
        </header>
        <div className="mt-10 text-sm text-neutral-500">缺少活動 ID。</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-dvh w-full bg-neutral-50">
        <div className="mx-auto max-w-[480px] px-4 pb-8">
          <header className="h-14 flex items-center justify-between">
            <div className="text-lg font-semibold text-neutral-800">活動資訊</div>
            <div className="w-16" />
          </header>
          <div className="py-10 flex items-center justify-center text-neutral-500 text-sm">
            <Spinner />
            <span className="ml-2">載入中…</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !ev) {
    return (
      <div className="min-h-dvh mx-auto max-w-[480px] p-4">
        <header className="h-14 flex items-center">
          <button onClick={() => router.back()} className="rounded-lg border px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-50">
            返回
          </button>
        </header>
        <div className="mt-10 text-sm text-neutral-500">{error || "找不到活動資料。"}</div>
      </div>
    );
  }

  const img = ev.image_url ?? "";
  const title = ev.title || "未命名活動";
  const venue = ev.venue_name ?? "";
  const dateText = formatDateRangeOnly(ev);
  const link = ev.event_url || "#";
  const desc = (ev.event_description || "").trim();

  return (
    <div className="min-h-dvh w-full bg-neutral-50">
      <div className="mx-auto max-w-[480px] px-4 pb-8">
        <header className="h-14 flex items-center justify-between">
          <div className="text-lg font-semibold text-neutral-800">活動資訊</div>
          <div className="w-16" />
        </header>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="w-full aspect-[16/9] bg-neutral-200">
            {img ? (
              <img
                src={img}
                alt={title}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : null}
          </div>

          <div className="px-4 py-4">
            <h1 className="text-[18px] font-semibold leading-snug text-neutral-900">{title}</h1>

            {dateText && <div className="mt-2 text-[13px] text-neutral-700">{dateText}</div>}
            {venue && <div className="mt-1 text-[13px] text-neutral-500">{venue}</div>}

            {desc && (
              <div className="mt-4 text-[14px] leading-relaxed text-neutral-800 whitespace-pre-line break-words">
                {desc}
              </div>
            )}

            <div className="mt-4">
              <UidLink
                href={link}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm text-white font-bold"
                style={{ backgroundColor: ACCENT }}
              >
                前往活動頁
              </UidLink>
            </div>
          </div>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

/* ===== 只做包裹，不改你的其他寫法 ===== */
export default function TemplatePage() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <TemplateInner />
    </Suspense>
  );
}