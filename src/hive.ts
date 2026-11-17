/**
 * 蜂巢（局域网浏览器）同构桥。
 *
 * 桌面 WebView 由宿主注入 `window.shortdramabox`；浏览器里没有 `__TAURI_INTERNALS__`，
 * 这里用 `POST /api/call` 补齐同一套接口。**必须早于 React 挂载执行**，
 * 否则首屏就会判定「原生桥未注入」。
 *
 * 只在检测不到宿主桥时安装；桌面注入的桥优先。
 */
type Call = (method: string, args: unknown[]) => Promise<unknown>;

declare global {
  interface Window {
    __hgHive?: boolean;
    __TAURI_INTERNALS__?: unknown;
    shortdramabox?: {
      api: Record<string, (...args: unknown[]) => Promise<unknown>>;
      runtime: Record<string, (...args: never[]) => unknown>;
    };
  }
}

export function installHiveBridge() {
  if (typeof window === "undefined") return;
  if (window.__TAURI_INTERNALS__ || window.shortdramabox) return;
  if (typeof window.fetch !== "function") return;

  let kicked = false;
  const call: Call = async (method, args) => {
    if (kicked) throw new Error("本设备已被主机断开连接");
    const response = await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, args }),
    });
    if (response.status === 403) {
      kicked = true;
      throw new Error("本设备已被主机断开连接");
    }
    const text = await response.text();
    let body: { ok?: boolean; data?: unknown; error?: string } | null = null;
    try { body = JSON.parse(text); } catch { body = null; }
    if (!body) throw new Error(`蜂巢服务响应异常（HTTP ${response.status}）`);
    if (!body.ok) throw new Error(body.error || "调用失败");
    return body.data;
  };

  window.__hgHive = true;
  document.documentElement.classList.add("hive");
  const noop = () => Promise.resolve(null);
  window.shortdramabox = {
    api: new Proxy({}, { get: (_target, method) => (...args: unknown[]) => call(String(method), args) }),
    runtime: {
      EventsOnMultiple: () => () => {},
      ClipboardSetText: (text: unknown) =>
        navigator.clipboard && window.isSecureContext
          ? navigator.clipboard.writeText(String(text)).then(() => true, () => false)
          : Promise.resolve(false),
      WindowFullscreen: () =>
        document.documentElement.requestFullscreen
          ? document.documentElement.requestFullscreen().then(() => null, () => null)
          : Promise.resolve(null),
      WindowUnfullscreen: () => (document.fullscreenElement ? document.exitFullscreen().then(() => null, () => null) : Promise.resolve(null)),
      WindowIsFullscreen: () => !!document.fullscreenElement,
      WindowIsMinimised: () => document.visibilityState === "hidden",
      WindowIsBackgrounded: () => document.visibilityState === "hidden",
      BrowserOpenURL: (url: unknown) => window.open(String(url), "_blank", "noopener"),
      WindowStartDragging: () => null,
      WindowMinimise: noop,
      WindowClose: noop,
      WindowSetAlwaysOnTop: noop,
      WindowSetSize: noop,
      WindowSetMinSize: noop,
      WindowSetPosition: noop,
      WindowSetOpacity: noop,
      WindowSetGlass: noop,
      WindowSetSkipTaskbar: noop,
      WindowSetZoom: noop,
      Quit: noop,
      UiReady: noop,
    },
  };
}
