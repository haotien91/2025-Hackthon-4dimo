"use client";
import Link, { LinkProps } from "next/link";
import * as React from "react";

type Props = React.PropsWithChildren<
  LinkProps & {
    className?: string;
    style?: React.CSSProperties;
  }
>;

function appendUidToHref(href: LinkProps["href"], uid?: string): LinkProps["href"] {
  if (!uid) return href;

  const addUid = (urlStr: string) => {
    try {
      // 相對路徑也可處理（用當前 origin 作為 base）
      const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
      const url = new URL(urlStr, base);
      if (!url.searchParams.get("uid")) {
        url.searchParams.set("uid", uid);
      }
      // 回傳 pathname+search+hash，避免把 origin 帶出
      const path = url.pathname + (url.search ? url.search : "") + (url.hash || "");
      // 保留外部連結（包含 protocol）的情況
      if (/^https?:\/\//i.test(urlStr)) return url.toString();
      return path;
    } catch {
      return urlStr;
    }
  };

  if (typeof href === "string") {
    return addUid(href);
  }
  if ("pathname" in href) {
    const q = new URLSearchParams(href.query as Record<string, string> | undefined);
    if (!q.get("uid")) q.set("uid", uid);
    return { ...href, query: Object.fromEntries(q.entries()) };
  }
  return href;
}

export default function UidLink({ href, children, className, style, ...rest }: Props) {
  // 直接從瀏覽器查詢字串取得 uid，避免 useSearchParams 需要 Suspense 邊界的限制
  const uid =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("uid") || undefined
      : undefined;
  const finalHref = React.useMemo(() => appendUidToHref(href, uid), [href, uid]);
  return (
    <Link href={finalHref} className={className} style={style} {...rest}>
      {children}
    </Link>
  );
}


