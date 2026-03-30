/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_HOST?: string;
  readonly VITE_API_PORT?: string;
  /** 控制台实时推送完整 ws URL；未设置则不连接。例：`ws://localhost:3000/ws`（Vite 开发 + 代理） */
  readonly VITE_CONSOLE_WS_URL?: string;
  /** 默认 `/nanobot-ws`（未设置时）；设为空字符串可关闭；或 `ws://127.0.0.1:8765` 直连 */
  readonly VITE_NANOBOT_WS_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
