# 主题系统实现

本页说明主题系统的内部运作方式：主题状态存在哪里、颜色怎样从单个种子色派生出来、玻璃效果由哪些 CSS 变量驱动，以及在自定义背景下文字颜色如何自动调整。

## 状态模型（themeStore）

`themeStore` 是基于 zustand 的状态仓库，负责保存所有主题设置。它通过 zustand 的 persist 中间件，把全部主题状态持久化到 localStorage，key 为 **`zcontrol-theme-storage`**。核心字段与默认值见下表。

| 字段 | 默认值 | 说明 |
|---|---|---|
| `sourceColor` | `#0066cc` | Monet 种子色 |
| `mode` | `'light'` | `auto / light / dark`；`isDark` 是其物化值 |
| `colorIntensity` | `100` | 种子色与中性基底的混合比例 |
| `radius` | `'medium'` | 预设 none 0 / small 8 / medium 16 / large 28 px |
| `glassStrength` / `glassBlur` | `0.6` / `12` | 玻璃透明度 / 模糊度 |
| `backgroundImage` | `null` | URL 或 base64 dataURL（上传限 5MB） |
| `backgroundBlur` / `listenTogetherBlur` | `13` / `0` | 通用背景模糊 / 一起听独立模糊 |
| `backgroundWhiteOverlay` / `BlackOverlay` | `0` | 白/黑遮罩强度 |
| `customColors` | `[]` | 收藏色板，上限 24 条 |

切换深浅色请调用 `setMode` 或 `setDark`，不要直接 `set({isDark})`。`isDark` 是从 `mode` 派生出来的值（`mode` 为 `auto` 时由 matchMedia 物化），直接写它会破坏 `mode` 的一致性，auto 判定随之失效。

### auto 模式物化

auto 模式指跟随系统深浅色。这一节说明系统偏好如何落到 `isDark` 上。

当 `mode === 'auto'` 时，ThemeProvider 会监听 `(prefers-color-scheme: dark)` 的 change 事件，收到变化就直接 `setState({ isDark })` 完成物化。消费方只读 `isDark`，因此感觉不到 auto 切换的过程。非 auto 模式下不挂这个监听。

## Material You 动态主题

Material You 是从单一种子色派生整套配色的设计规范。种子色交给 `@material/material-color-utilities` 的 `themeFromSourceColor` 后，会生成浅色与深色两套完整的配色方案。

每套方案输出 27 个 `--md-sys-color-*` 角色，以及 surface-container 三档（neutral 色调：深色 12/17/22、浅色 94/92/90）和 primary/secondary/tertiary 色阶（13 档 tone）。两套方案按「种子色 + 强度」记忆化缓存，供对比度判定复用。传入非法 hex 时回退到默认方案。

## 颜色强度

颜色强度控制种子色与中性基底混合的比例。数值越低，界面越接近中性灰，种子色的存在感越弱。

用户选定的种子色，会与深浅各自的中性基底在 sRGB 空间逐通道线性插值（与 `color-mix(in srgb)` 同义）：

```
SEED_MIX_BASE = { light: '#f3f1f7', dark: '#17161b' }
effectiveSeed = mix(seed, base, intensity / 100)
```

强度为 100 时直接返回纯种子色，这是默认值，与未引入强度功能时的表现一致。浅色与深色两套方案分别用各自的基底合成，这样在低强度下派生色依然与背景协调。

## 文字对比度自适应

自定义背景会改变文字下方的实际底色，而玻璃面板又有自己的底色，单一的全局判定无法同时覆盖这两类页面。因此实现上分成三个作用域的 CSS 变量分别处理。

| 变量组 | 判定依据 | 消费方 |
|---|---|---|
| 根节点（无作用域） | scheme 原生值，**永不切换** | 弹窗（portal 到 body）、硬编码色组件 |
| `--lt-raw-*` | 原始背景（底色 → 壁纸 → 遮罩） | 音乐壳等文字直坐壁纸的页面 |
| `--lt-glass-*` | 含玻璃层的有效背景（`surface-container × glassStrength`） | 顶栏、播放页、迷你条等主题驱动玻璃面 |

`--lt-raw-*` 与 `--lt-glass-*` 都要按 UI 的渲染顺序合成背景色，合成算法见「合成算法（`bgContrast.ts`）」一节。

### 合成算法（`bgContrast.ts`）

`bgContrast.ts` 负责从背景算出最终的文字底色。计算时按 UI 的渲染顺序，在 sRGB 空间逐通道叠加各层：

```
底色 → 壁纸（opacity 混合，32×32 canvas 降采样平均色） → 白遮罩 → 黑遮罩 → 玻璃面板层
```

合成过程中有三处需要留意。

- 壁纸平均色用 32×32 canvas（`willReadFrequently`）求均值，结果按 URL 缓存（包括失败的情况）。背景高斯模糊不改变平均亮度，因此不触发重采样。
- 玻璃层必须计入。深色模式下的深玻璃会压暗文字底色，不计入就会误判。
- 判定规则是：对侧 scheme 文字色的对比度要比当前侧**高出 1.0**（切换幅度阈值）才切换，避免在临界点反复抖动。覆盖的变量只有四个中性文字色：`on-surface / on-surface-variant / outline / outline-variant`。

## 主题编辑栏

主题编辑栏是设置主题的界面。主题菜单打开后，一级左栏即展开；Zen 主题编辑器分为五段：模式切换（auto ✨ / 浅色 ☀ / 深色 🌙）、取色页（SV 二维区 + 色相条 + Hex）、颜色强度滑块、预设 10 色网格 + 收藏色板、实时预览。

收藏色板的所有操作都遵循单向数据流，没有隐式副作用。

- 点击圆点表示应用该颜色，只做切换，不触碰色板。
- 取色页的「收藏」表示新增，「更新收藏」表示原位更新被编辑的条目（只有从收藏色进入取色页时才出现）；当前色已在收藏中时，两个按钮都禁用。
- 🗑 只把颜色移出收藏板，不改变正在使用的主题色。

## 玻璃变量与工具类

玻璃拟态（半透明加背景模糊的视觉效果）由 ThemeProvider 注入的一组派生变量驱动，所有玻璃组件都引用同一套工具类：`.glass` / `.glass-strong` / `.glass-card` / `.glass-bg`。各变量的计算公式见下表。

| 变量 | 公式 |
|---|---|
| `--glass-blur` | `${glassBlur}px` |
| `--glass-blur-strong` | `min(40, glassBlur + 4)px` |
| `--glass-blur-mask` | `glassBlur × 0.4`（弹窗蒙层取 40%） |
| `--glass-bg` | `rgba(surface-container-rgb, glassStrength)` |
| `--glass-border` | `rgba(rgb, min(1, strength + 0.15))` |

`:root` 中的静态兜底值，保证 ThemeProvider 挂载之前（例如登录卡片的首帧）这些变量就已经生效。用 lightningcss 压缩时要注意：`-webkit-backdrop-filter` 必须写在标准属性之前，否则压缩去重后会保留最后一条，导致 Safari 失效。

## 哪些动画会破坏毛玻璃

Backdrop Root 是浏览器划分模糊采样区域的边界，落在它之外的元素不会被 `backdrop-filter` 模糊到。带 `transform`、`filter` 这类属性的元素会成为 Backdrop Root，这是毛玻璃失效最常见的原因。以下约定都来自实际故障复盘。

- 入场动画的 `animation-fill-mode` 一律用 `backwards`，不要用 `both` 或 `forwards`。原因是这两个值会让元素在动画结束后永久保留 `transform`，成为 Backdrop Root，后代玻璃层的 `backdrop-filter` 采样不到这个元素之外的背景，模糊直接失效——封面页毛玻璃丢失就是这个原因。终帧与自然状态一致即可；只有 exit 动画（结束时元素本来就要消失）才适合用 `forwards`。
- 弹出面板的定位不要依赖 `transform`。用 `-translate-x-1/2` 居中时，如果 keyframes 在动画全程接管 `transform`，动画期间的偏移会丢失，结束时还会跳位。居中与偏移请改用 `left/top` 加负 margin，或用 `right` 定位；Dropdown 组件则用 fixed 定位加数值内联定位，并按 placement 覆写 `transformOrigin`。
- `filter` 同样会制造 Backdrop Root。`filter: drop-shadow(...)` 这类效果要分发到子元素上，不能写在包含 glass-card 弹窗的容器上——播放队列弹窗模糊丢失就是这个原因。
- `overflow-y-auto` 会连带产生 `overflow-x: auto`。滚动容器会裁掉 absolute 悬出的弹窗，因此不要让滚动容器包住弹窗锚点，或者把弹窗改成 fixed / sheet。
- absolute 背景覆盖层必须加上 `pointer-events-none`。定位元素绘制在非定位流内容之上，冰霜层或底色层如果没有 `pointer-events-none`，就会拦截同一容器内交互元素的点击。
- 滑动条挂 `touch-slider`（`touch-action: none`），防止触屏拖动时连带页面滚动。只在 hover 时显形的控件挂 `lt-touch-visible`（`pointer: coarse` 下常显）。

### 精简动画

精简动画开关用于降低界面上的动态效果，减少视觉干扰。开启时，工具会把当前值快照到 `_reducedMotionPrev`（不持久化）并锁定为 `glassStrength: 1, glassBlur: 0, backgroundBlur: 0, listenTogetherBlur: 0`；关闭时从快照恢复。

`[data-reduced-motion='true']` 挂在 Layout 根容器上，用来裁剪动画。`[data-no-hover-transform='true']` 挂在 **document.body** 上（portal 组件同样生效），通过覆盖 Tailwind 的 translate / scale 变量，全局关闭 hover 位移。

## 自定义背景渲染（Layout.tsx）

自定义背景由 `Layout.tsx` 渲染。各图层的堆叠顺序如下。

```
背景层（fixed z-0） → 白遮罩 → 黑遮罩 → 内容层（relative z-auto）
```

- 默认壁纸是 `/Nacho3.jpg`。自定义壁纸的 opacity 直接生效，默认壁纸的 opacity 封顶 0.85。
- `transform` 的组合顺序固定为 `translate(x/2%, y/2%) scale(s) rotate(r)`。translate 必须放在前面，避免缩放中心扩张抵消偏移；百分比除以 2 是为了把最大偏移限制在 ±50%。位置不用 `background-position` 实现，因为百分比在 cover 下某方向无溢出时不生效。
- 内容层用 `z-auto`，不创建层叠上下文，这样 glass-card 的 backdrop-filter 才能跨层采样到 z-0 的背景图。
- 模糊值随房间模式切换：`roomMode === 'listen-together' ? listenTogetherBlur : backgroundBlur`。
