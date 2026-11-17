/** 设置：外观（明暗 / 动效）+ 皮肤信息 + 关于（内容与内置皮肤一致）。 */
import { useEffect, useState } from "react";
import { About } from "../About";
import { api, shell } from "../bridge";
import { Icon } from "../ui";

const THEME_KEY = "aurora.theme";
const MOTION_KEY = "aurora.motion";

export function Settings() {
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"));
  const [motion, setMotion] = useState(() => localStorage.getItem(MOTION_KEY) !== "0");
  /** 二次确认：Tauri 的 WebView 不支持 window.confirm（恒返回 false），用「点两次」代替。 */
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("no-motion", !motion);
    localStorage.setItem(MOTION_KEY, motion ? "1" : "0");
  }, [motion]);

  return (
    <div className="page settings">
      <header className="page-head">
        <div>
          <div className="eyebrow">PREFERENCES</div>
          <h1>设置</h1>
        </div>
        <p className="page-note">外观类设置只作用于这份皮肤；播放与账号仍由宿主管理。</p>
      </header>

      <section className="card">
        <header><h2>外观</h2><span>仅本皮肤生效</span></header>
        <div className="setting-row">
          <div><b>主题</b><span>深色适合夜里看剧，浅色适合白天。</span></div>
          <div className="segment-mini">
            <button className={theme === "dark" ? "on" : ""} type="button" onClick={() => setTheme("dark")}>深色</button>
            <button className={theme === "light" ? "on" : ""} type="button" onClick={() => setTheme("light")}>浅色</button>
          </div>
        </div>
        <div className="setting-row">
          <div><b>界面动效</b><span>关闭后去掉悬停上浮与转场，低配机器更稳。</span></div>
          <button className={`switch${motion ? " on" : ""}`} type="button" role="switch" aria-checked={motion} onClick={() => setMotion((value) => !value)}>
            <i />
          </button>
        </div>
      </section>

      <section className="card">
        <header><h2>皮肤</h2><span>Aurora · 官方示例</span></header>
        <p className="card-note">换肤与恢复默认都在宿主「设置 → 界面皮肤」里完成：上传 zip 后点「重启生效」，出问题会自动回滚到默认皮肤。</p>
        <div className="setting-row">
          <div><b>当前皮肤</b><span>版本 1.0.0 · 契约 apiVersion 1</span></div>
          <span className="badge-soft">已启用</span>
        </div>
        <div className="setting-row">
          <div><b>恢复内置皮肤</b><span>清掉皮肤指针并重启，回到软件自带的界面（托盘菜单里也有同一入口）。</span></div>
          <button
            className={`btn${confirmReset ? " on" : ""}`}
            type="button"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                window.setTimeout(() => setConfirmReset(false), 3000);
                return;
              }
              setConfirmReset(false);
              void api.skinReset().then(() => shell.restart?.());
            }}
          >
            {confirmReset ? "确认恢复并重启" : "恢复默认并重启"}
          </button>
        </div>
        <div className="setting-row">
          <div><b>关闭窗口</b><span>托盘常驻由宿主决定，这里只提供快捷入口。</span></div>
          <button className="btn" type="button" onClick={() => shell.minimise()}><Icon name="close" size={13} /> 最小化</button>
        </div>
      </section>

      <section className="card">
        <header><h2>关于</h2><span>与内置皮肤一致</span></header>
        <About />
      </section>

      <footer className="page-foot">Aurora 皮肤 Demo · 代码即文档，欢迎在此基础上二次开发</footer>
    </div>
  );
}
