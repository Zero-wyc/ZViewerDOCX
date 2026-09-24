# 主题系统实现

## 状态模型（themeStore）

全部主题状态持久化于 localStorage key **`zcontrol-theme-storage`**（zustand persist），核心字段与默认值：

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

深浅切换用 `setMode/setDark`，**不要裸 `set({isDark})`**——`isDark` 是 `mode` 的派生物（auto 时由 matchMedia 物化），破坏 mode 一致性会让 auto 判定失效。

### auto 模式物化

`mode === 'auto'` 时 ThemeProvider 监听 `(prefers-color-scheme: dark)` 的 change 事件，直接 `setState({ isDark })` 物化——消费方只读 `isDark`，无感知 auto 切换；非 auto 模式不挂监听。

## Material You 动态主题

种子色经 `@material/material-color-utilities` 的 `themeFromSourceColor` 生成浅/深两套完整 scheme，输出 27 个 `--md-sys-color-*` 角色 + surface-container 三档（neutral 色调：深色 12/17/22、浅色 94/92/90）+ primary/secondary/tertiary 色阶（13 档 tone）。两套 scheme 按 `种子色 + 强度` 记忆化缓存，供对比度判定复用；非法 hex 回退默认 scheme。

## 颜色强度

用户种子色与深浅各自的中性基底按 sRGB 逐通道线性插值（与 `color-mix(in srgb)` 同义）：

```
SEED_MIX_BASE = { light: '#f3f1f7', dark: '#17161b' }
effectiveSeed = mix(seed, base, intensity / 100)
```

强度 100 直接返回纯种子（默认，与未引入强度前一致）；浅/深两套 scheme 分别用各自基底合成，保证低强度下派生色仍与背景协调。

## 文字对比度自适应

自定义背景会改变文字的实际底色，而玻璃面板又叠了自己的底色——单一全局判定无法同时满足两类页面。实现为**三个作用域的 CSS 变量**：

| 变量组 | 判定依据 | 消费方 |
|---|---|---|
| 根节点（无作用域） | scheme 原生值，**永不切换** | 弹窗（portal 到 body）、硬编码色组件 |
| `--lt-raw-*` | 原始背景（底色 → 壁纸 → 遮罩） | 音乐壳等文字直坐壁纸的页面 |
| `--lt-glass-*` | 含玻璃层的有效背景（`surface-container × glassStrength`） | 顶栏、播放页、迷你条等主题驱动玻璃面 |

### 合成算法（`bgContrast.ts`）

按 UI 渲染顺序在 sRGB 空间逐通道叠加：

```
底色 → 壁纸（opacity 混合，32×32 canvas 降采样平均色） → 白遮罩 → 黑遮罩 → 玻璃面板层
```

- 壁纸平均色用 32×32 canvas（`willReadFrequently`）求均值，结果按 URL 缓存（含失败）；**背景高斯模糊不改变平均亮度，不触发重采样**。
- 玻璃层必须计入——深色模式的深玻璃会压暗文字底色，不计入会导致误判。
- 判定规则：对侧 scheme 文字色的对比度需比当前侧**高出 1.0**（切换幅度阈值）才切换，防临界抖动。覆盖变量仅四个中性文字色：`on-surface / on-surface-variant / outline / outline-variant`。

## 主题编辑栏

主题菜单一级左栏（打开即展开），Zen 主题编辑器五段式：模式切换（auto ✨ / 浅色 ☀ / 深色 🌙）→ 取色页（SV 二维区 + 色相条 + Hex）→ 颜色强度滑块 → 预设 10 色网格 + 收藏色板 → 实时预览。

**收藏色板动作语义**（单向数据流，无隐式副作用）：

- 点圆点 = 应用该颜色（纯切换，不触碰色板）。
- 取色页「收藏」= 新增；「更新收藏」= 原位更新被编辑条目（仅从收藏色进入取色页时出现）；两按钮在当前色已收藏时禁用。
- 🗑 = 仅移出收藏板，不改变正在使用的主题色。

## 玻璃拟态变量体系

ThemeProvider 注入一组派生变量，所有玻璃组件引用同一套工具类（`.glass` / `.glass-strong` / `.glass-card` / `.glass-bg`），不各写各的：

| 变量 | 公式 |
|---|---|
| `--glass-blur` | `${glassBlur}px` |
| `--glass-blur-strong` | `min(40, glassBlur + 4)px` |
| `--glass-blur-mask` | `glassBlur × 0.4`（弹窗蒙层取 40%） |
| `--glass-bg` | `rgba(surface-container-rgb, glassStrength)` |
| `--glass-border` | `rgba(rgb, min(1, strength + 0.15))` |

`:root` 静态兜底值保证 ThemeProvider 挂载前（登录卡片首帧）即可生效。**lightningcss 压缩陷阱**：`-webkit-backdrop-filter` 必须写在标准属性之前，否则压缩去重后保留最后一条导致 Safari 失效。

## 入场动画与 Backdrop Root 约定

这组约定来自多次真实故障复盘，写样式前应先读一遍：

- **入场动画 fill 一律 `backwards`，禁用 `both/forwards`**：终帧与自然状态一致即可。`both/forwards` 会让元素动画结束后永久保持 transform，成为 **Backdrop Root**，后代玻璃层的 `backdrop-filter` 采样不到元素外背景直接失效（封面页毛玻璃丢失的根因）。exit 动画（终态消失）才用 forwards。
- **弹出面板定位不依赖 transform**（如 `-translate-x-1/2` 居中）：keyframes 全程接管 transform 的动画期间偏移会丢失、结束跳位。居中/偏移用 `left/top + 负 margin` 或 `right` 定位；Dropdown 组件用 fixed + 数值内联定位 + 按 placement 覆写 `transformOrigin`。
- **filter 也会制造 Backdrop Root**：`filter: drop-shadow(...)` 这类效果要分发到子元素，不能写在包含 glass-card 弹窗的容器上（播放队列弹窗模糊丢失的根因）。
- **`overflow-y-auto` 会连带 `overflow-x: auto`**：滚动容器会裁掉 absolute 悬出的弹窗——滚动容器不包弹窗锚点，或弹窗改 fixed/sheet。
- **absolute 背景覆盖层必须 `pointer-events-none`**：定位元素绘制在非定位流内容之上，无 pointer-events 的冰霜/底色层会吞掉同容器内交互元素的点击。
- **滑动条挂 `touch-slider`**（`touch-action: none`），防止触屏拖动连带页面滚动；hover 才显形的控件挂 `lt-touch-visible`（`pointer: coarse` 下常显）。

### 精简动画

开启时快照当前值到 `_reducedMotionPrev`（不持久化）并锁定：`glassStrength: 1, glassBlur: 0, backgroundBlur: 0, listenTogetherBlur: 0`；关闭时恢复。`[data-reduced-motion='true']` 挂 Layout 根容器裁剪动画；`[data-no-hover-transform='true']` 挂 **document.body**（portal 组件同样生效），通过覆盖 Tailwind translate/scale 变量实现全局关闭 hover 位移。

## 自定义背景渲染（Layout.tsx）

```
背景层（fixed z-0） → 白遮罩 → 黑遮罩 → 内容层（relative z-auto）
```

- 默认壁纸 `/Nacho3.jpg`；自定义壁纸 opacity 直接生效，默认壁纸封顶 0.85。
- **transform 组合顺序固定**：`translate(x/2%, y/2%) scale(s) rotate(r)`——translate 在前，避免缩放中心扩张吃掉偏移；百分比除以 2 限制最大偏移 ±50%。位置不用 `background-position`（百分比在 cover 下某方向无溢出时完全无效）。
- 内容层 `z-auto` 不创建层叠上下文，glass-card 的 backdrop-filter 才能跨层采样到 z-0 背景图。
- 模糊随房间模式切换：`roomMode === 'listen-together' ? listenTogetherBlur : backgroundBlur`。
