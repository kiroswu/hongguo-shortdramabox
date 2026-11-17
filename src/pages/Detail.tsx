/** 剧集详情：全幅背景 + 海报 + 动作区 + 选集网格。 */
import { useEffect, useState } from "react";
import type { Nav } from "../App";
import { api } from "../bridge";
import { toast } from "../toast";
import type { Episode, Series } from "../types";
import { Cover, ErrorNote, Icon, Spinner, useAsync } from "../ui";

export function Detail(props: { nav: Nav; id: string }) {
  const state = useAsync(() => api.detail(props.id), [props.id]);
  const series = state.data;

  if (state.loading) return <div className="page"><Spinner label="正在打开剧集" /></div>;
  if (state.error || !series) return <div className="page"><ErrorNote message={state.error ?? "剧集不存在"} onRetry={props.nav.back} /></div>;

  return <DetailBody nav={props.nav} series={series} />;
}

function DetailBody(props: { nav: Nav; series: Series }) {
  const initial = props.series;
  const [series, setSeries] = useState(initial);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let alive = true;
    void api.isFollowingUpdate(initial.id).then((value) => { if (alive) setFollowing(!!value); }, () => {});
    return () => { alive = false; };
  }, [initial.id]);

  const playable = series.episodes.filter((episode) => !episode.locked && episode.videoId);
  const resumeIndex = Math.max(1, series.watchedEpisode || series.startEpisode || 1);
  const resume = playable.find((episode) => episode.index === resumeIndex) ?? playable[0];

  const play = (episode?: Episode | null) => {
    const target = episode ?? resume;
    if (!target) { toast("这一集暂时不能播放"); return; }
    props.nav.go({ name: "play", series, episode: target });
  };

  const toggleFavorite = () => {
    const next = !series.favorited;
    setSeries({ ...series, favorited: next });
    setBusy("fav");
    void api.setFavorite(series.id, next)
      .then(() => toast(next ? "已加入收藏" : "已取消收藏"), () => { setSeries((prev) => ({ ...prev, favorited: !next })); toast("操作失败"); })
      .finally(() => setBusy(""));
  };

  const toggleFollow = () => {
    const next = !following;
    setFollowing(next);
    setBusy("follow");
    void api.setFollowUpdate(series.id, next)
      .then(() => toast(next ? "已开启追更" : "已关闭追更"), () => { setFollowing(!next); toast("操作失败"); })
      .finally(() => setBusy(""));
  };

  const toggleReserve = () => {
    const next = !series.reserved;
    setSeries({ ...series, reserved: next });
    void api.setReservation(series.id, next, {
      title: series.title, cover: series.cover, intro: series.intro, online: false,
    }).then(() => toast(next ? "预约成功，上线会提醒你" : "已取消预约"), () => { setSeries((prev) => ({ ...prev, reserved: !next })); toast("操作失败"); });
  };

  return (
    <div className="detail">
      <div className="detail-backdrop"><Cover src={series.cover} alt="" /></div>
      <div className="detail-veil" />
      <button className="back-chip" type="button" onClick={props.nav.back}><Icon name="back" size={15} /> 返回</button>

      <div className="detail-head">
        <div className="detail-poster"><Cover src={series.cover} alt={series.title} /></div>
        <div className="detail-copy">
          <div className="eyebrow">{series.multiSeason ? `第 ${series.seasonIndex + 1} 季` : "SHORT DRAMA"}</div>
          <h1>{series.title}</h1>
          <div className="detail-meta">
            {series.score ? <span className="hero-score">{series.score}</span> : null}
            <span>{series.episodeCount ? `全 ${series.episodeCount} 集` : "集数待定"}</span>
            {series.status ? <span>{series.status}</span> : null}
            {series.heat ? <span>{series.heat}</span> : null}
            {(series.tags ?? []).map((tag) => <span key={tag} className="hero-tag">{tag}</span>)}
          </div>
          <p className="detail-intro">{series.intro || "暂无简介"}</p>
          <div className="detail-actions">
            <button className="btn primary" type="button" onClick={() => play(null)}>
              <Icon name="play" size={16} filled /> {resume && resume.index > 1 ? `继续第 ${resume.index} 集` : "开始播放"}
            </button>
            {series.upcoming ? (
              <button className={`btn${series.reserved ? " on" : ""}`} type="button" onClick={toggleReserve}>
                <Icon name="bell" size={15} /> {series.reserved ? "已预约" : "预约"}
              </button>
            ) : (
              <button className={`btn${following ? " on" : ""}`} type="button" disabled={busy === "follow"} onClick={toggleFollow}>
                <Icon name="bell" size={15} /> {following ? "追更中" : "追更"}
              </button>
            )}
            <button className={`btn${series.favorited ? " on" : ""}`} type="button" disabled={busy === "fav"} onClick={toggleFavorite}>
              <Icon name="heart" size={15} filled={series.favorited} /> {series.favorited ? "已收藏" : "收藏"}
            </button>
          </div>
        </div>
      </div>

      <section className="episodes">
        <header>
          <h2>选集</h2>
          <span>{playable.length} 集可播放</span>
        </header>
        <div className="ep-grid">
          {series.episodes.map((episode) => (
            <button
              key={episode.videoId || episode.index}
              className={`ep${episode.locked ? " locked" : ""}${episode.index === series.watchedEpisode ? " seen" : ""}`}
              type="button"
              disabled={episode.locked || !episode.videoId}
              onClick={() => play(episode)}
              title={episode.locked ? "需要解锁" : episode.title}
            >
              <span className="ep-no">{String(episode.index).padStart(2, "0")}</span>
              <span className="ep-dur">{episode.locked ? "锁" : clock(episode.duration)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function clock(seconds: number): string {
  if (!seconds) return "—";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
