# 主题系统实现

主题系统的内部运作：状态模型、颜色如何从单个种子色派生、玻璃效果由哪些 CSS 变量驱动，以及自定义背景下文字颜色如何自动调整。

## 状态模型（themeStore）

`themeStore` 是基于 zustand 的仓库，通过 persist 中间件把全部主题状态持久化到 localStorage，key 为 **`zcontrol-theme-storage`**。

| 字段 | 默认值 | 说明 |
|---|---|---|
| `sourceColor` | `#0066cc` | Monet 种子色 |
| `mode` | `'light'` | `auto / light / dark`；`isDark` 是其物化值 |
| `colorIntensity` | `100` | 种子色与中性基底的混合比例 |
| `radius` | `'medium'` | 预设 none 0 / small 8 / medium 16 / large 28 px |
| `glassStrength` / `glassBlur` | `0.6` / `12` | 玻璃透明度 / 模糊度 |
| `backgroundImage` | `null` | URL 或 base64 dataURL（上传限 5MB） |
| `backgroundBlur` / `listenTogetherBlur` | `13` / `0` | 通用背景模糊 / 一起听独立模糊 |
| `backgroundWhiteOverlay` / `BlackOverlay` | `0` | 白 / 黑遮罩强度 |
| `customColors` | `[]` | 收藏色板，上限 24 条 |

切换深浅色请调用 `setMode` 或 `setDark`，不要直接 `set({isDark})`——`isDark` 由 `mode` 派生（`auto` 时由 matchMedia 物化），直接写会破坏 `mode` 一致性。

### auto 模式物化

`mode === 'auto'` 时 ThemeProvider 监听 `(prefers-color-scheme: dark)` 的 change 事件，变化即 `setState({ isDark })`；消费方只读 `isDark`。非 auto 模式不挂该监听。

## Material You 动态主题

种子色交给 `@material/material-color-utilities` 的 `themeFromSourceColor`，生成浅色与深色两套方案：每套输出 27 个 `--md-sys-color-*` 角色、surface-container 三档（深色 12/17/22、浅色 94/92/90）与 primary/secondary/tertiary 色阶（13 档 tone）。两套方案按「种子色 + 强度」记忆化缓存供对比度判定复用；非法 hex 回退默认方案。

## 颜色强度

强度控制种子色与中性基底在 sRGB 空间的逐通道插值（与 `color-mix(in srgb)` 同义）：

```
SEED_MIX_BASE = { light: '#f3f1f7', dark: '#17161b' }
effectiveSeed = mix(seed, base, intensity / 100)
```

强度为 100 时直接返回纯种子色（默认值，与未引入强度功能时一致）。浅色与深色各用自己的基底合成，低强度下派生色仍与背景协调。

## 文字对比度自适应

自定义背景与玻璃面板各有底色，单一全局判定无法覆盖，因此分成三个作用域的 CSS 变量：

| 变量组 | 判定依据 | 消费方 |
|---|---|---|
| 根节点（无作用域） | scheme 原生值，**永不切换** | 弹窗（portal 到 body）、硬编码色组件 |
| `--lt-raw-*` | 原始背景（底色 → 壁纸 → 遮罩） | 音乐壳等文字直坐壁纸的页面 |
| `--lt-glass-*` | 含玻璃层的有效背景（`surface-container × glassStrength`） | 顶栏、播放页、迷你条等玻璃面 |

### 合成算法（`bgContrast.ts`）

按 UI 渲染顺序在 sRGB 空间逐通道叠加：

```
底色 → 壁纸（opacity 混合，32×32 canvas 降采样平均色） → 白遮罩 → 黑遮罩 → 玻璃面板层
```

- 壁纸平均色用 32×32 canvas（`willReadFrequently`）求均值，结果按 URL 缓存（含失败）。高斯模糊不改变平均亮度，不触发重采样。
- 玻璃层必须计入：深色模式的深玻璃会压暗文字底色，不计入会误判。
- 切换规则：对侧 scheme 文字色的对比度需比当前侧**高出 1.0** 才切换，避免临界点抖动。覆盖变量仅四个中性文字色：`on-surface / on-surface-variant / outline / outline-variant`。

## 主题编辑栏

主题菜单打开后一级左栏即展开；Zen 主题编辑器分五段：模式切换（auto ✨ / 浅色 ☀ / 深色 🌙）、取色页（SV 二维区 + 色相条 + Hex）、颜色强度滑块、预设 10 色网格 + 收藏色板、实时预览。

收藏色板遵循单向数据流：

- 点击圆点表示应用该颜色，只切换，不触碰色板。
- 取色页的「收藏」为新增，「更新收藏」为原位更新被编辑条目（仅从收藏色进入取色页时出现）；当前色已在收藏中时两者都禁用。
- 🗑 只把颜色移出收藏板，不改变当前主题色。

## 玻璃变量与工具类

玻璃拟态由 ThemeProvider 注入的派生变量驱动，组件统一引用 `.glass` / `.glass-strong` / `.glass-card` / `.glass-bg`。

| 变量 | 公式 |
|---|---|
| `--glass-blur` | `${glassBlur}px` |
| `--glass-blur-strong` | `min(40, glassBlur + 4)px` |
| `--glass-blur-mask` | `glassBlur × 0.4`（弹窗蒙层取 40%） |
| `--glass-bg` | `rgba(surface-container-rgb, glassStrength)` |
| `--glass-border` | `rgba(rgb, min(1, strength + 0.15))` |

`:root` 中的静态兜底值保证 ThemeProvider 挂载前（如登录卡片首帧）变量已生效。lightningcss 压缩时 `-webkit-backdrop-filter` 必须写在标准属性之前，否则去重后保留最后一条，Safari 失效。

## 哪些写法会破坏毛玻璃

带 `transform`、`filter` 的元素会成为 Backdrop Root，落在其内的玻璃层采不到外部背景——这是毛玻璃失效最常见的原因。以下约定来自实际故障复盘：

- 入场动画的 `animation-fill-mode` 一律用 `backwards`，不要 `both` / `forwards`：这两个值会让元素永久保留 `transform`（封面页毛玻璃丢失即此原因）。只有 exit 动画适合 `forwards`。
- 弹出面板定位不要依赖 `transform`：用 `-translate-x-1/2` 居中时 keyframes 会接管 `transform`，动画期间偏移丢失且结束跳位。改用 `left/top` 加负 margin、`right` 定位，或 fixed 定位加数值内联定位并按 placement 覆写 `transformOrigin`。
- `filter` 同样制造 Backdrop Root：`drop-shadow` 要分发到子元素，不能写在包含 glass-card 弹窗的容器上（播放队列弹窗模糊丢失即此原因）。
- `overflow-y-auto` 会连带产生 `overflow-x: auto`，滚动容器会裁掉 absolute 悬出的弹窗；不要让滚动容器包住弹窗锚点，或把弹窗改成 fixed / sheet。
- absolute 背景覆盖层必须加 `pointer-events-none`，否则会拦截同容器内交互元素的点击。
- 滑动条挂 `touch-slider`（`touch-action: none`）防止触屏拖动连带滚动；仅 hover 显形的控件挂 `lt-touch-visible`（`pointer: coarse` 下常显）。

### 精简动画

开关开启时把当前值快照到 `_reducedMotionPrev`（不持久化）并锁定 `glassStrength: 1, glassBlur: 0, backgroundBlur: 0, listenTogetherBlur: 0`，关闭时从快照恢复。

`[data-reduced-motion='true']` 挂在 Layout 根容器上裁剪动画；`[data-no-hover-transform='true']` 挂在 **document.body**（portal 组件同样生效），覆盖 Tailwind 的 translate / scale 变量全局关闭 hover 位移。

## 自定义背景渲染（Layout.tsx）

```
背景层（fixed z-0） → 白遮罩 → 黑遮罩 → 内容层（relative z-auto）
```

- 默认壁纸 `/Nacho3.jpg`。自定义壁纸 opacity 直接生效，默认壁纸封顶 0.85。
- `transform` 组合顺序固定为 `translate(x/2%, y/2%) scale(s) rotate(r)`：translate 在前，避免缩放中心扩张抵消偏移；百分比除以 2 把最大偏移限制在 ±50%。位置不用 `background-position`，因为百分比在 cover 下某方向无溢出时不生效。
- 内容层用 `z-auto` 不创建层叠上下文，glass-card 的 backdrop-filter 才能跨层采样 z-0 背景图。
- 模糊值随房间模式切换：`roomMode === 'listen-together' ? listenTogetherBlur : backgroundBlur`。
