# 🌐 《Kitty Strike 3D》Cloudflare + GitHub 免费云端部署指南

本项目采用 **多通道自愈式 WebRTC 联机引擎 (Multi-Transport Resilient WebRTC Mesh)** 与 **Cloudflare Pages 全球静态加速**，实现了 **100% 永久免费、免租用服务器** 的多人在线 3D 射击游戏。

---

## ⚡ 为什么之前会提示“无法连接网络信令服务器”？

如果您之前在 Cloudflare 部署后看到该提示，通常是由于以下常见原因导致的：
1. **纯静态部署遗漏 Functions 边缘函数**：
   - 如果您之前在 Cloudflare 控制台直接拖拽上传了 `dist` 文件夹（或在命令行执行了 `wrangler pages deploy dist`），Cloudflare **只接收了静态前端网页，没有上传 `functions/` 目录**。
   - 此时浏览器向 `/api/signal` 发起请求时，被单页应用（SPA）重写拦截返回了 `index.html`（返回 200 HTML 页面），导致 WebSocket 握手协议报错失败。
2. **Cloudflare 边缘节点内存孤岛**：
   - Cloudflare Pages Functions 的内存是分布在各个边缘节点中的。房主在亚太节点创建房间，好友在美西节点加入时，如果未配对或跨节点可能互相检索不到房间。
3. **旧版前端在页面加载瞬间发起强制探测**：
   - 旧版启动 1.2 秒内自动拉取房间，若边缘通道未连通立刻粗暴弹窗报错。

---

## 🌟 新版核心升级：多通道自愈信令体系 (开箱即玩)

为了彻底解决以上所有网络痛点，新版本已升级为**四重自愈联机体系**：
- **全球高可用公共信令云通道 (Public MQTT WSS)**：
  - 基于全球开放、高可用的免费公共 WebSocket 信令广播网关（EMQX / HiveMQ）；
  - **无需您自己搭建或维护任何后端服务器**，跨机房、跨运营商毫秒级穿透交换 WebRTC SDP 与 ICE Candidate；
  - 交换完毕后，双方直接建立 **WebRTC P2P 端到端直连 (UDP)**，位置、射击、弹道全部点对点互传，**0 服务器流量与消耗**！
- **Cloudflare Pages 边缘通道双模兼容 (Edge Dual-Mode)**：
  - `functions/api/signal.js` 全面升级，同时支持 **WebSocket 协议升级** 与 **HTTP REST 轮询降级**，并配置了跨域与路由优先级文件 `_routes.json`；
- **智能自愈探测 (Auto-Healing)**：
  - 启动时后台静默探测，绝不阻断报错；
  - 大厅状态栏实时显示信令健康度（🟢 畅通）；
  - 无论您使用何种方式部署，即使纯静态部署未配置 Functions，系统也会在 0.5 秒内自动秒切全球公共信令云，**100% 确保创建房间、加入开黑全部畅通**！

---

## 🚀 方式一：关联 GitHub 一键全自动部署（最推荐）

> 每次您向 GitHub 仓库推送代码时，Cloudflare 会自动完成构建与全球发布。

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)（免费注册账号）。
2. 在左侧菜单中点击 **Workers 和 Pages (Workers & Pages)**。
3. 点击 **创建 (Create)** -> 选择 **Pages** 选项卡 -> 点击 **连接到 Git (Connect to Git)**。
4. 授权并选中您的 GitHub 仓库（例如 `ybq666/cyberstrike-3d`）。
5. 在配置页面中填入构建参数：
   - **项目名称 (Project name)**：`cyberstrike-3d`（或自定义）
   - **生产分支 (Production branch)**：`main`
   - **框架预设 (Framework preset)**：选择 `Vite`
   - **构建命令 (Build command)**：`npm run build`
   - **构建输出目录 (Build output directory)**：`dist`
   - **根目录 (Root directory)**：留空（即项目根目录）
6. 点击 **保存并部署 (Save and Deploy)**。
7. 构建完成后即可访问专属网址（如 `https://cyberstrike-3d.pages.dev`）。

---

## 🛠️ 方式二：使用 Wrangler CLI 命令行直接发布

如果您更习惯命令行操作，可以直接在本地终端执行：

```bash
# 1. 安装依赖并构建生产包
npm run build

# 2. 登录 Cloudflare (首次需要)
npx wrangler login

# 3. 部署到 Cloudflare Pages (包含静态 dist 与 functions 边缘函数)
npx wrangler pages deploy dist --project-name=cyberstrike-3d
```

> 💡 **提示**：新版本构建产物已自动包含 `public/_routes.json`，并将项目根目录的 `wrangler.toml` 生效，无需额外手动配置。

---

## 🎮 大厅网络诊断与通道切换

进入游戏主界面后，您会看到：
- **信令状态指示条**：显示当前连接状态（如 🟢 `联机信令: 全球自愈信令云 (极速畅通)`）；
- **点击【⚙️ 信令网络】按钮**：
  - 可以随时手动切换：
    - **✨ 智能混合自愈模式 (推荐)**
    - **☁️ 全球高可用公共信令云 (免部署，异地开黑最佳)**
    - **🏢 本地 / Cloudflare 专属边缘节点**
  - 支持一键测试与重新探测。

---

## 💻 本地双开与开发测试

1. 在终端运行：
   ```bash
   npm run dev
   ```
2. 浏览器打开两个标签页 [http://localhost:3000](http://localhost:3000) 即可直接模拟两个玩家开黑对战！
