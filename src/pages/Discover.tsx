/**
 * 找剧：搜索（联想 + 回车）+ 可收起的筛选栏 + 结果网格（加载更多）。
 *
 * 筛选栏默认展开，收起后仍保留已选条件与结果数——「找剧」页常驻挂载，
 * 切到别的页面再回来，条件与滚动位置都还在。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Nav } from "../App";
import { api } from "../bridge";
import type { FilterGroup, SearchSuggestion, Series } from "../types";
import { Cover, Empty, ErrorNote, Icon, Poster, Spinner } from "../ui";

const MAX_CHIPS = 14;

/**
 * 写死的筛选条件
 * 不依赖 `SelectorPanel`：那个接口在部分设备/风控状态下会返回空，导致「筛选栏消失」。
 * key 与选项 id 都是后端 `Category` 认识的中文原值，不能翻译。
 */
const FILTER_GROUPS: FilterGroup[] = [
  { key: "genre", name: "体裁", options: ["真人剧", "漫剧", "AI剧"].map((name) => ({ id: name, name })) },
  {
    key: "theme", name: "主题", options: [
      "预言", "女性成长", "脑洞", "奇幻", "玄幻", "古言", "战神", "热血", "仙侠", "权谋", "种田", "年代蜜情",
      "喜剧", "悬疑", "青春", "志怪", "民国爱情", "灵异", "家国情怀", "法律", "刑侦", "抗战", "武侠",
      "民国传奇", "动作", "求生", "科幻", "恐怖", "商战",
    ].map((name) => ({ id: name, name })),
  },
  {
    key: "role", name: "设定", options: [
      "打脸虐渣", "大男主", "大女主", "马甲", "重生", "穿越", "系统", "先婚后爱", "家长里短", "小人物",
      "破镜重圆", "神豪", "豪门", "强者回归", "异能", "传承觉醒", "虐恋", "医生", "强强联合", "落魄逆袭",
      "甜宠", "娱乐圈", "神医", "青梅竹马", "姐弟恋", "玄学", "追妻火葬场", "业界精英", "一见钟情", "福宝",
      "扮猪吃虎", "反派主角", "萌宠", "爽文", "双向救赎", "白月光", "灵魂互换", "病娇", "暴富", "黑道",
      "丧尸", "特种兵",
    ].map((name) => ({ id: name, name })),
  },
  {
    key: "background", name: "背景", options: [
      "现代", "都市", "乡村", "古代", "年代", "架空", "职场", "民国", "校园", "宫廷", "荒岛",
    ].map((name) => ({ id: name, name })),
  },
  {
    key: "recommend", name: "推荐", options: [
      { id: "最新上架", name: "最新上架" }, { id: "最高热度", name: "最高热度" }, { id: "最高收藏", name: "最高收藏" },
    ],
  },
  { key: "audience", name: "受众", options: [{ id: "男频", name: "男频" }, { id: "女频", name: "女频" }] },
  { key: "status", name: "状态", options: [{ id: "已完结", name: "已完结" }, { id: "连载中", name: "连载中" }] },
  {
    key: "time", name: "时间", options: [
      { id: "7天内上新", name: "7天内上新" }, { id: "14天内上新", name: "14天内上新" },
      { id: "30天内上新", name: "30天内上新" }, { id: "90天内上新", name: "90天内上新" },
    ],
  },
  {
    key: "duration", name: "长度", options: [
      { id: "0-60分钟", name: "0-60分钟" }, { id: "60-120分钟", name: "60-120分钟" }, { id: "120分钟以上", name: "120分钟以上" },
    ],
  },
];


export function Discover(props: { nav: Nav }) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [focus, setFocus] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [items, setItems] = useState<Series[]>([]);
  const [cursor, setCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyMore, setBusyMore] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const active = useMemo(() => Object.entries(selected).filter(([, ids]) => ids.length > 0), [selected]);
  const activeCount = active.reduce((sum, [, ids]) => sum + ids.length, 0);

  const load = async (reset: boolean) => {
    const id = reset ? ++seq.current : seq.current;
    if (reset) { setLoading(true); setError(""); } else { setBusyMore(true); }
    try {
      const nextCursor = reset ? "" : cursor;
      const result = submitted
        ? await api.search(submitted, nextCursor)
        : active.length
          ? await api.category(Object.fromEntries(active), nextCursor)
          : await api.findTab(nextCursor);
      if (id !== seq.current) return;
      setItems((prev) => (reset ? result.items : [...prev, ...result.items]));
      setCursor(result.cursor);
      setHasMore(result.hasMore);
    } catch (cause) {
      if (id === seq.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (id === seq.current) { setLoading(false); setBusyMore(false); }
    }
  };

  // 筛选/搜索词变化后重新取第一页；搜索词优先于筛选。
  // 注意：**不能**在 submitted 非空时直接 return —— 那会让「回车搜索」只改标签不取数。
  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, submitted]);

  // 搜索联想：220ms 去抖，最多 6 条。
  useEffect(() => {
    const keyword = query.trim();
    if (!keyword || keyword === submitted) { setSuggestions([]); return; }
    const timer = window.setTimeout(() => {
      void api.suggest(keyword).then(
        (list) => setSuggestions((list ?? []).slice(0, 6)),
        () => setSuggestions([]),
      );
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, submitted]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        props.nav.go({ name: "discover" });
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.nav]);

  const submit = (keyword: string) => {
    // 点联想词时把输入框同步成正在搜的词，否则输入框与结果标签会对不上。
    setQuery(keyword.trim());
    setSubmitted(keyword.trim());
    setSuggestions([]);
    inputRef.current?.blur();
  };

  const toggle = (group: FilterGroup, optionId: string) => {
    setSubmitted("");
    setSelected((prev) => {
      const current = prev[group.key] ?? [];
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...prev, [group.key]: next };
    });
  };

  const clearAll = () => { setSelected({}); setSubmitted(""); setQuery(""); };

  return (
    <div className="page discover">
      <header className="page-head">
        <div>
          <div className="eyebrow">EXPLORE</div>
          <h1>找一部今晚想看的</h1>
        </div>
        <form
          className="search-box"
          onSubmit={(event) => { event.preventDefault(); submit(query); }}
        >
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => window.setTimeout(() => setFocus(false), 160)}
            onKeyDown={(event) => {
              // 中文输入法组词中按回车是「上屏」，不能当成提交。
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit(query);
              }
              if (event.key === "Escape") { setSuggestions([]); event.currentTarget.blur(); }
            }}
            placeholder="搜索剧名、演员、题材…（回车）"
            spellCheck={false}
          />
          {query ? <button type="button" className="ghost-icon" onClick={() => { setQuery(""); setSubmitted(""); inputRef.current?.focus(); }}><Icon name="close" size={14} /></button> : null}
          {focus && suggestions.length ? (
            <div className="suggest">
              {suggestions.map((item) => (
                <button key={`${item.seriesId}-${item.word}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => submit(item.word)}>
                  <span className="suggest-cover"><Cover src={item.cover} alt="" /></span>
                  <span className="suggest-copy">
                    <b>{item.word}</b>
                    {item.abstract ? <em>{item.abstract}</em> : null}
                  </span>
                  <Icon name="search" size={13} />
                </button>
              ))}
            </div>
          ) : null}
        </form>
      </header>

      <div className="discover-bar">
        <button className={`chip${panelOpen ? " on" : ""}`} type="button" onClick={() => setPanelOpen((value) => !value)}>
          筛选{activeCount ? ` · ${activeCount}` : ""}
        </button>
        <span className="discover-count">
          {loading ? "正在找剧…" : `${items.length}${hasMore ? "+" : ""} 部`}
          {submitted ? ` · 搜索「${submitted}」` : ""}
        </span>
        <span className="discover-rule" />
        {submitted || activeCount ? <button className="link-btn" type="button" onClick={clearAll}>清空条件</button> : null}
        <button className="link-btn" type="button" onClick={() => void load(true)}>刷新</button>
      </div>

      {panelOpen ? (
        <div className="filters">
          {FILTER_GROUPS.map((group) => {
            const open = expanded[group.key] ?? false;
            const options = open ? group.options : group.options.slice(0, MAX_CHIPS);
            return (
              <div className="filter-row" key={group.key}>
                <span className="filter-name">{group.name}</span>
                <div className="filter-chips">
                  {options.map((option) => (
                    <button
                      key={option.id}
                      className={(selected[group.key] ?? []).includes(option.id) ? "chip on" : "chip"}
                      type="button"
                      onClick={() => toggle(group, option.id)}
                    >
                      {option.name}
                    </button>
                  ))}
                  {group.options.length > MAX_CHIPS ? (
                    <button className="chip ghost" type="button" onClick={() => setExpanded((prev) => ({ ...prev, [group.key]: !open }))}>
                      {open ? "收起" : `+${group.options.length - MAX_CHIPS}`}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {loading ? <Spinner label="正在找剧" /> : null}
      {error ? <ErrorNote message={error} onRetry={() => void load(true)} /> : null}
      {!loading && !error && !items.length ? <Empty title="没有匹配的剧" hint="换个条件试试，或清空筛选" /> : null}

      <div className="grid">
        {items.map((series) => (
          <Poster key={series.id} series={series} onOpen={(value) => props.nav.go({ name: "detail", id: value.id })} />
        ))}
      </div>

      {hasMore ? (
        <div className="load-more">
          <button className="btn" type="button" disabled={busyMore} onClick={() => void load(false)}>
            {busyMore ? "加载中…" : "加载更多"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
