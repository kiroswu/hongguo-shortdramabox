/**
 * 「关于」内容：与内置皮肤保持一致（软件名、作者、交流群、外链、版本号）。
 * 设置页与托盘「关于」小窗共用这一份，避免两处文案漂移。
 */
import { useEffect, useState } from "react";
import logo from "./assets/logo.png";
import { api, shell } from "./bridge";
import { toast } from "./toast";
import { Icon } from "./ui";

export const LINKS = {
  site: "https://xorg.ac.cn",
  github: "https://github.com/kiroswu/hongguo-shortdramabox",
  gitee: "https://gitee.com/kiroswu/hongguo-shortdramabox",
  issues: "https://github.com/kiroswu/hongguo-shortdramabox/issues",
  releases: "https://github.com/kiroswu/hongguo-shortdramabox/releases",
};

const AUTHOR = "Kiros Wu";
const QQ_GROUP = "211651420";

export function About(props: { compact?: boolean }) {
  const [version, setVersion] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void api.info().then((info) => setVersion(info.version), () => {});
  }, []);
  const copyGroup = () => {
    shell.clipboard(QQ_GROUP);
    setCopied(true);
    toast("群号已复制");
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className={`about${props.compact ? " compact" : ""}`}>
      <div className="about-brand">
        <img className="about-logo" src={logo} alt="" draggable={false} />
        <div>
          <div className="about-name">短剧盒</div>
          <div className="about-version">{version ? `版本 ${version}` : "版本读取中…"} · 皮肤 Aurora 1.0</div>
        </div>
      </div>
      <p className="about-desc">
        一个把短剧装进桌面的播放器：推荐、找剧、榜单、下载与追更都在本机完成。
        本界面是官方皮肤示例，业务与数据全部来自宿主，皮肤只负责呈现。
      </p>
      <div className="about-rows">
        <div><span>作者</span><b>{AUTHOR}</b></div>
        <div>
          <span>交流群</span>
          <b>
            {QQ_GROUP}
            <button className="link-btn" type="button" onClick={copyGroup}>{copied ? "已复制" : "复制"}</button>
          </b>
        </div>
        <div><span>官方网址</span><button className="link-btn" type="button" onClick={() => shell.openExternal(LINKS.site)}>xorg.ac.cn</button></div>
      </div>
      <div className="about-links">
        {([["GitHub", LINKS.github], ["Gitee", LINKS.gitee], ["问题反馈", LINKS.issues], ["下载地址", LINKS.releases]] as const).map(([label, url]) => (
          <button key={label} className="pill-btn" type="button" onClick={() => shell.openExternal(url)}>
            {label}<Icon name="chevron" size={12} />
          </button>
        ))}
      </div>
    </div>
  );
}
