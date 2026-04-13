import { useMemo, useState } from 'react';
import { Alert, Button, Drawer, Empty, Space, Tabs, Typography } from 'antd';
import { Trash2, Wifi } from 'lucide-react';

import { useAppStore } from '../store';
import { isConsoleWebSocketConfigured } from '../hooks/useWebSocket';

const { Text } = Typography;

function formatConsoleMessage(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * Shows live WebSocket payloads: console `/ws` push (when configured) and nanobot
 * channel frames. Data was already stored in the global store; this panel only
 * renders it.
 */
export default function WebSocketDebugPanel() {
  const [open, setOpen] = useState(false);
  const consoleConfigured = isConsoleWebSocketConfigured();
  const wsMessages = useAppStore((s) => s.wsMessages);
  const nanobotWsDebugLines = useAppStore((s) => s.nanobotWsDebugLines);
  const clearWSMessages = useAppStore((s) => s.clearWSMessages);
  const clearNanobotWsDebug = useAppStore((s) => s.clearNanobotWsDebug);

  const consoleReversed = useMemo(
    () => [...wsMessages].reverse(),
    [wsMessages],
  );
  const nanobotReversed = useMemo(
    () => [...nanobotWsDebugLines].reverse(),
    [nanobotWsDebugLines],
  );

  return (
    <>
      <Button
        type="text"
        size="small"
        aria-label="Open WebSocket traffic viewer"
        title="查看 WebSocket 实时数据"
        icon={<Wifi className="w-4 h-4" />}
        onClick={() => setOpen(true)}
      />
      <Drawer
        title="WebSocket 实时数据"
        placement="right"
        width={480}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose={false}
      >
        <Tabs
          items={[
            {
              key: 'console',
              label: `Console /ws (${wsMessages.length})`,
              children: (
                <div className="flex flex-col gap-3">
                  {!consoleConfigured ? (
                    <Alert
                      type="info"
                      showIcon
                      message="未启用控制台推送"
                      description={
                        <span>
                          在{' '}
                          <Text code>.env</Text> 中设置{' '}
                          <Text code>
                            VITE_CONSOLE_WS_URL=ws://localhost:3000/ws
                          </Text>{' '}
                          （经 Vite 代理到后端），后端需实现{' '}
                          <Text code>/ws</Text> 后此处才会出现消息。
                        </span>
                      }
                    />
                  ) : null}
                  <div className="flex justify-end">
                    <Button
                      size="small"
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => clearWSMessages()}
                      disabled={wsMessages.length === 0}
                    >
                      清空
                    </Button>
                  </div>
                  {wsMessages.length === 0 ? (
                    <Empty
                      description={
                        consoleConfigured
                          ? '尚无消息（等待服务端推送）'
                          : '未连接控制台 WebSocket'
                      }
                    />
                  ) : (
                    <div className="max-h-[calc(100vh-220px)] overflow-y-auto space-y-2 pr-1">
                      {consoleReversed.map((msg, index) => (
                        <pre
                          key={`${index}-${msg.type}`}
                          className="text-xs font-mono p-2 rounded bg-gray-100 dark:bg-gray-800/80 whitespace-pre-wrap break-words"
                        >
                          {formatConsoleMessage(msg)}
                        </pre>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'nanobot',
              label: `Nanobot 频道 (${nanobotWsDebugLines.length})`,
              children: (
                <div className="flex flex-col gap-3">
                  <Text type="secondary" className="text-xs">
                    聊天页通过 <Text code>/nanobot-ws</Text> 连接 nanobot
                    内置 WebSocket 通道时的原始帧（含 ready / delta 等）。
                  </Text>
                  <div className="flex justify-end">
                    <Button
                      size="small"
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => clearNanobotWsDebug()}
                      disabled={nanobotWsDebugLines.length === 0}
                    >
                      清空
                    </Button>
                  </div>
                  {nanobotWsDebugLines.length === 0 ? (
                    <Empty description="尚无帧（打开 Chat 并建立会话后可见）" />
                  ) : (
                    <div className="max-h-[calc(100vh-220px)] overflow-y-auto space-y-2 pr-1">
                      {nanobotReversed.map((line, index) => (
                        <div key={`${line.ts}-${index}`}>
                          <Text type="secondary" className="text-[10px]">
                            {new Date(line.ts).toLocaleTimeString()}
                          </Text>
                          <pre className="text-xs font-mono mt-0.5 p-2 rounded bg-gray-100 dark:bg-gray-800/80 whitespace-pre-wrap break-words">
                            {line.body}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
        <Space className="mt-4">
          <Button
            type="link"
            size="small"
            onClick={() => {
              clearWSMessages();
              clearNanobotWsDebug();
            }}
          >
            清空全部
          </Button>
        </Space>
      </Drawer>
    </>
  );
}
