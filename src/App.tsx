/**
 * 皮肤外壳：顶部横向导航 + 页面缓存 + 全屏播放层。
 *
 * 与内置皮肤（左侧栏 + 双列卡片）刻意做成两种东西：这里是「影院/杂志」式布局，
 * 顶栏透明浮在内容上、无侧栏、切换靠横向滚动货架。
 *
 * 缓存策略：四个主页面 + 设置**常驻挂载**，切换只切显隐（`hidden`），
 * 数据、滚动位置、筛选条件都保留——切回来不会重新请求、也不会跳回顶部。
 *
 * 四类窗口共用同一份产物，靠宿主注入的全局标记分流：
 * `__hgPlayerWindow` / `__hgLyricWindow` / `__hgAboutWindow`，都没有 = 主窗口。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import logo from "./assets/logo.png";
import { About } from "./About";
import { api, shell } from "./bridge";
import { Detail } from "./pages/Detail";
import { Discover } from "./pages/Discover";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { Player } from "./pages/Player";
import { Rank } from "./pages/Rank";
import { Settings } from "./pages/Settings";
import { Toaster } from "./toast";
import type { Episode, Series } from "./types";
import { Icon } from "./ui";

type Section = "home" | "discover" | "rank" | "library" | "settings";

export type Route =
  | { name: Section }
  | { name: "detail"; id: string }
  | { name: "play"; series: Series; episode: Episode };

export interface Nav {
  go: (route: Route) => void;
  back: () => void;
}

const NAV: Array<{ key: Section; label: string }> = [
  { key: "home", label: "推荐" },
  { key: "discover", label: "找剧" },
  { key: "rank", label: "榜单" },
  { key: "library", label: "我的" },
];

export function App() {
  const flags = window as unknown as { __hgPlayerWindow?: boolean; __hgLyricWindow?: boolean; __hgAboutWindow?: boolean };
  if (flags.__hgAboutWindow) return <AboutWindow />;
  if (flags.__hgLyricWindow) return <SideWindow title="桌面剧本" text="剧本模式由内置皮肤提供，当前皮肤未实现该能力。" />;
  if (flags.__hgPlayerWindow) return <SideWindow title="独立播放窗" text="请在主窗口继续播放；当前皮肤不支持分离播放。" />;
  return <Main />;
}

function Main() {
  const [section, setSection] = useState<Section>("home");
  const [visited, setVisited] = useState<Set<Section>>(() => new Set<Section>(["home"]));
  const [detailId, setDetailId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ series: Series; episode: Episode } | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  /** 每个页面各自的滚动位置：切回来接着看，而不是回到顶部。 */
  const scrollMap = useRef<Record<string, number>>({});
  const lastView = useRef<string>("home");
  /** 打开详情前的位置：关掉详情要放回去。 */
  const detailReturn = useRef(0);

  const view = detailId ? "detail" : section;

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    if (lastView.current === view) return;
    scrollMap.current[lastView.current] = node.scrollTop;
    node.scrollTop = scrollMap.current[view] ?? 0;
    lastView.current = view;
  }, [view]);

  const go = useCallback((route: Route) => {
    if (route.name === "detail") {
      if (!detailId) detailReturn.current = scroller.current?.scrollTop ?? 0;
      setDetailId(route.id);
      return;
    }
    if (route.name === "play") {
      setPlaying({ series: route.series, episode: route.episode });
      return;
    }
    setDetailId(null);
    setPlaying(null);
    setSection(route.name);
    setVisited((prev) => (prev.has(route.name) ? prev : new Set(prev).add(route.name)));
  }, [detailId]);

  const back = useCallback(() => {
    if (playing) { setPlaying(null); return; }
    if (detailId) {
      setDetailId(null);
      // 详情是覆盖层：关掉后恢复进入前的滚动位置。
      requestAnimationFrame(() => {
        if (scroller.current) scroller.current.scrollTop = detailReturn.current;
      });
      return;
    }
    setSection("home");
    setVisited((prev) => (prev.has("home") ? prev : new Set(prev).add("home")));
  }, [detailId, playing]);

  const nav: Nav = { go, back };
  const transparent = section === "home" && !detailId;

  // Esc 返回（播放层自己处理 Esc，不冒泡到这里）。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !playing) back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, playing]);

  /** 顶栏空白处按住可拖窗（无边框窗口没有系统标题栏）。 */
  const startDrag = (event: ReactMouseEvent) => {
    if ((event.target as HTMLElement).closest("button, input, a, select")) return;
    event.preventDefault();
    shell.startDragging();
  };

  return (
    <div className={`app${transparent ? " transparent-top" : ""}`}>
      <header className="topbar" onMouseDown={startDrag}>
        <button className="brand" type="button" onClick={() => go({ name: "home" })}>
          <img className="brand-logo" src={logo} alt="" draggable={false} />
          <span className="brand-text">
            短剧盒
            <em>AURORA</em>
          </span>
        </button>
        <nav className="topnav">
          {NAV.map((item) => (
            <button
              key={item.key}
              className={!detailId && section === item.key ? "on" : ""}
              type="button"
              onClick={() => go({ name: item.key })}
            >
              {item.label}
              <i />
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <button className="ghost-icon" type="button" title="搜索" onClick={() => go({ name: "discover" })}>
            <Icon name="search" size={17} />
          </button>
          <button className={`ghost-icon${section === "settings" && !detailId ? " on" : ""}`} type="button" title="设置" onClick={() => go({ name: "settings" })}>
            <Icon name="settings" size={17} />
          </button>
          {/* 无边框窗口没有系统红绿灯：关闭入口放右上角（关闭行为仍由宿主的 closeAction 决定）。 */}
          <button className="ghost-icon danger" type="button" title="关闭窗口" onClick={() => shell.close()}>
            <Icon name="close" size={17} />
          </button>
        </div>
      </header>

      <main className="stage-scroll" ref={scroller}>
        <div className="view" hidden={!!detailId || section !== "home"}><Home nav={nav} /></div>
        {visited.has("discover") ? <div className="view" hidden={!!detailId || section !== "discover"}><Discover nav={nav} /></div> : null}
        {visited.has("rank") ? <div className="view" hidden={!!detailId || section !== "rank"}><Rank nav={nav} /></div> : null}
        {visited.has("library") ? <div className="view" hidden={!!detailId || section !== "library"}><Library nav={nav} /></div> : null}
        {visited.has("settings") ? <div className="view" hidden={!!detailId || section !== "settings"}><Settings /></div> : null}
        {detailId ? <Detail nav={nav} id={detailId} /> : null}
      </main>

      {playing ? <Player nav={nav} series={playing.series} episode={playing.episode} /> : null}
      <Toaster />
    </div>
  );
}

/** 托盘「关于」小窗：无顶栏，只渲染关于内容。 */
function AboutWindow() {
  useEffect(() => {
    document.documentElement.classList.add("side-window");
    void api.info().catch(() => {});
  }, []);
  return (
    <div className="side-shell">
      <div className="side-head" onMouseDown={() => shell.startDragging()}>
        <span>关于 · 短剧盒</span>
        <button className="ghost-icon" type="button" title="关闭" onClick={() => shell.close()}><Icon name="close" size={15} /></button>
      </div>
      <div className="side-body"><About compact /></div>
    </div>
  );
}

function SideWindow(props: { title: string; text: string }) {
  useEffect(() => {
    document.documentElement.classList.add("side-window");
  }, []);
  return (
    <div className="side-shell">
      <div className="side-head" onMouseDown={() => shell.startDragging()}>
        <span>{props.title}</span>
        <button className="ghost-icon" type="button" title="关闭" onClick={() => shell.close()}><Icon name="close" size={15} /></button>
      </div>
      <div className="side-body side-note">{props.text}</div>
    </div>
  );
}
