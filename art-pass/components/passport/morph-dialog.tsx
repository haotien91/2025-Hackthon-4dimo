"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { EventDetail, type EventDetailData } from "@/components/event-detail";
import localFont from "next/font/local";

export type MorphOrigin = { x: number; y: number; width: number; height: number };

export type MorphDialogEvent = {
  event_id?: string | number;
  title?: string;
  image_url?: string;
  visitDate?: string; // ISO string
  // extended fields used by EventDetail (optional ones allowed)
  category?: string;
  venue_name?: string;
  date_time?: string;
  start_datetime_iso?: string;
  end_datetime_iso?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  event_timezone?: string;
  event_description?: string;
  organizer?: string;
  ticket_type?: string;
  ticket_price?: string;
  ticket_url?: string;
  contact_person?: string;
  contact_phone?: string;
  event_url?: string;
};

export default function MorphDialog({
  open,
  event,
  origin,
  onClose,
  maxHeight = 640,
  showAll = false,
  // 顯示覆寫
  dateOnImage = false,
  organizerOverlay,
  organizerInContent,
  centerContact,
  centerVisitButton,
}: {
  open: boolean;
  event: MorphDialogEvent;
  origin: MorphOrigin | null;
  onClose: () => void;
  maxHeight?: number;
  showAll?: boolean;
  dateOnImage?: boolean;
  organizerOverlay?: boolean;
  organizerInContent?: boolean;
  centerContact?: boolean;
  centerVisitButton?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    // 下一幀切到 expanded 狀態，觸發 transition
    const t = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(t);
  }, [open]);

  const final = useMemo(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 0;
    const vh = typeof window !== "undefined" ? window.innerHeight : 0;
    const width = Math.min(840, Math.floor(vw * 0.92));
    const height = Math.min(maxHeight, Math.floor(vh * 0.9));
    const left = Math.max(0, Math.floor((vw - width) / 2));
    const top = Math.max(20, Math.floor((vh - height) / 2));
    return { left, top, width, height };
  }, [maxHeight]);

  if (!mounted || !open || !origin) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* 背景遮罩 */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${expanded ? "opacity-100" : "opacity-0"}`}
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={() => {
          // 先縮回再關閉
          setExpanded(false);
          setTimeout(onClose, 220);
        }}
      />

      {/* Dialog 外框，從 origin 位置 morph 到置中 */}
      <div
        ref={dialogRef}
        className="absolute overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-400"
        style={{
          left: expanded ? final.left : origin.x,
          top: expanded ? final.top : origin.y,
          width: expanded ? final.width : origin.width,
          height: expanded ? final.height : origin.height,
          // 和 Tailwind 時序對齊
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <EventDetail
          event={event as EventDetailData}
          showImage={true}
          imageHeight="h-1/2"
          showDescription={true}
          showDate={(showAll ? true : false) && !dateOnImage}
          showVenue={showAll ? true : false}
          showOrganizer={organizerInContent ?? (showAll ? true : false)}
          showOrganizerOverlay={organizerOverlay ?? (showAll ? false : true)}
          showTickets={showAll ? true : false}
          showContact={showAll ? true : false}
          showVisitButton={showAll ? true : false}
          descriptionTextClass={showAll ? undefined : "text-base md:text-lg"}
          dateOnImage={dateOnImage}
          centerContact={!!centerContact}
          centerVisitButton={!!centerVisitButton}
        />
      </div>
    </div>,
    document.body
  );
}
