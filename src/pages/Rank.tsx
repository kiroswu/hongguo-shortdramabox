/** 榜单：左侧固定「内容 tab + 子榜」，右侧大序号列表。 */
import { useEffect, useState } from "react";
import type { Nav } from "../App";
import { api } from "../bridge";
import type { RankCategory, RankItem } from "../types";
import { Cover, Empty, ErrorNote, Icon, Spinner, useAsync } from "../ui";

export function Rank(props: { nav: Nav }) {
  const panel = useAsync(() => api.rankPanel(), []);
  const categories: RankCategory[] = panel.data ?? [];
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");

  useEffect(() => {
    if (!categories.length) return;
    const first = categories[0];
    setCat((prev) => prev || first.id);
    setSub((prev) => prev || first.subs?.[0]?.id || "ranklist_hot_sc");
  }, [categories]);

  const current = categories.find((entry) => entry.id === cat);
  const page = useAsync(() => (cat ? api.rank({ selected: cat, sub }) : Promise.resolve(null)), [cat, sub]);
  const [extra, setExtra] = useState<RankItem[]>([]);
  const [cursor, setCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setExtra([]);
    setCursor(page.data?.cursor ?? "");
    setHasMore(page.data?.hasMore ?? false);
  }, [page.data]);

  const loadMore = async () => {
    if (busy || !hasMore) return;
    setBusy(true);
    try {
      const next = await api.rank({ selected: cat, sub }, cursor);
      setExtra((prev) => [...prev, ...next.items]);
      setCursor(next.cursor);
      setHasMore(next.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      setBusy(false);
    }
  };

  const items = [...(page.data?.items ?? []), ...extra];

  return (
    <div className="page rank-page">
      <header className="page-head">
        <div>
          <div className="eyebrow">CHARTS</div>
          <h1>此刻最热的剧</h1>
        </div>
        <p className="page-note">榜单由服务端每小时结算，皮肤只负责呈现。</p>
      </header>

      <div className="rank-layout">
        <aside className="rank-side">
          <div className="rank-group">
            <span className="rank-label">频道</span>
            {categories.map((entry) => (
              <button
                key={entry.id}
                className={entry.id === cat ? "on" : ""}
                type="button"
                onClick={() => { setCat(entry.id); setSub(entry.subs?.[0]?.id ?? ""); }}
              >
                {entry.name}
              </button>
            ))}
          </div>
          {current?.subs?.length ? (
            <div className="rank-group">
              <span className="rank-label">子榜</span>
              {current.subs.map((entry) => (
                <button key={entry.id} className={entry.id === sub ? "on" : ""} type="button" onClick={() => setSub(entry.id)}>
                  {entry.name}
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <section className="rank-main">
          {page.loading ? <Spinner label="正在结算榜单" /> : null}
          {page.error ? <ErrorNote message={page.error} /> : null}
          {!page.loading && !page.error && !items.length ? <Empty title="这个子榜暂时没有数据" /> : null}
          <ol className="rank-list">
            {items.map((item, index) => (
              <li key={item.id}>
                <button type="button" onClick={() => props.nav.go({ name: "detail", id: item.id })}>
                  <span className={`rank-no${index < 3 ? " top" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
                  <span className="rank-cover"><Cover src={item.cover} alt={item.title} /></span>
                  <span className="rank-copy">
                    <span className="rank-title">{item.title}</span>
                    <span className="rank-meta">
                      {[item.score && `${item.score} 分`, item.status, (item.tags ?? []).slice(0, 2).join(" / ")].filter(Boolean).join(" · ")}
                    </span>
                    {item.intro ? <span className="rank-intro">{item.intro}</span> : null}
                  </span>
                  <span className="rank-heat">{item.heat || item.rankText || ""}</span>
                  <span className="rank-go"><Icon name="chevron" size={15} /></span>
                </button>
              </li>
            ))}
          </ol>
          {hasMore ? (
            <div className="load-more">
              <button className="btn" type="button" disabled={busy} onClick={() => void loadMore()}>{busy ? "加载中…" : "继续往下"}</button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
