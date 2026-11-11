# 彩票模拟器 · Scratch Lottery Simulator

> 把街边刮票和电玩城的经典机台搬进浏览器 —— 纯前端、零安装、断网也能玩。

一个完全离线的彩票刮奖模拟器，当前版本 **6.2**。核心是「刮」这件事的手感：涂层按笔迹逐块剥离、
碎片合成、连刮滑杆、商家风气等细节都做了还原，再用同一套虚拟账本串起 9 种玩法。

技术上没有任何服务器依赖：单文件 HTML 双击即开，Three.js 已内嵌（不走 CDN），存档全部落在
`localStorage`；另附 pywebview + PyInstaller 的 Windows 桌面外壳，可自行打包成单个 exe。

---

## 玩法

| # | 玩法 | 说明 |
|---|------|------|
| 1 | 刮票大厅 | 三档价位的刮刮卡，笔迹刮开涂层，中奖即时结算 |
| 2 | 一键爽刮 | 滑杆控制速度，整张票自动刮完 |
| 3 | 抽卡 | 随机抽取票种，概率与奖池同大厅一致 |
| 4 | 老虎机 | 3D 三滚轮滚动，结果映射到奖池 |
| 5 | 扭蛋机 | 3D 抽球 → 砸开 → 映射结果 |
| 6 | 娃娃机 | 3D 抓爪抓取，物理摆动后落爪 |
| 7 | 大转盘 | 八向辐条转盘，指针停位决定结果 |
| 8 | 骰子台 | 押大 / 押小 / 押豹子，三颗骰子投掷 |
| 9 | 单人麻将 | 3D 电动麻将机，**国标推倒胡**，你 vs 三家 AI |

配套还有：AI 桌宠（可接本地代理对话）、集字卡、道具商店、机打小票、历史记录、每日救济券、
键盘一键操作（`1`~`9` 切玩法、`Tab` 执行主操作、`?` 看帮助）、启动免责提示。

**麻将规则（6.2 起为国标推倒胡）**：136 张牌，无花牌、无宝牌、不设立直 / 振听 / 符数；
凑齐 4 副 + 1 将即可和牌，按 88 番制算番。已实现 56 个番种（含十三幺、九莲宝灯、四暗刻、
清一色、清龙、碰碰和等），含抢杠和、连庄与荒庄。牌桌支持拖拽旋转、滚轮缩放、双指捏合，
顶栏有「全景 / 俯视 / 手牌」三档机位。

---

## 快速开始

### 方式一：在线试玩（零安装）

直接打开 **<https://happyscratchcard.github.io/>**，桌面与手机浏览器均可。断网后请改用方式二。

### 方式二：本地直接玩（离线）

仓库已附带 `dist/彩票模拟器_单文件版.html`（1.5 MB，由源码构建），**双击即可玩**，断网也能用，手机浏览器同样能打开。
根目录的 `index.html` 与它是同一份文件（供 GitHub Pages 作站点入口）；改完源码重跑
`python tools/pack_single.py` 会把两者一并更新，无需手动同步。

### 方式三：跑源码（改代码用这个）

```bash
# 任意静态服务器都行，不能直接双击 index.html（浏览器会拦 file:// 的模块加载）
python -m http.server 8000 --directory src
# 打开 http://localhost:8000
```

### 方式四：桌面版 exe

```bash
pip install -r requirements.txt
python tools/build_exe.py --target all
# 产物：release/彩票模拟器.exe、release/彩票模拟器_多文件版.exe
```

---

## 自行构建

构建分两步，也可以双击 `build.bat` 一键完成。

### 第一步：源码 → 单文件版 HTML

```bash
python tools/pack_single.py
# 输出 dist/彩票模拟器_单文件版.html
# 同时把同一份内容复制为根目录 index.html（GitHub Pages 站点入口）
```

`pack_single.py` 做的事很简单：读 `src/index.html`，把里面的 `<link rel="stylesheet">` 和
`<script src>` 全部替换成内联内容。**不做压缩、不改写代码**，产物与源码逐字对应 —— 所以你改完
`src/js/**` 直接重跑这条命令，就能得到新的单文件版。

根目录 `index.html` 是站点入口，默认随打包自动同步；只想更新 `dist/`、不想动线上入口时加 `--no-site`。

### 第二步：HTML → exe

```bash
python tools/build_exe.py                 # 两个 exe 都打
python tools/build_exe.py --target single # 只打单文件版
python tools/build_exe.py --no-clean      # 复用缓存，快一些
```

产物说明：

| 文件 | 内嵌内容 | 适用场景 |
|------|---------|---------|
| `release/彩票模拟器.exe` | 单个 HTML | 分发单个文件，最小体积 |
| `release/彩票模拟器_多文件版.exe` | 整个 `src/` 目录 | 想带开发者工具调试 |

### 构建环境

- Python 3.9+
- `pip install -r requirements.txt`（pywebview、pyinstaller）
- 打包 exe 需要 Windows（PyInstaller 不支持交叉编译）
- 运行 exe 需要系统装有 **WebView2**（Win10 2004+ 通常自带，否则装 [Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)）

---

## 目录结构

```
scratch-lottery/
├─ src/                       # 源码（多文件版，改这里）
│  ├─ index.html              # 入口页面（结构 + 静态视图块）
│  ├─ css/
│  │  ├─ base.css             # 基础样式（液态玻璃、布局、主题变量）
│  │  └─ upgrade.css          # 6.x 升级样式（弹窗、3D 舞台、麻将、结算面板）
│  ├─ js/
│  │  ├─ core/app.js          # 刮票核心：奖池、涂层、碎片、账本
│  │  ├─ core/cfg.js          # 配置读取
│  │  ├─ core/boot.js         # 启动引导
│  │  ├─ core/disclaimer.js   # 启动温馨提示（碎屑消散动画 + 退出）
│  │  ├─ core/play-history.js # 历史记录
│  │  ├─ core/view-hooks.js   # 视图进入 / 离开的钩子
│  │  ├─ slot/ slot.js        # 老虎机（Three.js）
│  │  ├─ gacha/gacha.js       # 扭蛋机（Three.js）
│  │  ├─ claw/claw.js         # 娃娃机（Three.js）
│  │  ├─ mahjong/             # 麻将七件（规则 / 番种 / AI / 引擎 / 牌面 / 场景 / 界面）
│  │  ├─ pet/                 # AI 桌宠（情绪球引擎 + 对话）
│  │  └─ settings/            # 设置页、悬浮球、管理员配置
│  └─ vendor/three/           # Three.js r149（MIT，本地内嵌，无 CDN）
│     （图标与牌面全部由代码绘制，无外部图片依赖）
├─ desktop/
│  ├─ desktop_app_6x.py       # pywebview 外壳（窗口、DPI、退出、抓帧）
│  └─ app-icon.ico            # exe 图标
├─ tools/
│  ├─ pack_single.py          # src/ → 单文件 HTML
│  └─ build_exe.py            # → exe
├─ index.html                 # GitHub Pages 站点入口（由打包脚本同步，勿手改）
├─ dist/                      # 构建产物（已附带可直接玩的单文件版 HTML）
├─ backend/server.py          # 可选：桌宠聊天代理（填自己的 API Key）
├─ docs/变更清单.md            # 逐轮改动记录（需求 → 实现 → 验证）
├─ build.bat                  # Windows 一键构建
└─ requirements.txt
```

---

## 常见问题

**1. 我改了源码，但 exe 打开还是旧界面？**

exe 的加载顺序是「**exe 同目录的 HTML 优先，缺失才用内嵌副本**」——这是为了让改页面不用重打包。
所以：

- 想让 exe 用新页面：把新 HTML 放到 exe 旁边，命名 `彩票模拟器_单文件版.html`
- 想彻底固化进 exe：重跑 `tools/build_exe.py`
- **只把 exe 单独发给别人时，对方看到的是打包那一刻的版本**，发之前务必重打

**2. 桌宠聊天没反应？**

聊天走本地代理 `http://127.0.0.1:8765/api/chat`，需要自己起 `backend/server.py`。

```bash
cp backend/api_key.example.txt backend/api_key.txt   # 复制模板
# 把 backend/api_key.txt 内容换成你自己的 Key（只留一行）
python backend/server.py
```

不启动后端时桌宠仍可用（表情、互动），只是不能对话。`api_key.txt` 已被 `.gitignore` 排除，不会入库。

**3. 手机能玩吗？**

可以，用手机浏览器打开单文件版 HTML 即可。3D 玩法依赖 WebGL，老年机或低端机会卡。
exe 是 Windows 程序，手机上跑不了。

**4. 存档在哪？会不会丢？**

全部在浏览器 `localStorage`（键前缀 `scratch-6x-`）。清理浏览器数据 / 换浏览器 / 用无痕模式都会丢。
设置页提供「导出存档 / 导入存档」，重要进度建议导出备份。

**5. 麻将怎么和？**

国标推倒胡：4 副（顺子或刻子）+ 1 将（对子）即可和牌，不需要「起手番」。
番种越多分越高，详见游戏内规则说明。东风战，庄家和牌连庄。

---

## 致谢

- [Three.js](https://threejs.org/) r149（MIT License）—— 全部 3D 场景
- [aora-bot](https://github.com/) emotion-ball 引擎 —— 桌宠情绪球渲染（源码原样保留）

---

## ⚠️ 声明

- 本模拟器**仅供游戏规则演示与技巧锻炼用，不涉及任何赌博模式与真实货币交易**。
- 本软件**完全开源免费**，不涉及买断制及订阅制的交易，无内购、无广告、无付费解锁。
- 本项目与任何彩票发行机构、博彩平台均**无关联**，未获其授权，也未与其合作。
- 游戏内的金币、彩票、奖券等**均为虚拟代币**，不可充值、不可提现、不可兑换任何实物或法定货币。
- 开奖结果由本地伪随机数生成，与真实彩票开奖**无任何关联**，不构成任何形式的购彩建议或中奖预测。
- 请勿将本程序用于任何形式的赌博活动；**未成年人请勿使用**。
- 本项目仅用于学习与娱乐，作者不对使用者的任何行为及其后果承担责任。

---

## 许可证

代码以 [MIT License](LICENSE) 发布。第三方组件遵循其各自许可证（见「致谢」）。
