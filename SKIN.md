# Aurora 极光 · 官方皮肤示例 / 第三方皮肤契约

短剧盒的**皮肤**是一份构建后的前端产物（zip），跑在宿主提供的 WebView 里。它不是插件：所有业务能力（推荐、找剧、榜单、播放、收藏、登录态…）都通过宿主注入的`window.shortdramabox.api.<Method>` 调用，皮肤只负责界面。直接 `fetch` 官方接口不可用——签名、设备身份与风控都在宿主侧。

本文件分两部分：
**第 1 部分**是第三方制作皮肤必须遵守的契约与规则，
**第 2 部分**是本示例工程（Aurora）的说明。

---

# 第 1 部分 · 第三方皮肤契约与规则

## 1.1 运行模型

| 项 | 规则 |
|---|---|
| 运行位置 | 独立 origin `skin://localhost`（Windows 为 `http://skin.localhost`），与内置皮肤互不影响 |
| 启用范围 | 主窗口、独立播放窗、桌面剧本窗、关于窗**一并切换**到同一份产物 |
| 数据来源 | 只能走 `window.shortdramabox.api.*` 与 `window.shortdramabox.runtime.*`；禁止直连官方接口 |
| 配置权威 | 播放偏好与主题以 `config.json` 为准（启动时 `LoadAppConfig` 注水），不要只依赖 `localStorage` |
| 跨窗通信 | `localStorage` / `BroadcastChannel`，按 origin 隔离；四类窗口已统一 origin |
| 安全模型 | 皮肤是**可执行前端代码**，能读登录态、本地文件、发网络请求；无沙箱、无签名校验，只安装可信来源 |
| 契约版本 | 当前 `API_VERSION = 1`；`skin.json.apiVersion` 不得高于此值 |

## 1.2 四类窗口分流（必须保留）

宿主在页面初始化前注入全局标记，同一份产物据此分流。都没有 = 主窗口。

| 注入标记 | 窗口类型 | 期望行为 |
|---|---|---|
| `window.__hgPlayerWindow` | 独立播放窗 | 只做播放器，读交接快照 |
| `window.__hgLyricWindow` | 桌面剧本窗 | 只显示当前一句台词 |
| `window.__hgAboutWindow` | 关于窗 | 关于页 |
| （三者皆无） | 主窗口 | 完整外壳（含设置页） |

此外宿主会注入 `window.__TAURI_INTERNALS__`（内部 invoke 通道）、`window.shortdramabox.api`
（业务代理）、`window.shortdramabox.runtime`（窗口/系统能力）。后两者挂在同一个 `window.shortdramabox` 对象下。**不要覆盖这些全局对象**。

启动自愈：宿主在挂载探针里回调 `App.SkinBootOk`；连续两次启动未确认会自动停用皮肤并写`reverted.json`（设置页给出提示），皮肤目录保留可重新启用。第三方皮肤**必须**保证页面能挂载到 `#app` 或 `#root`，否则探针不会触发。

## 1.3 包结构与打包

```
index.html          必需，在 zip 根目录（或统一的一层目录内）
assets/…            必需，至少一个 <script src> 指向的本地 JS
skin.json           可选清单
```

```json
{ "name": "我的皮肤", "version": "1.0.0", "author": "你的名字", "apiVersion": 1 }
```

- `apiVersion` 为破坏性变更计数器：契约关键结构变化时 +1，皮肤声明高于程序版本会被拒绝。
- 不带 `skin.json` 按「简易包」处理，`name` 取包 id。
- 资源用 `/` 或 `./` 基址均可（皮肤站在 origin 根上）；**不要**把资源指向外部 CDN。
- zip 内文件直接压在根；忽略 `__MACOSX/`、`.DS_Store`、`._*`。

| 限制项 | 上限 |
|---|---|
| 压缩包 | 30 MB |
| 单文件解压 | 8 MB |
| 解压总量 | 120 MB |
| 条目数 | 1500 |

路径校验：拒绝绝对路径、`..`、盘符、NUL，不跟随符号链接。

## 1.4 安装 / 生效 / 回滚

1. 设置 → 界面皮肤 → **上传皮肤包…**：校验结构、引用文件、体积、路径安全 → 解压到 `<数据目录>/skins/<id>/`（id = zip 的 sha256 前 12 位）→ 自动写 `active.json` 启用。
2. **启用**按钮切换已安装的皮肤；**恢复默认**清 `active.json`（保留皮肤包）。
3. **重启生效**调 `runtime.Restart`；装/启/删都只改本机指针，重启后才加载。
4. 白屏逃生口：系统托盘 → **重置皮肤**（原生菜单，不经过前端）；或命令行 `--no-skin` 本次忽略皮肤。托盘「关于」是原生对话框，皮肤改不了。
5. 蜂巢（局域网浏览器）也走同一份皮肤：`TauriAssets` 先查皮肤目录再回落内嵌产物。

## 1.5 调用约定

所有 `App.*` 方法返回 `Promise`。宿主前端封装统一把它们包成`{ ok: boolean, data?: T, error?: string }`（错误已脱敏）；直接调 `window.shortdramabox.api.*`拿到的是原始值，失败会 reject。

```js
// 推荐写法（与官方前端一致的错误处理）
const result = await call<FeedPage>("RecommendFeed", "16", "");
if (!result.ok) { toastError(result.error); return; }
useState(result.data.items);
```

```js
// 直接调用原生代理
const series = await window.shortdramabox.api.SeriesDetail("12345");
```

`window.shortdramabox.runtime.*` 多为无返回的窗口动作；`EventsOnMultiple(name, cb, max)` 返回取消订阅函数。

## 1.6 契约接口总表 · `window.shortdramabox.api.*`（135 + 2 个宿主内部方法）

> 参数/返回类型取自 `frontend/src/api/native.ts` 的 TS 封装；`void（异步，不等结果）`
> 表示 `callVoid` 不等待结果。类型别名（`Series`、`FeedPage`、`SkinStatus` 等）的完整字段见
> `frontend/src/api/types.ts`，demo 的精简副本见 `skins/demo/src/types.ts`。
> 表中未列的宿主内部方法（`SkinBootOk`、`StealthStop` 等）由原生探针使用，皮肤无需调用。

### 应用状态与皮肤

| 原生方法 `App.<Method>` | 参数 | 返回类型 | 说明 |
|---|---|---|---|
| `Status` | — | `AppStatus` | 后端就绪状态与设备注册状态 |
| `AppInfo` | — | `AppInfo` | — |
| `About` | — | `Info` | 关于信息（版本、仓库、网址等） |
| `Notices` | — | `[]` | 公告列表（当前恒为空数组，宿主保留接口） |
| `GetDataDirInfo` | — | `DataDirInfo` | — |
| `HEVCStatus` | — | `HEVCState` | — |
| `SkinStatus` | — | `SkinStatus` | 当前皮肤状态（契约版本、已装列表、是否回滚） |
| `SkinInstall` | — | `SkinInfo \| null` | 弹系统文件框选 zip 并安装；用户取消返回 null |
| `SkinActivate` | `id: string` | `null` | — |
| `SkinRemove` | `id: string` | `null` | — |
| `SkinReset` | — | `null` | 恢复默认皮肤（清指针），配合 `runtime.Restart` 生效 |

### 更新与设备诊断

| 原生方法 `App.<Method>` | 参数 | 返回类型 | 说明 |
|---|---|---|---|
| `UpdateState` | — | `UpdateStateInfo` | 版本检查状态（只读后端缓存，不触发联网） |
| `CheckUpdate` | — | `UpdateStateInfo` | 立即检查一次（跳过 60s 去抖，真实请求） |
| `UpdateDownload` | — | `UpdateStateInfo` | 开始下载新版本（幂等，进度用 `UpdateState` 轮询） |
| `UpdateCancel` | — | `UpdateStateInfo` | 取消正在进行的下载 |
| `UpdateApply` | — | `{ restarting?: boolean }` | 落盘替换并重启（成功时进程约 400ms 内退出） |
| `RetryDeviceRegister` | — | `void` | 重试匿名设备注册（前端 20s 兜底） |
| `ResetDevice` | — | `void` | 重置匿名设备身份（修复风控导致的空响应） |
| `DiagnoseLocalPlay` | — | `LocalPlayDiag` | — |
| `SetKeepAwake` | `on: boolean` | `void（异步）` | 播放期间阻止系统休眠（幂等，仅桌面端） |
| `SmartDmStatus` | — | `SmartDmState` | 智能弹幕资源状态 |
| `SmartDmPrepare` | — | `SmartDmState` | 按需下载模型与 wasm |
| `SmartDmCancel` | — | `SmartDmState` | 取消准备 |
| `SmartDmReset` | — | `SmartDmState` | 清除已下载资源 |
| `GetStrategyMagic` | — | `StrategyMagicData` | 播放策略魔法值（当前值 + 解码参数） |
| `SetStrategyMagic` | `magic: string` | `SetStrategyMagicResult` | 解码校验 → 热更新 → 持久化 |
| `ResetStrategyMagic` | — | `ResetStrategyMagicResult` | 丢弃已存魔法值，用代码默认重新生成 |

### 推荐 / 找剧 / 榜单 / 日历

| 原生方法 `App.<Method>` | 参数 | 返回类型 | 说明 |
|---|---|---|---|
| `FeedCategories` | — | `FeedCategory[]` | 推荐页顶部分类 |
| `RecommendTab` | `tabType: string, cursor = ""` | `FeedPage` | 单一频道推荐流 |
| `RecommendFeed` | `tabType: string, cursor = ""` | `FeedPage` | 混合推荐流（含榜单，`episode` 可能为 null，前端懒补详情） |
| `Search` | `query: string, cursor = ""` | `SeriesPage` | — |
| `SearchSuggest` | `query: string` | `SearchSuggestion[]` | — |
| `SelectorPanel` | `kind = "default"` | `FilterGroup[]` | 筛选项（部分设备返回空，demo 改为写死筛选条件） |
| `Category` | `filters: Record<string, string[]>, cursor = ""` | `SeriesPage` | — |
| `RankPanel` | — | `RankCategory[]` | 榜单分类与子榜 |
| `Rank` | `sel: { selected; sub; panel?; background? }, cursor = ""` | `RankPage` | `selected`=内容 tab / `sub`=子榜 / `panel`=筛选项 / `background`=月榜 |
| `NewSeries` | `gender: string, cursor = ""` | `SeriesPage` | — |
| `FindTab` | `cursor = ""` | `SeriesPage` | — |
| `Calendar` | `date: string, cursor = ""` | `CalendarPage` | 日历（预约/上线） |

### 详情 / 播放 / 分享

| 原生方法 `App.<Method>` | 参数 | 返回类型 | 说明 |
|---|---|---|---|
| `SeriesDetail` | `seriesId: string` | `Series` | — |
| `SeriesSeasons` | `seriesId: string` | `SeriesSeason[]` | — |
| `Related` | `seriesId: string` | `RelatedSeries` | — |
| `NextSeason` | `seriesId: string, seasonIndex: number` | `SeasonRef \| null` | — |
| `PlayInfo` | `seriesId: string, videoId: string` | `PlayInfo` | 取播放地址与清晰度列表 |
| `PrefetchPlay` | `videoIds: string[], quality = "", warm = false` | `void（异步）` | 预取后续集；`quality` 传当前档位名（小写），`warm=true` 预热媒体代理 |
| `SaveProgress` | `series, episodeIndex, videoId, positionSec, flush` | `void（异步）` | 保存播放进度（`episodeIndex` 为播放器 0 基下标） |
| `WatchedEpisodes` | `seriesId: string` | `{ videoIds: string[] }` | 已看分集（选集面板置灰用） |
| `WatchSync` | — | `null` | 宿主 60s 节拍内部调用（本地追更/预约观测），皮肤无需主动调用 |
| `ShareLink` | `series: { id, title }, videoId: string` | `{ text; url; short? }` | 生成官方 `/s/<code>/` 短链，失败回退长链 |
| `ShareResolve` | `text: string` | `ShareResolveResult` | 解析剪贴板分享文案，返回剧集详情 |
| `ResolveShare` | `text: string` | `unknown` | — |

### 收藏 / 点赞 / 历史 / 追更 / 预约

| 原生方法 `App.<Method>` | 参数 | 返回类型 | 说明 |
|---|---|---|---|
| `SetFavorite` | `seriesId: string, enabled: boolean` | `void` | — |
| `SetLike` | `seriesId: string, videoId: string, enabled: boolean` | `void` | — |
| `RemoveFavorites` | `seriesIds: string[]` | `void` | — |
| `RemoveLikes` | `refs: { seriesId; videoId }[]` | `void` | — |
| `Favorites` | `cursor = "", kind = "", force = false` | `SeriesPage` | `force=true` 阻塞等同步完成 |
| `Likes` | `cursor = "", kind = "", force = false` | `SeriesPage` | — |
| `History` | `cursor = "", force = false` | `HistoryPage` | — |
| `DeleteHistory` | `refs: { seriesId; videoId; episodeIndex }[]` | `void` | — |
| `SetFollowUpdate` | `seriesId: string, enabled: boolean` | `void` | — |
| `IsFollowingUpdate` | `seriesId: string` | `boolean` | — |
| `FollowUpdates` | `cursor = "", force = false` | `SeriesPage` | — |
| `SetReservation` | `seriesId, enabled, series?: Partial<Reservation>` | `void` | — |
| `Reservations` | `online: boolean, cursor = "", force = false` | `ReservationPage` | `online` 区分已上线/待上线 |
| `RecordSeries` | `series: Series` | `void（异步）` | 记录剧集到本地库 |
| `LocalState` | `seriesId: string, videoId: string` | `LocalState` | 本地观看状态 |

### 消息中心

| 原生方法 `App.<Method>` | 参数 | 返回类型 | 说明 |
|---|---|---|---|
| `Messages` | — | `MessageState` | — |
| `MessagesSync` | — | `MessageState & { added? }` | 拉追更/预约 + 生成消息 |
| `MessageRead` | `id: string` | `MessageState` | — |
| `MessagesReadAll` | — | `MessageState` | — |
| `MessagesReadKind` | `kind: "follow" \| "reserve"` | `MessageState` | 按类型置读（未登录也生效） |
| `MessagesClear` | — | `MessageState` | — |

### 听书 / 多窗口

| 原生方法 `App.<Method>` | 参数 | 返回类型 | 说明 |
|---|---|---|---|
| `ListenFeed` | `tab, category, offset, session` | `{ items; tabs; categories; hasMore; nextOffset; session? }` | `session` 翻页凭据必须原样带回 |
| `ListenSearch` | `query: string` | `{ items: ListenCard[] }` | — |
| `ListenChapters` | `bookId, audioBookId` | `{ audioBookId; chapters; firstItemId }` | — |
| `ListenDetail` | `bookId: string` | `ListenDetailData` | — |
| `LyricWindow` | `action: "toggle"\|"open"\|"close"\|"status"` | `{ open: boolean }` | 桌面剧本窗开关 |
| `PlayerWindow` | `action, edge = "right", ratio = 0.5` | `{ open?; ratio? }` | 独立播放窗分离/合流/查询 |
| `ListenDurations` | `audioBookId, itemIds: string[]` | `{ durations: Record<string, number> }` | — |
| `ListenChapter` | `bookId, itemId, index = -1` | `ListenChapterText` | — |
| `ListenPlayURL` | `bookId, itemId, toneId = ""` | `{ url; duration; encrypted }` | — |

### 评论 / 弹幕 / 剧评 / 主创

| 原生方法 `App.<Method>` | 参数 | 返回类型 | 说明 |
|---|---|---|---|
| `Comments` | `seriesId, itemId, cursor = ""` | `CommentPage` | — |
| `Replies` | `seriesId, itemId, parentId, cursor = ""` | `CommentPage` | — |
| `SendComment` | `seriesId, itemId, text` | `Comment` | — |
| `MentionList` | `seriesId: string` | `MentionUser[]` | @ 候选（含 AI bot「小果」） |
| `SendMention` | `seriesId, itemId, text, aiUid, commentIds` | `Comment` | `text` 不含「@小果AI」 |
| `SendReply` | `seriesId, itemId, parentId, replyId, targetUserId, text, isDanmaku?, timeMs?` | `Comment` | — |
| `DeleteComment` | `commentId, kind` | `void` | kind = comment/reply/danmaku/review/review_reply |
| `LikeComment` | `commentId: string, liked: boolean` | `void` | — |
| `Danmaku` | `seriesId, videoId, startMs, endMs` | `Danmaku[]` | — |
| `SendDanmaku` | `seriesId, videoId, text, timeMs` | `Danmaku` | — |
| `LikeDanmaku` | `videoId, danmakuId, liked` | `void` | — |
| `Reviews` | `seriesId, cursor = ""` | `ReviewPage` | — |
| `ReviewReplies` | `reviewId, cursor = ""` | `CommentPage` | — |
| `SendReview` | `seriesId, text, score` | `Comment` | — |
| `SendReviewReply` | `reviewId, replyId, text` | `Comment` | — |
| `LikeReview` | `reviewId, liked` | `void` | — |
| `CreatorProfile` | `userId: string, name = ""` | `CreatorProfile` | 主创主页 |

### 账户

| 原生方法 `App.<Method>` | 参数 | 返回类型 | 说明 |
|---|---|---|---|
| `AccountStatus` | — | `AccountStatusData` | — |
| `AccountSendCode` | `mobile: string` | `SendCodeResult` | 短信验证码（含重发等待秒数） |
| `AccountLogin` | `mobile, code` | `LoginResultData` | 可能直接成功或转 MFA |
| `AccountMfaPoll` | — | `LoginResultData` | 每 3s 轮询一次 |
| `AccountQrStart` | — | `QrLoginStartData` | 取二维码（base64 整图 + 有效期） |
| `AccountQrPoll` | `loginId: string` | `QrLoginPollData` | 每 1.5s 轮询一次 |
| `AccountQrCancel` | `loginId: string` | `{ ok: boolean }` | — |
| `AccountLogout` | — | `{ loggedIn: boolean }` | — |
| `AccountRefresh` | — | `AccountStatusData` | 刷新昵称/头像；会话过期报错 |
| `AccountSetShare` | `share: boolean` | `{ share; config }` | 蜂巢「局域网共用当前账户」 |

### 配置 / 本地文件 / 摸鱼皮肤

| 原生方法 `App.<Method>` | 参数 | 返回类型 | 说明 |
|---|---|---|---|
| `LoadAppConfig` | — | `AppConfigData` | 启动注水，配置权威来源 |
| `SaveAppConfig` | `config: AppConfigData` | `void（异步）` | — |
| `SlackSkin` | `path: string` | `{ dataUrl: string }` | 本地 PNG → data URL（WebView 不能直读文件） |
| `PickSlackSkin` | — | `string` | 系统文件选择器；取消返回空串 |
| `PickDirectory` | — | `string` | 文件夹选择器；取消返回空串 |
| `RevealFile` | `path: string` | `void` | 在系统文件管理器中定位 |

### 蜂巢（局域网）

| 原生方法 `App.<Method>` | 参数 | 返回类型 | 说明 |
|---|---|---|---|
| `HiveStatus` | — | `HiveStatusData` | — |
| `HiveStart` | `port: number` | `HiveStatusData` | — |
| `HiveStop` | — | `HiveStatusData` | — |
| `HiveClients` | — | `{ items: HiveClient[] }` | 在线设备 |
| `HiveSessions` | — | `{ items: HiveSession[] }` | 连接历史 |
| `HiveSessionsClear` | — | `{ removed: number }` | 仅桌面端可调用 |
| `HiveDisconnect` | `id: string` | `unknown` | 断开设备并终止媒体流 |

### 下载 / 截图 / 片段导出

| 原生方法 `App.<Method>` | 参数 | 返回类型 | 说明 |
|---|---|---|---|
| `DownloadStart` | `series, videoId, episodeIndex, quality = ""` | `DownloadItem` | — |
| `DownloadList` | — | `{ items: DownloadItem[] }` | — |
| `DownloadRemove` | `id, withFile = false` | `void` | — |
| `DownloadCancel` | `id: string` | `void` | — |
| `DownloadAllStart` | `series, episodes, quality = "", merge = false, range = ""` | `DownloadBatch` | `range` 为 1 基集数范围，如 `"1-10,15-18"`；空串=全部 |
| `DownloadBatchList` | — | `{ items: DownloadBatch[] }` | — |
| `DownloadBatchCancel` | `id: string` | `void` | — |
| `DownloadBatchRemove` | `id, withFiles = false` | `void` | — |
| `DownloadMerge` | `series, videoIds: string[]` | `DownloadMerge` | 按集号拼接，不重编码 |
| `DownloadMergeList` | — | `{ items: DownloadMerge[] }` | — |
| `DownloadMergeRemove` | `id, withFile = false` | `void` | — |
| `SaveFrame` | `title, episode, seconds, pngBase64` | `{ filePath; fileName }` | 保存当前播放帧到下载目录 |
| `ClipExportStart` | `series, videoId, episodeIndex, quality, start, end` | `ClipState` | MP4 无损截取 |
| `ClipStatus` | — | `ClipState` | — |
| `ClipCancel` | — | `ClipState` | — |
| `SaveClipGif` | `title, episode, start, end, gifBase64` | `{ filePath; fileName; bytes }` | GIF 由前端编码后落盘 |

## 1.7 契约接口总表 · `window.shortdramabox.runtime.*`（30 + 2 个）

| `runtime.<Method>` | 参数 | 返回 / 说明 |
|---|---|---|
| `EventsOnMultiple` | `name: string, cb: (payload) => void, max: number` | 订阅原生事件，返回取消订阅函数（`max=-1` 不限次） |
| `ClipboardSetText` | `text: string` | `Promise<boolean>`；桥内直接用 `navigator.clipboard` 实现 |
| `WindowSetAlwaysOnTop` | `on: boolean` | 窗口置顶 |
| `WindowFullscreen` / `WindowUnfullscreen` | — | 进入 / 退出全屏 |
| `WindowIsFullscreen` | — | `Promise<boolean>` |
| `WindowIsLiveResizing` | — | `Promise<boolean>`； macOS 拖拽缩放中，前端应让路 |
| `WindowGetSize` / `WindowSetSize` | `w, h` | 取尺寸 / 设尺寸 |
| `WindowSetAspect` | `aspect: number` | `Promise<boolean>`；小窗黄金比例（0 = 关闭） |
| `WindowSetMinSize` | `w, h` | 最小尺寸 |
| `WindowGetPosition` / `WindowSetPosition` | `x, y` | 取 / 设窗口位置 |
| `WindowToggleMaximise` / `WindowUnmaximise` | — | 最大化切换 / 还原 |
| `WindowIsMaximised` / `WindowIsMinimised` / `WindowIsBackgrounded` | — | `Promise<boolean>`；后端态，区分页面 hidden 与真实最小化/托盘 |
| `WindowMinimise` / `WindowClose` | — | 最小化 / 关闭 |
| `WindowStartDragging` | — | 无边框窗口拖动（顶栏空白处调用） |
| `WindowStartResizeDragging` | `direction: string` | 边缘缩放：`n/s/e/w/ne/nw/se/sw` |
| `WindowSetOpacity` | `alpha: number` | 0.3~1；Linux 空操作 |
| `WindowSetGlass` | `on: boolean, dark = true` | 系统级毛玻璃；Linux 空操作 |
| `WindowSetZoom` | `scale: number` | 1~3 原生 WebView 缩放 |
| `WindowSetSkipTaskbar` | `skip: boolean` | 任务栏图标显隐（摸鱼模式） |
| `WindowPrimaryButtonDown` | — | `Promise<boolean \| null>`；左键是否按下，null=平台不支持 |
| `UiReady` | — | 首帧已提交，原生据此显示主窗口（**皮肤必须调用**） |
| `ScreenGetAll` | — | 屏幕信息列表 |
| `Quit` | — | 退出应用（走完整清理与锁释放） |
| `Restart` | — | 重启（走完整清理 → 释放单实例锁 → 拉起新进程） |
| `BrowserOpenURL` | `url: string` | 用系统默认浏览器打开外链，不在 WebView 内新建窗口 |

## 1.8 换肤边界（能做 / 不做）

| 能做 | 不做 |
|---|---|
| 任意布局、配色、字体、动效 | 修改宿主 Rust 侧行为 |
| 调用上表全部原生方法 | 跳过宿主直连官方接口（无签名能力） |
| 增删页面与交互流程 | 依赖皮肤之外的 origin 存储（与内置皮肤不互通） |
| 自带图标与静态资源 | 覆盖 `window.shortdramabox` / `__TAURI_INTERNALS__` |
| 二次实现高级能力 | 直接继承画质增强 / AI 景深弹幕 / 热力条 / 软解（Demo 不含，需自行对接） |

---

# 第 2 部分 · 示例工程 Aurora

本示例刻意与内置皮肤做成两套视觉：**深墨底 + 琥珀金 + 衬线标题 + 顶部横向导航 + 影院式货架**，
没有侧栏，也不包含任何高级前端算法（画质增强、AI 景深弹幕、热力条、软解等）。

## 构建与安装

```bash
npm install
npm run pack        # = tsc --noEmit && vite build && node scripts/pack.mjs
```

产物：`aurora-skin.zip`。在「设置 → 界面皮肤 → 上传皮肤包…」选择它，然后点「重启生效」。恢复默认同样在那一栏；也可从系统托盘「重置皮肤」。设置页另有「获取皮肤」按钮，用系统浏览器打开 <https://xorg.ac.cn/>。

只想本地看效果：`npm run dev`，但**必须**从宿主打开（浏览器里没有原生桥，会提示桥未注入）。

## 目录

```
src/
  main.tsx        入口（主题恢复 + 挂载 + UiReady）
  App.tsx         外壳 / 顶栏 / 路由栈 / 四类窗口分流
  bridge.ts       原生桥封装（唯一的数据出口）
  hive.ts         蜂巢（局域网浏览器）同构桥：没有宿主桥时用 /api/call 补齐
  types.ts        与宿主对齐的数据契约副本
  ui.tsx          封面降级、海报卡、货架、图标
  toast.tsx       轻量提示
  About.tsx       关于内容（与内置皮肤一致）
  pages/          Home / Discover / Rank / Library / Detail / Player / Settings
  styles.css      全部样式（无 CSS 框架）
public/skin.json   清单，由 Vite 复制到 dist 根，pack.mjs 再打成 zip
```

## 示例中的契约实践

- **封面必须走降级链**：官方封面多为签名 `.heic`，Windows 解不了，要换成`p3-novel.byteimg.com/novel-pic/<id>~tplv-shrink:640:0.image`（见 `ui.tsx::Cover`）；  主视觉用 `episode.cover`（横版剧照）并回退到剧集封面。
- **筛选条件写死**在 `pages/Discover.tsx`（与内置一致的中文 id），不依赖 `SelectorPanel`—— 部分设备会返回空，导致筛选栏整块消失。
- **切页不重新取数**：主页面 + 设置常驻挂载，切换只切显隐（`App.tsx`），并各自记住滚动位置。
- **顶栏空白处可拖动窗口**，通过 `runtime.WindowStartDragging` 实现。
- **播放偏好/主题以宿主 `config.json` 为权威**；外观开关只写自己的 `localStorage`（`aurora.theme` / `aurora.motion`），不污染宿主配置。
- **主页 Hero 固定 600px**（窄屏 440px），不随窗口高度变化；背景剧照不做模糊，靠「左深右浅」蒙版兼顾文字可读与剧照可辨。

## 许可

作为短剧盒官方示例，随主工程一同发布；二次开发请保留「短剧盒」名称、LOGO与关于页主要信息，可以增加署名和链接。
