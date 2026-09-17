/**
 * Cloudflare Worker 统一入口服务 (worker.js)
 * 兼容 Cloudflare Workers 原生部署与静态资产分发 (Workers Static Assets)
 */

import { onRequest } from './functions/api/signal.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 优先处理信令与 API 路由
    if (url.pathname === '/api/signal' || url.pathname.startsWith('/api/signal/')) {
      return onRequest({ request, env, ctx });
    }

    // 静态资产分发 (HTML/JS/CSS/图片)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
