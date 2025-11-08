import Image from "next/image";
import type { EventSummary } from "@/lib/types";
import DotMatrixDisplay from "@/components/DotMatrixDisplay";

type EventCardProps = {
  event: EventSummary;
  layout?: "vertical" | "horizontal";
};

const badgeStyles = {
  vertical:
    "absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm",
};

export function EventCard({ event, layout = "horizontal" }: EventCardProps) {
  if (layout === "horizontal") {
    return (
      <article className="group relative flex h-full w-full items-stretch gap-4 overflow-hidden rounded-2xl bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
        {/* 左側圖片：撐滿卡片高度，不留外側內距 */}
        <div className="relative h-full w-28 flex-shrink-0 overflow-hidden md:w-36">
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            sizes="(max-width: 768px) 112px, 144px"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          {/* 右下角 LCD 風格時間顯示 */}
          <div className="absolute bottom-1 right-1">
            <DotMatrixDisplay
              text={event.startTime}
              dotSize={4}
              gap={1.5 as unknown as number}
              color="#ffb300"
              offColor="#1a1a1a"
              glow
            />
          </div>
        </div>

        {/* 右側資訊：只顯示名稱與時間，不加外框留白 */}
        <div className="flex min-w-0 flex-1 flex-col justify-center p-3 md:p-4">
          <h3 className="line-clamp-2 text-base font-semibold text-slate-900 md:text-lg">
            {event.title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {event.startDate}・{event.startTime}
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex h-full w-full flex-col overflow-hidden rounded-3xl bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-40 w-full md:h-48">
        <Image
          src={event.imageUrl}
          alt={event.title}
          fill
          sizes="(max-width: 768px) 80vw, 320px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <span className={badgeStyles.vertical}>{event.ticketType}</span>
        {event.favorite ? (
          <span className="absolute left-3 top-3 rounded-full bg-rose-500/90 px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
            ★ 收藏
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
          {event.category}
        </span>
        <h3 className="line-clamp-2 text-base font-semibold text-slate-900 md:text-lg">
          {event.title}
        </h3>
        <div className="mt-auto">
          <p className="text-sm text-slate-500">
            {event.startDate}・{event.startTime}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700">
            {event.venue}
          </p>
        </div>
      </div>
    </article>
  );
}

