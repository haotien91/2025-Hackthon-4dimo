"use client";
import React from "react";

type Props = {
  text: string;
  dotSize?: number; // 單顆點直徑（px）
  gap?: number; // 點之間空隙（px）
  color?: string; // 點亮的顏色
  offColor?: string; // 未點亮的顏色
  glow?: boolean; // 是否加 glow
  style?: React.CSSProperties;
};

// 簡單 5x7 字模：每個 entry 為 7 個字串（row），每個字串長度 5，'1' 為亮點
const FONT_5x7: Record<string, string[]> = {
  "0": ["11111", "10001", "10011", "10101", "11001", "10001", "11111"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["11111", "00001", "00001", "11111", "10000", "10000", "11111"],
  "3": ["11111", "00001", "00001", "01111", "00001", "00001", "11111"],
  "4": ["10010", "10010", "10010", "11111", "00010", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11111", "00001", "00001", "11111"],
  "6": ["11111", "10000", "10000", "11111", "10001", "10001", "11111"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["11111", "10001", "10001", "11111", "10001", "10001", "11111"],
  "9": ["11111", "10001", "10001", "11111", "00001", "00001", "11111"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
  "'": ["00100", "00100", "00000", "00000", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function charToMatrix(ch: string): string[] {
  return FONT_5x7[ch] ?? FONT_5x7[" "];
}

export default function DotMatrixDisplay({
  text,
  dotSize = 8,
  gap = 4,
  color = "#ff8a00",
  offColor = "#2b2b2b",
  glow = true,
  style,
}: Props) {
  const chars = text.split("");

  const containerStyle: React.CSSProperties = {
    display: "flex",
    gap: `${Math.max(2, dotSize * 0.8)}px`,
    alignItems: "center",
    ...style,
  };

  const dotStyleBase: React.CSSProperties = {
    width: dotSize,
    height: dotSize,
    borderRadius: "50%",
    display: "inline-block",
    boxSizing: "border-box",
  };

  return (
    <div style={containerStyle}>
      {chars.map((ch, ci) => {
        const matrix = charToMatrix(ch);
        return (
          <div
            key={ci}
            style={{
              display: "grid",
              gridTemplateRows: `repeat(7, ${dotSize}px)`,
              gridTemplateColumns: `repeat(5, ${dotSize}px)`,
              gap,
            }}
          >
            {matrix.flatMap((row, ri) =>
              row.split("").map((bit, ci2) => {
                const isOn = bit === "1";
                const dotStyle: React.CSSProperties = {
                  ...dotStyleBase,
                  background: isOn ? color : offColor,
                  boxShadow:
                    isOn && glow
                      ? `0 0 ${Math.max(2, dotSize / 2)}px ${color}55, inset 0 0 ${Math.max(
                          1,
                          dotSize / 6
                        )}px #0003`
                      : "none",
                  transition: "background 120ms, box-shadow 120ms",
                };
                return <span key={`${ri}-${ci2}`} style={dotStyle} />;
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

