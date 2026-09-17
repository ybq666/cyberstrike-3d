# 🌐 《赛博前线 3D》Cloudflare + GitHub 免费云端部署指南

本项目利用 **Cloudflare Pages（全球静态托管 + 边缘信令 Functions）** 与 **WebRTC P2P 直连技术**，实现了 **100% 永久免费** 的多人在线 3D 射击游戏。

---

## ⚡ 为什么能做到 100% 永久免费？

1. **游戏数据 0 流量消耗**：
   - 玩家进入游戏后，位置移动、枪火、伤害、击杀全部通过浏览器原生的 **WebRTC DataChannel (UDP)** 在玩家之间直连互传（利用 Google 免费 STUN: `stun:stun.l.google.com:19302` 进行穿透）。
   - **完全不需要租用昂贵的游戏服务器或中继节点！**
2. **边缘信令 0 费用**：
   - Cloudflare Pages Functions 提供每天 **100,000 次** 免费请求，仅在房间创建、加入匹配和 SDP 握手瞬间建立极短连接，远超日常玩家使用所需。
3. **前端资源无限流量**：
   - Cloudflare Pages 静态 CDN 提供无限免费带宽、免费 Anycast 全球加速与自动 HTTPS 证书。

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
6. 点击 **保存并部署 (Save and Deploy)**。
7. 等待大约 1 分钟，Cloudflare 会自动识别项目根目录的 `functions/` 边缘函数与静态资源，并为您分配一个专属网址（例如 `https://cyberstrike-3d.pages.dev`）。
8. 复制该网址发给朋友，双方即可在线开黑对战！

---

## 🛠️ 方式二：使用 Wrangler CLI 命令行直接发布

如果您更习惯命令行操作，可以直接在本地终端执行：

```bash
# 1. 构建前端生产包
npm run build

# 2. 登录 Cloudflare (首次需要)
npx wrangler login

# 3. 一键部署到 Cloudflare Pages
npx wrangler pages deploy dist --project-name=cyberstrike-3d
```

---

## 💻 本地双开与局域网多人对战调试

项目已内置无缝的本地开发信令服务器，无需额外安装或启动后端服务：

1. 在终端运行：
   ```bash
   npm run dev
   ```
2. 浏览器打开 [http://localhost:3000](http://localhost:3000)。
3. 再打开一个新标签页（或使用无痕浏览模式窗口，以模拟两个独立玩家）：
   - **窗口 1**：输入昵称（如“特工_阿尔法”），选择青色战甲，点击 **【⚡ 创建新房间并进入】**。
   - **窗口 1**：在游戏画面顶部点击房间码（例如 `CYBER-7A9B`）自动复制邀请链接。
   - **窗口 2**：粘贴邀请链接直接打开，或在加入房间输入框中输入房间码点击 **【加入】**。
4. **两端即时联机对战**：
   - 看到彼此在 3D 竞技场中平滑奔跑、跳跃。
   - 开火、切换等离子枪/霰弹枪/磁轨炮、造成伤害跳字、击杀并触发播报。
   - 按住键盘 **[Tab]** 键可随时查看实时对战战绩榜（击杀数、阵亡数与延迟）。
   - 阵亡后进入 3 秒战术复活倒计时，在随机安全点重新部署并赋予 2 秒无敌护盾！

---

## 📱 移动端支持

手机浏览器（iOS Safari / Android Chrome）打开游戏链接同样支持畅玩：
- 左侧虚拟摇杆走位，右侧屏幕滑动调整瞄准视角。
- 右下角触控按钮支持开火、机瞄、弹跳与快速换弹。
