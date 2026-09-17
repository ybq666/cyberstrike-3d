import { defineConfig } from 'vite';
import { devSignalingPlugin } from './server/dev-signal.js';

export default defineConfig({
  base: './',
  plugins: [
    devSignalingPlugin()
  ],
  server: {
    port: 3000,
    open: false,
    host: true
  }
});

