import { create } from 'zustand';
import type {
  ChannelStatus,
  MCPStatus,
  SessionInfo,
  StatusResponse,
  WSMessage,
} from '../api/types';

type Theme = 'light' | 'dark' | 'system';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('nanobot-theme') as Theme | null;
  if (stored) return stored;
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
};

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', isDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
};

// Apply initial theme
applyTheme(getInitialTheme());

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const currentTheme = useAppStore.getState().theme;
  if (currentTheme === 'system') {
    applyTheme('system');
  }
});

interface AppState {
  // UI State
  sidebarCollapsed: boolean;
  theme: Theme;
  currentSessionKey: string | null;
  currentBotId: string | null;

  // Data State
  status: StatusResponse | null;
  sessions: SessionInfo[];
  channels: ChannelStatus[];
  mcpServers: MCPStatus[];
  isLoading: boolean;
  error: string | null;

  // Toast notifications
  toasts: Toast[];

  // WebSocket (console push via VITE_CONSOLE_WS_URL)
  wsConnected: boolean;
  /** True while the socket is opening or handshaking (not yet OPEN). */
  wsConnecting: boolean;
  wsMessages: WSMessage[];

  /** Nanobot built-in channel WS (Chat `/nanobot-ws`); for header when console push is off. */
  agentWsLinked: boolean;
  agentWsReady: boolean;
  /** Server-issued id from nanobot `ready` frame; tied to the active `/nanobot-ws` connection (per session `client_id`). */
  nanobotChatId: string | null;

  // Actions
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: Theme) => void;
  setCurrentSessionKey: (key: string | null) => void;
  setCurrentBotId: (botId: string | null) => void;

  setStatus: (status: StatusResponse | null) => void;
  setSessions: (sessions: SessionInfo[]) => void;
  setChannels: (channels: ChannelStatus[]) => void;
  setMCPServers: (servers: MCPStatus[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Toast actions
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  setWSConnected: (connected: boolean) => void;
  setWSConnecting: (connecting: boolean) => void;
  addWSMessage: (message: WSMessage) => void;
  clearWSMessages: () => void;

  setAgentWsLinked: (linked: boolean) => void;
  setAgentWsReady: (ready: boolean) => void;
  setNanobotChatId: (chatId: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial UI State
  sidebarCollapsed: false,
  theme: getInitialTheme(),
  currentSessionKey: null,
  currentBotId: localStorage.getItem('nanobot-current-bot-id') || null,

  // Initial Data State
  status: null,
  sessions: [],
  channels: [],
  mcpServers: [],
  isLoading: false,
  error: null,

  // Toast notifications
  toasts: [],

  // WebSocket
  wsConnected: false,
  wsConnecting: false,
  wsMessages: [],

  agentWsLinked: false,
  agentWsReady: false,
  nanobotChatId: null,

  // Actions
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setTheme: (theme) => {
    localStorage.setItem('nanobot-theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  setCurrentSessionKey: (key) => set({ currentSessionKey: key }),
  setCurrentBotId: (botId) => {
    localStorage.setItem('nanobot-current-bot-id', botId || '');
    set({ currentBotId: botId, currentSessionKey: null, nanobotChatId: null });
  },

  setStatus: (status) => set({ status }),
  setSessions: (sessions) => set({ sessions }),
  setChannels: (channels) => set({ channels }),
  setMCPServers: (servers) => set({ mcpServers: servers }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Toast actions
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newToast = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    // Auto remove after duration
    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  setWSConnected: (connected) => set({ wsConnected: connected }),
  setWSConnecting: (connecting) => set({ wsConnecting: connecting }),
  addWSMessage: (message) =>
    set((state) => ({
      wsMessages: [...state.wsMessages.slice(-99), message],
    })),
  clearWSMessages: () => set({ wsMessages: [] }),

  setAgentWsLinked: (linked) => set({ agentWsLinked: linked }),
  setAgentWsReady: (ready) => set({ agentWsReady: ready }),
  setNanobotChatId: (chatId) => set({ nanobotChatId: chatId }),
}));
