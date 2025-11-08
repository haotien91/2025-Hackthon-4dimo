"use client";

import Image from "next/image";
import localFont from "next/font/local";
import { Noto_Serif_TC } from "next/font/google";
import UidLink from "@/components/uid-link";

const dseg = localFont({
  src: "../node_modules/dseg/fonts/DSEG7-Modern/DSEG7Modern-Regular.ttf",
  display: "swap",
});

const notoSerifTC = Noto_Serif_TC({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

const ACCENT = "rgb(90, 180, 197)";
const DEFAULT_TZ = "Asia/Taipei";

export type EventDetailData = {
  // 基本
  event_id?: string | number;
  title?: string;
  category?: string;

  // 媒體
  image_url?: string;

  // 時間（optional）
  date_time?: string;
  start_datetime_iso?: string;
  end_datetime_iso?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  event_timezone?: string;

  // 地點
  venue_name?: string;

  // 詳細
  event_description?: string;
  organizer?: string;

  // 票務（optional）
  ticket_type?: string;
  ticket_price?: string;
  ticket_url?: string;

  // 聯絡（optional）
  contact_person?: string;
  contact_phone?: string;
  event_url?: string;

  // 登記日期（護照用）
  visitDate?: string; // ISO
};

function toDate(iso?: string, ts?: number) {
  if (iso) return new Date(iso);
  if (typeof ts === "number") return new Date(ts * 1000);
  return null;
}
function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: DEFAULT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
function sameYMD(a: Date, b: Date) {
  return fmtDate(a) === fmtDate(b);
}
function formatDateRangeOnly(e: EventDetailData) {
  const s = toDate(e.start_datetime_iso, e.start_timestamp);
  const t = toDate(e.end_datetime_iso, e.end_timestamp);
  if (s && t) return sameYMD(s, t) ? fmtDate(s) : `${fmtDate(s)} - ${fmtDate(t)}`;
  if (s) return fmtDate(s);
  if (t) return fmtDate(t);
  return e.date_time || "";
}
function formatVisitDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

// 將最後一個空白（含全形空白）替換為換行
function renderOrganizerOverlayText(text: string) {
  const trimmed = text.trim();
  const idxAscii = trimmed.lastIndexOf(" ");
  const idxFull = trimmed.lastIndexOf("　");
  const idx = Math.max(idxAscii, idxFull);
  if (idx > 0) {
    const head = trimmed.slice(0, idx);
    const tail = trimmed.slice(idx + 1);
    return (
      <>
        <span>{head}</span>
        <br />
        <span>{tail}</span>
      </>
    );
  }
  return <>{trimmed}</>;
}

type Props = {
  event: EventDetailData;
  showImage?: boolean;
  imageHeight?: string;

  // 可選區塊控制
  showDescription?: boolean;
  showDate?: boolean;
  showVenue?: boolean;
  showOrganizer?: boolean;
  showOrganizerOverlay?: boolean; // 圖片左下角灰字
  showTickets?: boolean;
  showContact?: boolean;
  showVisitButton?: boolean;
  descriptionTextClass?: string; // 調整描述字級（用於特定頁面）
  // 額外 UI 控制
  dateOnImage?: boolean; // 活動日期顯示在圖片右下（非 LCD）
  centerContact?: boolean; // 聯絡資訊置中
  centerVisitButton?: boolean; // 前往活動頁按鈕置中
};

export function EventDetail({
  event,
  showImage = true,
  imageHeight = "h-1/2",
  showDescription = true,
  showDate = true,
  showVenue = true,
  showOrganizer = true,
  showOrganizerOverlay = false,
  showTickets = true,
  showContact = true,
  showVisitButton = true,
  descriptionTextClass = "text-sm",
  dateOnImage = false,
  centerContact = false,
  centerVisitButton = true,
}: Props) {
  const img = event.image_url ?? "";
  const title = event.title || "未命名活動";
  const dateText = formatDateRangeOnly(event);
  const venue = event.venue_name ?? "";
  const desc = (event.event_description || "").trim();
  const link = event.event_url || "#";

  return (
    <div className="flex h-full flex-col bg-white">
      {showImage && (
        <div className={`relative ${imageHeight} min-h-[180px] bg-neutral-200`}>
          {img && (
            <Image src={img} alt={title} fill sizes="100vw" className="object-cover" unoptimized />
          )}
          <div className="absolute inset-0 bg-black/20" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />

          <div className="absolute left-4 top-4 pr-6 text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)]">
            <h3 className="text-xl font-bold leading-tight sm:text-2xl md:text-3xl">{title}</h3>
          </div>

          {/* 右下：登記日期（LCD） */}
          {event.visitDate && (
            <div className={`absolute bottom-4 right-4 ${dseg.className}`}>
              <span
                className="px-0 py-0 text-sm leading-none tracking-[0.18em] text-[#efbf5d] sm:text-base md:text-lg"
                style={{
                  textShadow:
                    "0 0 6px rgba(239,191,93,0.55), 0 0 2px rgba(0,0,0,0.45), 0 1px 0 rgba(0,0,0,0.25)",
                  filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
                }}
              >
                {formatVisitDate(event.visitDate)}
              </span>
            </div>
          )}

          {/* 右下：活動日期（非 LCD），顯示在圖片上 */}
          {dateOnImage && dateText && (
            <div className="absolute bottom-4 right-4">
              <span className="rounded-md bg-black/55 px-2 py-1 text-xs text-white shadow-sm sm:text-sm">
                {dateText}
              </span>
            </div>
          )}

          {/* 左下：Organizer 灰字 */}
          {showOrganizerOverlay && event.organizer && (
            <div className="absolute bottom-4 left-4 max-w-[60%] pr-4 text-white/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
              {(event.ticket_type || event.ticket_price) ? (
                <div className="mt-1 text-[12px] text-white/85">
                  {event.ticket_type ?? ""}
                  {event.ticket_type && event.ticket_price ? " · " : ""}
                  {event.ticket_price ? event.ticket_price.replace(/;/g, " / ") : ""}
                </div>
              ) : null}
              <div className="text-[13px] line-clamp-2 break-words">
                {renderOrganizerOverlayText(event.organizer)}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className={`${notoSerifTC.className} flex min-h-full flex-col items-center justify-center space-y-4 px-6 py-8 text-left text-black`}>
          {showDescription && desc && (
            <p className={`max-w-2xl break-words whitespace-pre-line leading-relaxed ${descriptionTextClass}`}>{desc}</p>
          )}

          {showDate && dateText && <div className="text-sm">{dateText}</div>}
          {showVenue && venue && <div className="text-sm">{venue}</div>}
          {showTickets && !showOrganizerOverlay && (event.ticket_type || event.ticket_price) && (
            <div className="text-sm">
              {event.ticket_type ?? ""}
              {event.ticket_type && event.ticket_price ? " · " : ""}
              {event.ticket_price ? event.ticket_price.replace(/;/g, " / ") : ""}
            </div>
          )}
          {showOrganizer && event.organizer && <div className="text-sm">主辦：{event.organizer}</div>}

          {showContact && (event.contact_person || event.contact_phone) && (
            <div className={`text-sm ${centerContact ? "w-full text-center" : ""}`}>
              {event.contact_person && `聯絡人：${event.contact_person}`}
              {event.contact_phone && ` ${event.contact_phone}`}
            </div>
          )}

          {showVisitButton && link !== "#" && (
            <div className={`mt-2 ${centerVisitButton ? "w-full flex justify-center"  : ""}`}>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                前往活動頁
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
