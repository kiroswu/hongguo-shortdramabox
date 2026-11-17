import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installHiveBridge } from "./hive";
import "./styles.css";

/** 主题/动效在首帧前恢复，避免先渲染深色再翻白。 */
if (localStorage.getItem("aurora.theme") === "light") document.documentElement.dataset.theme = "light";
if (localStorage.getItem("aurora.motion") === "0") document.documentElement.classList.add("no-motion");

// 浏览器（蜂巢）里没有宿主注入的桥，先补上再挂载。
installHiveBridge();

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 宿主用它记录启动耗时（没有也不影响）。
const runtime = (window as unknown as { runtime?: Record<string, () => void> }).runtime;
if (typeof runtime?.UiReady === "function") runtime.UiReady();
