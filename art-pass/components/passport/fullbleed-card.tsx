"use client";
import Image from "next/image";
import localFont from "next/font/local";

type Props = {
  title: string;
  imageUrl: string;
  bottomRightText?: string; // 右下角 LCD 文字（YYYY.MM.DD）
  onClick?: () => void;
};

const dseg = localFont({
  src: "../../node_modules/dseg/fonts/DSEG7-Modern/DSEG7Modern-Regular.ttf",
  display: "swap",
});

export function FullBleedCard({ title, imageUrl, bottomRightText, onClick }: Props) {
  return (
    <div
      className="relative h-[220px] w-full overflow-hidden rounded-2xl sm:h-[260px] md:h-[300px]"
      onClick={onClick}
    >
      <Image src={imageUrl} alt={title} fill sizes="100vw" className="object-cover" />

      {/* 左上白字標題 */}
      <div className="absolute left-4 top-4 pr-6 text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)]">
        <h3 className="text-xl font-bold leading-tight sm:text-2xl md:text-3xl">{title}</h3>
      </div>

      {/* 右下 LCD 字樣（可選，採用 DSEG 七段顯示字體） */}
      {bottomRightText ? (
        <div className={`absolute bottom-4 right-4 ${dseg.className}`}>
          <span
            className="px-0 py-0 text-sm leading-none tracking-[0.18em] text-[#efbf5d] sm:text-base md:text-lg"
            style={{
              textShadow:
                "0 0 6px rgba(239,191,93,0.55), 0 0 2px rgba(0,0,0,0.45), 0 1px 0 rgba(0,0,0,0.25)",
              filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
            }}
          >
            {bottomRightText}
          </span>
        </div>
      ) : null}
    </div>
  );
}

