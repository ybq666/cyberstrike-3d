# 《赛博前线 3D》（Cyberstrike 3D）

一款基于 WebGL 与 Three.js 开发的高品质未来赛博朋克风第一人称 3D 射击游戏（FPS）。具备纯原生 Web Audio API 程序化合成音效、3D武器模型、后坐力动画、浮动伤害数字、战术雷达以及电脑/手机双端触控支持。

![Cyberstrike 3D](https://img.shields.io/badge/Three.js-r170-00f3ff?style=for-the-badge&logo=three.js)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite)
![WebGL](https://img.shields.io/badge/WebGL-2.0-990000?style=for-the-badge&logo=webgl)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

---

## 🎮 游戏特性

- **现代赛博朋克竞技场**：
  - 动态光照、点光源阴影、发光霓虹地网、战术掩体与跳跃垫（Jump Pads）。
- **3D 枪械系统（第一人称视角）**：
  - **1号武器：等离子冲锋枪 (Plasma Blaster)** - 高射速电浆弹，容量大，适合中近距离压制。
  - **2号武器：碎裂重型霰弹枪 (Scatter Cannon)** - 8 发高热霰弹，强冲击力，贴脸爆发极高。
  - **3号武器：湮灭磁轨炮 (Vortex Railgun)** - 穿透即时激光（Hitscan），右键开启 2.5X 高倍电子瞄准镜。
  - 逼真的枪口火焰、开火后坐力抬升、武器晃动（Weapon Sway）及走动呼吸摆动。
- **智能敌人与多波次防御**：
  - **巡航无人机 (Cyber Drone)**：空中机动盘旋，发射等离子光球。
  - **机械潜伏者 (Stalker)**：高速突进地面猎手，近战撕咬。
  - **泰坦重装机甲 (Titan Mech)**：第 4 波 Boss 登场，高血量、双肩电浆飞弹发射槽。
- **视觉打击感与音效反馈**：
  - 命中浮动战斗伤害数字（头部弱点黄色暴击提示 `暴击! -90`）。
  - 白色/黄色击中十字标记（Hitmarker）。
  - 敌人死亡触发霓虹发光碎片大爆炸与冲击波光环。
  - 原生 Web Audio API 全程序化合成音效（开火、轰鸣、磁轨炮穿透、护盾碎裂、拾取、波次警报，零外部音频文件加载延迟）。
- **双端支持**：
  - **PC 端**：鼠标锁定第一人称操作，WASD 移动，Shift 冲刺，Space 弹跳。
  - **移动端**：自动适配虚拟摇杆、划屏视角、专用开火/瞄准/跳跃/换弹/切枪触控按键。

---

## 🕹️ 操作指引

### PC 端键盘与鼠标
| 按键 / 操作 | 动作 |
| :--- | :--- |
| **点击画面** | 锁定鼠标视角 (Pointer Lock) |
| **W / A / S / D** | 前后左右移动走位 |
| **Shift** | 战术冲刺 (消耗耐力) |
| **Space** | 弹跳 / 踩踏重力跳跃垫超高升空 |
| **鼠标移动** | 旋转与瞄准视角 |
| **鼠标左键** | 开火射击 |
| **鼠标右键** | 精确瞄准 (机瞄 / 磁轨炮高倍镜) |
| **R** | 手动装填弹药 |
| **1 / 2 / 3 或 滚轮** | 切换武器 (冲锋枪 / 霰弹枪 / 磁轨炮) |
| **Esc** | 暂停游戏 / 设置 (灵敏度、音量、反转Y轴) |

### 移动端触控
- **左侧虚拟摇杆**：拖动控制移动走位与冲刺。
- **右半屏幕手势**：滑动控制视角旋转与瞄准。
- **右下角触控按键**：开火、机瞄、跳跃、换弹、切枪。

---

## 📦 快速启动与本地运行

```bash
# 1. 克隆代码仓库
git clone https://github.com/ybq666/cyberstrike-3d.git
cd cyberstrike-3d

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 构建生产版本
npm run build
```

浏览器打开 `http://localhost:3000/` 即可进入战场。

---

## 🛠️ 技术栈
- **核心框架**：HTML5 + Vanilla JavaScript (ES Modules)
- **3D 引擎**：[Three.js](https://threejs.org/)
- **打包与构建**：[Vite](https://vitejs.dev/)
- **音频技术**：Web Audio API
- **界面设计**：赛博朋克玻璃拟态（Glassmorphism + Neon Glow）
