 "use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { FullBleedCard } from "@/components/passport/fullbleed-card";
import { passportItems } from "@/lib/passport-mock";

type MonthKey = string; // "2025-11"

function ym(date: string): MonthKey {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function displayYM(key: MonthKey) {
  const [y, m] = key.split("-");
  return `${y} 年 ${Number(m)} 月`;
}

export default function PassportPage() {
  const groups = useMemo(() => {
    const byMonth = new Map<MonthKey, typeof passportItems>();
    for (const item of [...passportItems].sort(
      (a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
    )) {
      const k = ym(item.visitDate);
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k)!.push(item);
    }
    return Array.from(byMonth.entries());
  }, []);

  const monthRefs = useRef<Record<MonthKey, HTMLDivElement | null>>({});
  const [currentMonth, setCurrentMonth] = useState<MonthKey>(groups[0]?.[0] ?? ym(new Date().toISOString()));
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
              return (
                <div key={it.id} className="py-1">
                  <FullBleedCard
                    title={it.title}
                    imageUrl={it.imageUrl}
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

