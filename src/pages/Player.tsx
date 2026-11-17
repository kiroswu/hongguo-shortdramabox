/**
 * 播放：全屏黑场 + 极简控制条（播放 / 快进 / 进度 / 倍速 / 音量 / 下一集）。
 * 只做原片播放；画质增强、弹幕、软解等「高级能力」不在 Demo 范围内。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Nav } from "../App";
import { api, shell } from "../bridge";
import { toast } from "../toast";
import type { Episode, Series } from "../types";
import { Icon, Spinner, useAsync } from "../ui";

const IDLE_MS = 2400;

export function Player(props: { nav: Nav; series: Series; episode: Episode }) {
  const { series } = props;
  const [episode, setEpisode] = useState(props.episode);
  const info = useAsync(() => api.playInfo(series.id, episode.videoId), [episode.videoId]);
  const [quality, setQuality] = useState("");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(episode.duration || 0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [hover, setHover] = useState(true);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const idleTimer = useRef(0);
  const seeked = useRef(false);

  const qualities = info.data?.qualities ?? [];
  const url = qualities.find((entry) => entry.name === quality)?.url ?? qualities[0]?.url ?? "";

  useEffect(() => {
    setQuality("");
    seeked.current = false;
    setError("");
  }, [episode.videoId]);

  useEffect(() => {
    if (info.data && !quality) setQuality(info.data.default || info.data.qualities[0]?.name || "");
  }, [info.data, quality]);

  // 预取下一集：只取地址，不预热媒体（省额度）。
  useEffect(() => {
    const next = nextEpisode(series, episode);
    if (next?.videoId) api.prefetch([next.videoId], quality || undefined);
  }, [series, episode, quality]);

  const poke = useCallback(() => {
    setHover(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setHover(false), IDLE_MS);
  }, []);

  useEffect(() => {
    poke();
    return () => window.clearTimeout(idleTimer.current);
  }, [poke]);

  // 进度保存：每 5 秒 + 暂停/切集/离开时立即落盘。
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tick = window.setInterval(() => {
      if (!video.paused && video.currentTime > 1) api.saveProgress(series, episode.index, episode.videoId, video.currentTime, false);
    }, 5000);
    return () => {
      window.clearInterval(tick);
      if (video.currentTime > 1) api.saveProgress(series, episode.index, episode.videoId, video.currentTime, true);
    };
  }, [series, episode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    video.muted = muted;
  }, [rate, muted]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setError("无法开始播放，稍后再试"));
    else video.pause();
  };

  const seek = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + delta), video.duration || 0);
    poke();
  };

  const jump = (target: Episode) => {
    const video = videoRef.current;
    if (video && video.currentTime > 1) api.saveProgress(series, episode.index, episode.videoId, video.currentTime, true);
    setEpisode(target);
    setPlaying(false);
    setTime(0);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const video = videoRef.current;
      switch (event.key) {
        case " ":
          event.preventDefault(); toggle(); break;
        case "ArrowLeft": seek(-10); break;
        case "ArrowRight": seek(10); break;
        case "ArrowUp": event.preventDefault(); setRate((value) => Math.min(3, Number((value + 0.25).toFixed(2)))); break;
        case "ArrowDown": event.preventDefault(); setRate((value) => Math.max(0.5, Number((value - 0.25).toFixed(2)))); break;
        case "m": case "M": setMuted((value) => !value); break;
        case "f": case "F":
          if (document.fullscreenElement) void document.exitFullscreen?.(); else void shell.fullscreen(true);
          break;
        case "Escape": props.nav.back(); break;
        default: break;
      }
      if (video) poke();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.nav, poke]);

  const next = nextEpisode(series, episode);

  return (
    <div className={`player${hover ? " show" : ""}`} onMouseMove={poke} onMouseDown={poke}>
      <video
        ref={videoRef}
        src={url}
        className="player-video"
        playsInline
        autoPlay
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setDuration(video.duration || episode.duration || 0);
          if (!seeked.current) {
            seeked.current = true;
            const resume = info.data?.resumeSec ?? 0;
            if (resume > 1 && resume < (video.duration || Infinity) - 5) video.currentTime = resume;
          }
          video.playbackRate = rate;
          video.muted = muted;
        }}
        onPlay={() => { setPlaying(true); setError(""); }}
        onPause={() => {
          setPlaying(false);
          const video = videoRef.current;
          if (video && video.currentTime > 1) api.saveProgress(series, episode.index, episode.videoId, video.currentTime, true);
        }}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onError={() => setError("这一集暂时无法播放，可能已下线或需要重新取址")}
        onEnded={() => {
          if (next) jump(next);
          else toast("已是最后一集");
        }}
        onClick={toggle}
      />

      {!url && !error ? <div className="player-loading"><Spinner label="正在准备播放" /></div> : null}
      {error ? (
        <div className="player-error">
          <p>{error}</p>
          <button className="btn" type="button" onClick={() => props.nav.back()}>返回详情</button>
        </div>
      ) : null}

      <div className="player-top">
        <button className="player-icon" type="button" onClick={() => props.nav.back()} title="返回"><Icon name="back" size={18} /></button>
        <div className="player-title">
          <b>{series.title}</b>
          <span>{episode.index ? `第 ${episode.index} 集` : ""}</span>
        </div>
        <div className="player-top-right">
          {qualities.length > 1 ? (
            <select className="player-select" value={quality} onChange={(event) => { setQuality(event.target.value); event.currentTarget.blur(); }}>
              {qualities.map((entry) => <option key={entry.name} value={entry.name}>{entry.name}</option>)}
            </select>
          ) : null}
        </div>
      </div>

      <div className="player-bottom">
        <input
          className="player-progress"
          type="range"
          min={0}
          max={Math.max(1, duration)}
          step={0.1}
          value={time}
          onChange={(event) => {
            const video = videoRef.current;
            if (video) video.currentTime = Number(event.target.value);
            setTime(Number(event.target.value));
          }}
        />
        <div className="player-bar">
          <button className="player-icon" type="button" onClick={toggle} title={playing ? "暂停" : "播放"}>
            <Icon name={playing ? "pause" : "play"} size={18} filled />
          </button>
          <button className="player-icon" type="button" onClick={() => seek(-10)} title="后退 10 秒"><span className="seek">−10</span></button>
          <button className="player-icon" type="button" onClick={() => seek(10)} title="前进 10 秒"><span className="seek">+10</span></button>
          <span className="player-time">{clock(time)} <i>/</i> {clock(duration)}</span>
          <span className="player-spacer" />
          <button className="rate-btn" type="button" onClick={() => setRate(nextRate(rate))}>{rate.toFixed(2).replace(/0$/, "")}×</button>
          <button className="player-icon" type="button" onClick={() => setMuted((value) => !value)} title={muted ? "取消静音" : "静音"}>
            <Icon name={muted ? "mute" : "volume"} size={17} />
          </button>
          <button className="player-icon" type="button" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen?.(); else void shell.fullscreen(true); }} title="全屏">
            <Icon name="expand" size={16} />
          </button>
          <button className="player-icon" type="button" disabled={!next} title="下一集" onClick={() => next && jump(next)}>
            <Icon name="next" size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

function nextEpisode(series: Series, episode: Episode): Episode | null {
  const list = series.episodes.filter((entry) => !entry.locked && entry.videoId);
  const index = list.findIndex((entry) => entry.videoId === episode.videoId);
  return index >= 0 ? list[index + 1] ?? null : null;
}

function nextRate(rate: number): number {
  const steps = [1, 1.25, 1.5, 2, 0.5];
  return steps[(steps.indexOf(rate) + 1) % steps.length] ?? 1;
}

function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

