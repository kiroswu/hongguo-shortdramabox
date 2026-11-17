/** 推荐：全幅主视觉 + 横向货架（继续观看 / 为你精选 / 本周热榜）。 */
import { useEffect, useMemo, useState } from "react";
import type { Nav } from "../App";
import { api } from "../bridge";
import { toast } from "../toast";
import type { FeedItem, HistoryItem, Series } from "../types";
import { Cover, Empty, ErrorNote, Icon, Poster, Shelf, Spinner, useAsync } from "../ui";

export function Home(props: { nav: Nav }) {
  const [tab, setTab] = useState("16");
  const categories = useAsync(() => api.feedCategories(), []);
  const feed = useAsync(() => api.recommend(tab), [tab]);
  const history = useAsync(() => api.history("", false), []);
  const hot = useAsync(() => api.rank({ selected: "all", sub: "ranklist_hot_sc" }), []);

  const items = feed.data?.items ?? [];
  const heroes = useMemo(() => items.slice(0, 4), [items]);
  // 条目本来就 ≤ 4 时，hero 已经吃掉了全部；此时货架直接复用，避免「为你精选」空白。
  const shelfItems = items.length > heroes.length ? items.slice(heroes.length) : items;

  const open = (series: Series) => props.nav.go({ name: "detail", id: series.id });
  const play = (item: FeedItem) => {
    const episode = item.episode ?? item.series.episodes?.[0];
    if (episode) props.nav.go({ name: "play", series: item.series, episode });
    else open(item.series);
  };

  return (
    <div className="page home">
      <Hero items={heroes} onPlay={play} onOpen={open} />

      <div className="subnav">
        {(categories.data ?? []).map((category) => (
          <button
            key={category.tabType}
            className={tab === String(category.tabType) ? "on" : ""}
            type="button"
            onClick={() => setTab(String(category.tabType))}
          >
            {category.name}
          </button>
        ))}
        <span className="subnav-rule" />
        <span className="subnav-note">{items.length ? `${items.length} 部正在推荐` : "正在读取推荐…"}</span>
      </div>

      {feed.loading && !items.length ? <Spinner label="正在为你挑选" /> : null}
      {feed.error ? <ErrorNote message={feed.error} /> : null}

      {(history.data?.items ?? []).length ? (
        <Shelf title="继续观看" note="从上次停下的地方接着看">
          {(history.data?.items ?? []).slice(0, 12).map((item: HistoryItem) => (
            <button
              key={`${item.series.id}-${item.videoId}`}
              className="continue-card"
              type="button"
              onClick={() => {
                const episode = item.series.episodes?.find((ep) => ep.videoId === item.videoId) ?? item.series.episodes?.[item.episodeIndex - 1];
                if (episode) props.nav.go({ name: "play", series: item.series, episode });
                else open(item.series);
              }}
            >
              <span className="continue-art">
                <Cover src={item.series.cover} alt={item.series.title} />
                <span className="continue-progress">
                  <i style={{ width: `${progressOf(item)}%` }} />
                </span>
              </span>
              <span className="continue-title">{item.series.title}</span>
              <span className="continue-sub">看到第 {item.episodeIndex} 集 · {clock(item.positionSec)}</span>
            </button>
          ))}
        </Shelf>
      ) : null}

      <Shelf title="为你精选" note="人工复核过的当日片单">
        {shelfItems.map((item) => (
          <Poster key={item.series.id} series={item.series} onOpen={open} label={item.series.titleTag?.text} />
        ))}
        {!feed.loading && !items.length && !feed.error ? <Empty title="这个频道暂时没有内容" /> : null}
      </Shelf>

      <Shelf title="本周热榜" note="按播放与追剧综合排序" more={() => props.nav.go({ name: "rank" })}>
        {(hot.data?.items ?? []).slice(0, 12).map((item, index) => (
          <Poster
            key={item.id}
            series={{
              id: item.id, title: item.title, cover: item.cover, intro: item.intro, tags: item.tags ?? [],
              episodeCount: 0, score: item.score, status: item.status, playCount: 0, followCount: 0,
              favorited: false, liked: false, episodes: [], watchedEpisode: 0, serializing: false,
              startVideoId: "", startEpisode: 0, seasonIndex: 0, multiSeason: false,
              upcoming: false, reserved: false, subInfo: item.rankText ?? "", heat: item.heat ?? "", kind: "",
            }}
            onOpen={(series) => open(series)}
            label={`NO.${index + 1}`}
            sub={item.heat || item.score || ""}
          />
        ))}
      </Shelf>

      <footer className="page-foot">短剧盒 · 极光皮肤 Demo · 内容由宿主提供</footer>
    </div>
  );
}

function Hero(props: { items: FeedItem[]; onPlay: (item: FeedItem) => void; onOpen: (series: Series) => void }) {
  const [index, setIndex] = useState(0);
  const [favorited, setFavorited] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (props.items.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % props.items.length), 9000);
    return () => window.clearInterval(timer);
  }, [props.items.length]);
  const item = props.items[Math.min(index, Math.max(0, props.items.length - 1))];
  if (!item) {
    return (
      <section className="hero hero-empty">
        <div className="hero-veil" />
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">SHORT DRAMA BOX</div>
            <h1>把今天的好剧<br />留在这个晚上</h1>
            <p className="hero-intro">正在读取推荐，稍等一下。</p>
          </div>
        </div>
      </section>
    );
  }
  const series = item.series;
  const isFav = favorited[series.id] ?? series.favorited;
  const toggleFav = () => {
    const next = !isFav;
    setFavorited((prev) => ({ ...prev, [series.id]: next }));
    void api.setFavorite(series.id, next).then(() => toast(next ? "已加入收藏" : "已取消收藏"), () => toast("操作失败，请稍后重试"));
  };
  return (
    <section className="hero">
      {/* 背景优先用「剧照」（分集封面，通常是横版），失败时回退到剧集封面，绝不留白。 */}
      <div className="hero-backdrop"><Cover src={item.episode?.cover || series.cover} fallbackSrc={series.cover} alt="" /></div>
      <div className="hero-veil" />
      <div className="hero-inner">
        <div className="hero-copy">
          <div className="eyebrow">TODAY&apos;S PICK · {String(index + 1).padStart(2, "0")} / {String(props.items.length).padStart(2, "0")}</div>
          <h1>{series.title}</h1>
          <div className="hero-meta">
            {series.score ? <span className="hero-score">{series.score}</span> : null}
            <span>{series.episodeCount ? `${series.episodeCount} 集` : "连载中"}</span>
            {series.status ? <span>{series.status}</span> : null}
            {(series.tags ?? []).slice(0, 3).map((tag) => <span key={tag} className="hero-tag">{tag}</span>)}
          </div>
          <p className="hero-intro">{series.intro || "—"}</p>
          <div className="hero-actions">
            <button className="btn primary" type="button" onClick={() => props.onPlay(item)}>
              <Icon name="play" size={16} filled /> 立即播放
            </button>
            <button className="btn" type="button" onClick={() => props.onOpen(series)}>剧集详情</button>
            <button className={`btn icon${isFav ? " on" : ""}`} type="button" title={isFav ? "取消收藏" : "收藏"} onClick={toggleFav}>
              <Icon name="heart" size={16} filled={isFav} />
            </button>
          </div>
        </div>
        <button className="hero-poster" type="button" onClick={() => props.onOpen(series)} aria-label={series.title}>
          <Cover src={series.cover} alt={series.title} />
          <span className="hero-poster-ring" />
        </button>
      </div>
    </section>
  );
}

function progressOf(item: HistoryItem): number {
  const duration = item.series.episodes?.find((ep) => ep.videoId === item.videoId)?.duration ?? 0;
  if (!duration) return 8;
  return Math.min(100, Math.max(2, (item.positionSec / duration) * 100));
}

function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

