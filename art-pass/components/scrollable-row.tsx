import { Children } from "react";
import type { PropsWithChildren, ReactNode } from "react";

type ScrollableRowProps = PropsWithChildren<{
  itemWidth?: string;
  itemHeight?: string;
}>;

export function ScrollableRow({
  children,
  itemWidth = "min-w-[260px]",
  itemHeight = "h-[360px]",
}: ScrollableRowProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent" />
      <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 pl-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-5 [&>*]:snap-start [&>*]:scroll-ml-4">
          {Children.map(children as ReactNode, (child, idx) => (
            <div key={idx} className={`${itemWidth} ${itemHeight}`}>
              {child}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

