/**
 * 只保留 Demo 需要的字段（与宿主 `api/types.ts` 对齐，删掉用不到的装饰字段）。
 * 皮肤与宿主是两个工程，**不要**跨目录 import——这里就是契约副本。
 */

export interface Episode {
  index: number;
  videoId: string;
  title: string;
  duration: number;
  cover: string;
  locked: boolean;
  vertical?: boolean | null;
}

export interface Series {
  id: string;
  title: string;
  cover: string;
  intro: string;
  tags: string[];
  episodeCount: number;
  score: string;
  status: string;
  playCount: number;
  followCount: number;
  favorited: boolean;
  liked: boolean;
  episodes: Episode[];
  watchedEpisode: number;
  serializing: boolean;
  finished?: boolean;
  startVideoId: string;
  startEpisode: number;
  seasonIndex: number;
  multiSeason: boolean;
  vertical?: boolean | null;
  upcoming: boolean;
  reserved: boolean;
  subInfo: string;
  heat: string;
  kind: string;
  titleTag?: { text?: string } | null;
}

export interface FeedCategory {
  tabType: string;
  name: string;
}

export interface FeedItem {
  series: Series;
  episode: Episode | null;
  rankTag: unknown;
}

export interface FeedPage {
  items: FeedItem[];
  cursor: string;
  hasMore: boolean;
}

export interface SeriesPage {
  items: Series[];
  cursor: string;
  hasMore: boolean;
}

export interface SearchSuggestion {
  word: string;
  seriesId: string;
  cover: string;
  abstract: string;
}

export interface HistoryItem {
  series: Series;
  episodeIndex: number;
  videoId: string;
  positionSec: number;
  updatedAt: number;
}

export interface HistoryPage {
  items: HistoryItem[];
  cursor: string;
  hasMore: boolean;
}

export interface FilterOption {
  id: string;
  name: string;
}

export interface FilterGroup {
  key: string;
  name: string;
  options: FilterOption[];
}

export interface RankSub {
  id: string;
  name: string;
  desc: string;
}

export interface RankCategory {
  id: string;
  name: string;
  subs: RankSub[];
}

export interface RankItem {
  id: string;
  title: string;
  cover: string;
  intro: string;
  tags: string[];
  score: string;
  status: string;
  heat: string;
  badge: string;
  rankText: string;
}

export interface RankPage {
  items: RankItem[];
  cursor: string;
  hasMore: boolean;
  tabs?: RankCategory[];
}

export interface RankSelection {
  selected: string;
  sub: string;
  panel?: string;
  background?: string;
}

export interface Quality {
  name: string;
  width: number;
  height: number;
  url: string;
}

export interface PlayInfo {
  videoId: string;
  duration: number;
  qualities: Quality[];
  default: string;
  resumeSec: number;
}

export interface Reservation {
  seriesId: string;
  title: string;
  cover: string;
  intro: string;
  online: boolean;
  subscribed: boolean;
  date?: string;
  heat?: string;
  score?: string;
  tags?: string[];
  kind?: string;
  expectedPublishTime?: number;
  hint?: string;
  note?: string;
}

export interface ReservationPage {
  items: Reservation[];
  cursor: string;
  hasMore: boolean;
  onlineTotal: number;
  offlineTotal: number;
}

export interface AppInfo {
  version: string;
  commit: string;
  platform: string;
}

export interface AppConfig {
  theme?: "dark" | "light";
  accent?: string;
  player?: Record<string, unknown>;
  [key: string]: unknown;
}
