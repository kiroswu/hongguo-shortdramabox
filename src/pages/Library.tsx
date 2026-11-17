/** 我的：历史 / 收藏 / 点赞 / 追更 / 预约（五段式下划线切换）。 */
import { useState } from "react";
import type { ReactNode } from "react";
import type { Nav } from "../App";
import { api } from "../bridge";
import type { HistoryItem, Reservation, Series } from "../types";
import { Cover, Empty, ErrorNote, Icon, Spinner, useAsync } from "../ui";

type Tab = "history" | "favorites" | "likes" | "follows" | "reservations";

const TABS: Array<{ key: Tab; label: string; hint: string }> = [
  { key: "history", label: "历史", hint: "看过的会自动记在这里" },
  { key: "favorites", label: "收藏", hint: "想留着的剧" },
  { key: "likes", label: "点赞", hint: "点过赞的剧集" },
  { key: "follows", label: "追更", hint: "有新集会在这里提醒" },
  { key: "reservations", label: "预约", hint: "开播前先排个队" },
];

export function Library(props: { nav: Nav }) {
  const [tab, setTab] = useState<Tab>("history");
  const [online, setOnline] = useState(true);

  return (
    <div className="page library">
      <header className="page-head">
        <div>
          <div className="eyebrow">LIBRARY</div>
          <h1>我的片库</h1>
        </div>
        <p className="page-note">{TABS.find((entry) => entry.key === tab)?.hint}</p>
      </header>

      <div className="segments">
        {TABS.map((entry) => (
          <button key={entry.key} className={entry.key === tab ? "on" : ""} type="button" onClick={() => setTab(entry.key)}>
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "reservations" ? (
        <div className="subtabs">
          <button className={online ? "on" : ""} type="button" onClick={() => setOnline(true)}>已上线</button>
          <button className={!online ? "on" : ""} type="button" onClick={() => setOnline(false)}>待上线</button>
        </div>
      ) : null}

      {tab === "history" ? <HistoryList nav={props.nav} /> : null}
      {tab === "favorites" ? <SeriesList nav={props.nav} load={() => api.favorites("", false)} empty="还没有收藏的剧" /> : null}
      {tab === "likes" ? <SeriesList nav={props.nav} load={() => api.likes("", false)} empty="还没有点赞记录" /> : null}
      {tab === "follows" ? <SeriesList nav={props.nav} load={() => api.followUpdates("", false)} empty="还没有追更的剧" /> : null}
      {tab === "reservations" ? <ReserveList nav={props.nav} online={online} /> : null}
    </div>
  );
}

function HistoryList(props: { nav: Nav }) {
  const state = useAsync(() => api.history("", false), []);
  const items: HistoryItem[] = state.data?.items ?? [];
  return (
    <Shell state={state} empty="还没有观看记录" count={items.length}>
      <ul className="rows">
        {items.map((item) => {
          const series = item.series;
          const episode = series.episodes?.find((ep) => ep.videoId === item.videoId);
          return (
            <Row
              key={`${series.id}-${item.videoId}`}
              cover={series.cover}
              title={series.title}
              meta={[`第 ${item.episodeIndex} 集`, `${clock(item.positionSec)}${episode ? ` / ${clock(episode.duration)}` : ""}`, series.episodeCount ? `全 ${series.episodeCount} 集` : ""].filter(Boolean).join(" · ")}
              intro={series.intro}
              tags={series.tags}
              progress={episode?.duration ? (item.positionSec / episode.duration) * 100 : undefined}
              onClick={() => {
                if (episode) props.nav.go({ name: "play", series, episode });
                else props.nav.go({ name: "detail", id: series.id });
              }}
              onDetail={() => props.nav.go({ name: "detail", id: series.id })}
              action="继续"
            />
          );
        })}
      </ul>
    </Shell>
  );
}

function SeriesList(props: { nav: Nav; load: () => Promise<{ items: Series[] }>; empty: string }) {
  const state = useAsync(props.load, []);
  const items = state.data?.items ?? [];
  return (
    <Shell state={state} empty={props.empty} count={items.length}>
      <ul className="rows">
        {items.map((series) => (
          <Row
            key={series.id}
            cover={series.cover}
            title={series.title}
            meta={[series.episodeCount && `${series.episodeCount} 集`, series.status, series.score && `评分 ${series.score}`, series.heat].filter(Boolean).join(" · ")}
            intro={series.intro}
            tags={series.tags}
            onClick={() => props.nav.go({ name: "detail", id: series.id })}
            onDetail={() => props.nav.go({ name: "detail", id: series.id })}
          />
        ))}
      </ul>
    </Shell>
  );
}

function ReserveList(props: { nav: Nav; online: boolean }) {
  const state = useAsync(() => api.reservations(props.online, "", false), [props.online]);
  const items: Reservation[] = state.data?.items ?? [];
  return (
    <Shell state={state} empty={props.online ? "没有已上线的预约" : "没有待上线的预约"} count={items.length}>
      <ul className="rows">
        {items.map((item) => (
          <Row
            key={item.seriesId}
            cover={item.cover}
            title={item.title}
            meta={[item.online ? "已上线" : "待上线", item.date ? item.date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : "", item.hint || item.heat || ""].filter(Boolean).join(" · ")}
            intro={item.intro}
            tags={item.tags}
            onClick={() => props.nav.go({ name: "detail", id: item.seriesId })}
            onDetail={() => props.nav.go({ name: "detail", id: item.seriesId })}
          />
        ))}
      </ul>
    </Shell>
  );
}

function Shell(props: {
  state: { loading: boolean; error?: string };
  empty: string;
  count: number;
  children: ReactNode;
}) {
  if (props.state.loading) return <Spinner label="读取中" />;
  if (props.state.error) return <ErrorNote message={props.state.error} />;
  if (!props.count) return <Empty title={props.empty} />;
  return <>{props.children}</>;
}

function Row(props: {
  cover: string;
  title: string;
  meta: string;
  intro?: string;
  tags?: string[];
  progress?: number;
  action?: string;
  onClick: () => void;
  onDetail?: () => void;
}) {
  return (
    <li className="library-item">
      <button className="row" type="button" onClick={props.onClick}>
        <span className="row-cover"><Cover src={props.cover} alt={props.title} /></span>
        <span className="row-copy">
          <span className="row-title">{props.title}</span>
          <span className="row-meta">{props.meta}</span>
          {props.intro ? <span className="row-intro">{props.intro}</span> : null}
          {props.tags?.length ? (
            <span className="row-tags">
              {props.tags.slice(0, 3).map((tag) => <i key={tag}>{tag}</i>)}
            </span>
          ) : null}
        </span>
        {props.progress !== undefined ? (
          <span className="row-meter">
            <span className="row-meter-track"><i style={{ width: `${Math.min(100, Math.max(0, props.progress))}%` }} /></span>
            <em>{Math.round(Math.min(100, Math.max(0, props.progress)))}%</em>
          </span>
        ) : null}
        {props.action ? <span className="row-action">{props.action}<Icon name="play" size={12} filled /></span> : <span className="row-go"><Icon name="chevron" size={15} /></span>}
      </button>
      <button className="row-detail" type="button" title={`查看《${props.title}》的剧集详情`} onClick={props.onDetail ?? props.onClick}>
        详情<Icon name="chevron" size={13} />
      </button>
    </li>
  );
}

function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

