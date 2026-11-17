/**
 * 原生桥。
 *
 * 皮肤页面由宿主的初始化脚本注入 `window.shortdramabox.api`（`skin://localhost` 同样注入），
 * 因此**不需要**自己打包 bridge，也不要假设 `fetch` 能直连官方接口。
 * 所有业务调用都必须走这里，宿主负责签名、设备身份与风控。
 */
import type {
  AppConfig, AppInfo, FeedCategory, FeedPage, FilterGroup, HistoryPage, PlayInfo,
  RankCategory, RankPage, RankSelection, Reservation, ReservationPage, SearchSuggestion, Series, SeriesPage,
} from "./types";

type AppBridge = Record<string, (...args: unknown[]) => Promise<unknown>>;

function bridge(): AppBridge {
  const app = (window as unknown as { shortdramabox?: { api?: AppBridge } }).shortdramabox?.api;
  if (!app) throw new Error("原生桥未注入：请在「短剧盒」内使用，不要直接用浏览器打开 dist");
  return app;
}

export async function call<T>(method: string, ...args: unknown[]): Promise<T> {
  return (await bridge()[method](...args)) as T;
}

/** 窗口/系统级能力（宿主注入的运行时兼容层）。 */
function runtime(name: string, ...args: unknown[]): unknown {
  const fn = (window as unknown as { shortdramabox?: { runtime?: Record<string, (...a: unknown[]) => unknown> } }).shortdramabox?.runtime?.[name];
  return typeof fn === "function" ? fn(...args) : undefined;
}

export const api = {
  /* 应用 */
  info: () => call<AppInfo>("AppInfo"),
  config: () => call<AppConfig>("LoadAppConfig"),
  /** 恢复内置皮肤（清指针），配合 `shell.restart()` 生效。 */
  skinReset: () => call<null>("SkinReset"),

  /* 推荐与分类 */
  feedCategories: () => call<FeedCategory[]>("FeedCategories"),
  recommend: (tab: string, cursor = "") => call<FeedPage>("RecommendFeed", tab, cursor),
  findTab: (cursor = "") => call<SeriesPage>("FindTab", cursor),
  category: (filters: Record<string, string[]>, cursor = "") => call<SeriesPage>("Category", filters, cursor),
  selector: () => call<FilterGroup[]>("SelectorPanel", "default"),
  search: (query: string, cursor = "") => call<SeriesPage>("Search", query, cursor),
  suggest: (query: string) => call<SearchSuggestion[]>("SearchSuggest", query),

  /* 榜单 */
  rankPanel: () => call<RankCategory[]>("RankPanel"),
  rank: (selection: RankSelection, cursor = "") => call<RankPage>("Rank", selection, cursor),

  /* 详情与播放 */
  detail: (seriesId: string) => call<Series>("SeriesDetail", seriesId),
  playInfo: (seriesId: string, videoId: string) => call<PlayInfo>("PlayInfo", seriesId, videoId),
  saveProgress: (series: Series, index: number, videoId: string, positionSec: number, flush: boolean) => {
    void call("SaveProgress", series, index, videoId, Math.floor(positionSec), flush).catch(() => {});
  },
  prefetch: (videoIds: string[], quality = "") => { void call("PrefetchPlay", videoIds, quality, false).catch(() => {}); },

  /* 个人列表 */
  setFavorite: (seriesId: string, enabled: boolean) => call<void>("SetFavorite", seriesId, enabled),
  setLike: (seriesId: string, videoId: string, enabled: boolean) => call<void>("SetLike", seriesId, videoId, enabled),
  setFollowUpdate: (seriesId: string, enabled: boolean) => call<void>("SetFollowUpdate", seriesId, enabled),
  isFollowingUpdate: (seriesId: string) => call<boolean>("IsFollowingUpdate", seriesId),
  setReservation: (seriesId: string, enabled: boolean, series?: Partial<Reservation>) =>
    call<void>("SetReservation", seriesId, enabled, series ?? {}),
  favorites: (cursor = "", force = false) => call<SeriesPage>("Favorites", cursor, "", force),
  likes: (cursor = "", force = false) => call<SeriesPage>("Likes", cursor, "", force),
  history: (cursor = "", force = false) => call<HistoryPage>("History", cursor, force),
  followUpdates: (cursor = "", force = false) => call<SeriesPage>("FollowUpdates", cursor, force),
  reservations: (online: boolean, cursor = "", force = false) =>
    call<ReservationPage>("Reservations", online, cursor, force),
};

export const shell = {
  openExternal: (url: string) => runtime("BrowserOpenURL", url),
  clipboard: (text: string) => runtime("ClipboardSetText", text),
  fullscreen: (on: boolean) => runtime(on ? "WindowFullscreen" : "WindowUnfullscreen"),
  minimise: () => runtime("WindowMinimise"),
  close: () => runtime("WindowClose"),
  restart: () => runtime("Restart"),
  startDragging: () => runtime("WindowStartDragging"),
};
