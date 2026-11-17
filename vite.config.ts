import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * 皮肤构建：产物必须是「相对基址 + 单一 index.html」的静态站点。
 *
 * `base: "./"` 让 `assets/...` 相对引用；皮肤整站挂在 `skin://localhost/` 根上，
 * 两种基址都能跑，但相对基址能顺带兼容 `--no-skin` 之外的自测场景（file:// 预览）。
 */
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome110",
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // 固定文件名：便于皮肤包比对与缓存；冲突风险由单入口保证。
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
