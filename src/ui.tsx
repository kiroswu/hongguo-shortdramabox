/** 共享 UI：取数 hook、封面降级、海报卡、横向货架、图标。 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Series } from "./types";

/* ------------------------------------------------------------------ */
/* 取数                                                                */
/* ------------------------------------------------------------------ */

export interface AsyncState<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

/** 极简取数：deps 变化重新拉；卸载后丢弃结果（React 19 下不需要 AbortController）。 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    setState((prev) => ({ data: prev.data, loading: true }));
    load().then(
      (data) => { if (id === seq.current) setState({ data, loading: false }); },
      (error: unknown) => {
        if (id === seq.current) setState({ error: error instanceof Error ? error.message : String(error), loading: false });
      },
    );
    return () => { seq.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/* ------------------------------------------------------------------ */
/* 封面                                                                */
/* ------------------------------------------------------------------ */

/**
 * 封面降级链：原图 → 字节 CDN 无签名 JPEG 模板 → `.heic → .jpeg`。
 * 官方封面大多是带签名、约一个月过期的 `.heic`，Windows 的 WebView2 解不了，
 * 必须换模板地址，否则就是一片破图。
 */
function coverCandidates(src: string): string[] {
  if (!src) return [];
  const isHeic = /\.heic(\?|$)/i.test(src);
  const id = /\/novel-pic\/([^~?/]+)/.exec(src)?.[1] ?? "";
  const list: string[] = [];
  if (!isHeic) list.push(src);
  if (id) list.push(`https://p3-novel.byteimg.com/novel-pic/${id}~tplv-shrink:640:0.image`);
  if (isHeic) list.push(src);
  const swapped = src.replace(/\.heic/i, ".jpeg");
  if (swapped !== src) list.push(swapped);
  return [...new Set(list)];
}

export function Cover(props: { src: string; alt: string; className?: string; ratio?: string; fallbackSrc?: string }) {
  // fallbackSrc 用于「剧照 → 剧集封面」这类降级：分集剧照常缺图/过期，
  // 不能让整块背景退成空 div（那正是推荐页看起来一片素白的原因）。
  const list = useMemo(
    () => [...coverCandidates(props.src), ...coverCandidates(props.fallbackSrc ?? "")].filter(Boolean),
    [props.src, props.fallbackSrc],
  );
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [props.src, props.fallbackSrc]);
  if (index >= list.length) return <div className={`cover-fallback ${props.className ?? ""}`} aria-hidden />;
  return (
    <img
      className={props.className}
      src={list[index]}
      alt={props.alt}
      loading="lazy"
      draggable={false}
      onError={() => setIndex((value) => value + 1)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* 基础组件                                                            */
/* ------------------------------------------------------------------ */

export function Spinner(props: { label?: string }) {
  return (
    <div className="spinner-wrap">
      <span className="spinner" />
      {props.label ? <span className="spinner-text">{props.label}</span> : null}
    </div>
  );
}

export function Empty(props: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="empty-mark">◎</div>
      <div className="empty-title">{props.title}</div>
      {props.hint ? <div className="empty-hint">{props.hint}</div> : null}
    </div>
  );
}

export function ErrorNote(props: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-note">
      <span>{props.message}</span>
      {props.onRetry ? <button className="link-btn" type="button" onClick={props.onRetry}>重试</button> : null}
    </div>
  );
}

/** 2:3 海报卡：悬停上浮 + 金线描边。 */
export function Poster(props: { series: Series; onOpen: (series: Series) => void; label?: string; sub?: string }) {
  return (
    <button className="poster" type="button" onClick={() => props.onOpen(props.series)} title={props.series.title}>
      <span className="poster-art">
        <Cover src={props.series.cover} alt={props.series.title} />
        {props.label ? <span className="poster-badge">{props.label}</span> : null}
        <span className="poster-play"><Icon name="play" size={16} /></span>
      </span>
      <span className="poster-title">{props.series.title}</span>
      <span className="poster-sub">{props.sub ?? metaLine(props.series)}</span>
    </button>
  );
}

export function metaLine(series: Series): string {
  const bits: string[] = [];
  if (series.score) bits.push(`${series.score} 分`);
  if (series.episodeCount) bits.push(`${series.episodeCount} 集`);
  if (series.status) bits.push(series.status);
  return bits.join(" · ") || (series.tags ?? []).slice(0, 2).join(" / ");
}

/** 横向货架：滚轮不够用时用左右按钮（渐变遮罩提示还有内容）。 */
export function Shelf(props: { title: string; note?: string; children: ReactNode; more?: () => void }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const nudge = (direction: 1 | -1) => {
    const node = scroller.current;
    if (node) node.scrollBy({ left: direction * Math.max(320, node.clientWidth * 0.8), behavior: "smooth" });
  };
  return (
    <section className="shelf">
      <header className="shelf-head">
        <h2>{props.title}</h2>
        {props.note ? <span className="shelf-note">{props.note}</span> : null}
        <span className="shelf-line" />
        {props.more ? <button className="link-btn" type="button" onClick={props.more}>全部</button> : null}
        <span className="shelf-nav">
          <button type="button" aria-label="向左" onClick={() => nudge(-1)}><Icon name="chevron" size={15} /></button>
          <button type="button" aria-label="向右" onClick={() => nudge(1)}><Icon name="chevron" size={15} /></button>
        </span>
      </header>
      <div className="shelf-track" ref={scroller}>{props.children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 图标（内联，避免为 Demo 引入图标库）                                  */
/* ------------------------------------------------------------------ */

const PATHS: Record<string, ReactNode> = {
  play: <path d="M8 5.5v13l10-6.5-10-6.5Z" />,
  pause: <><path d="M9 5h2.5v14H9zM14.5 5H17v14h-2.5z" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" /></>,
  heart: <path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />,
  bookmark: <path d="M7 4h10v16l-5-3.6L7 20V4Z" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 1.8" /></>,
  star: <path d="M12 4l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.8l5.4-.8L12 4Z" />,
  bell: <><path d="M6.5 16V10a5.5 5.5 0 0 1 11 0v6l1.5 2h-14l1.5-2Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  volume: <><path d="M4 10v4h3l4 3V7l-4 3H4Z" /><path d="M15 9.5a4 4 0 0 1 0 5" /></>,
  mute: <><path d="M4 10v4h3l4 3V7l-4 3H4Z" /><path d="M16 10l4 4M20 10l-4 4" /></>,
  next: <><path d="M6 5l8 7-8 7V5Z" /><path d="M17 5v14" /></>,
  expand: <path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" />,
};

export function Icon(props: { name: keyof typeof PATHS | string; size?: number; filled?: boolean }) {
  const path = PATHS[props.name];
  const size = props.size ?? 18;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={props.filled ? "currentColor" : "none"}
      stroke={props.filled ? "none" : "currentColor"}
      strokeWidth={props.filled ? 0 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {path}
    </svg>
  );
}
