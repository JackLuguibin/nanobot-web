import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Popconfirm,
  Space,
  Segmented,
  Typography,
  Tag,
  Descriptions,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  DeleteOutlined,
  MessageOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import * as api from '../api/client';
import { useAppStore } from '../store';
import type { SessionInfo } from '../api/types';

const { Text } = Typography;

export default function Sessions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { addToast, currentBotId } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'messages'>('updated');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['sessions', currentBotId],
    queryFn: () => api.listSessions(currentBotId),
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => api.deleteSession(key, currentBotId),
    onSuccess: () => {
      addToast({ type: 'success', message: t('sessions.deleted') });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setSelectedRowKeys([]);
    },
    onError: (error) => {
      addToast({ type: 'error', message: String(error) });
    },
  });

  const createMutation = useMutation({
    mutationFn: (key?: string) => api.createSession(key, currentBotId),
    onSuccess: () => {
      addToast({ type: 'success', message: t('sessions.created') });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (error) => {
      addToast({ type: 'error', message: String(error) });
    },
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return t('common.unknown');
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('common.justNow');
    if (minutes < 60) return t('common.minutesAgo', { count: minutes });
    if (hours < 24) return t('common.hoursAgo', { count: hours });
    if (days < 7) return t('common.daysAgo', { count: days });
    return date.toLocaleDateString();
  };

  const processedSessions = sessions
    ?.filter((session) => {
      const search = searchQuery.toLowerCase();
      return (
        session.key.toLowerCase().includes(search) ||
        (session.title?.toLowerCase().includes(search) ?? false) ||
        (session.last_message?.toLowerCase().includes(search) ?? false)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return (
            new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
          );
        case 'created':
          return (
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          );
        case 'messages':
          return b.message_count - a.message_count;
      }
    });

  const handleBatchDelete = () => {
    selectedRowKeys.forEach((key) => deleteMutation.mutate(String(key)));
  };

  const columns: ColumnsType<SessionInfo> = [
    {
      title: t('sessions.colSession'),
      key: 'session',
      render: (_, session) => (
        <div>
          <Link
            to={`/chat/${session.key}`}
            className="font-medium hover:text-blue-600"
          >
            {session.title || session.key}
          </Link>
          {session.last_message && (
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-sm">
              {session.last_message}
            </p>
          )}
        </div>
      ),
    },
    {
      title: t('sessions.colMessages'),
      dataIndex: 'message_count',
      key: 'message_count',
      width: 110,
      render: (count: number) => (
        <Tag icon={<MessageOutlined />}>{count}</Tag>
      ),
      sorter: (a, b) => a.message_count - b.message_count,
    },
    {
      title: t('sessions.colLastUpdated'),
      key: 'updated_at',
      width: 140,
      render: (_, session) => (
        <span className="flex items-center gap-1 text-gray-500 text-sm">
          <ClockCircleOutlined />
          {formatDate(session.updated_at || session.created_at)}
        </span>
      ),
      sorter: (a, b) =>
        new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime(),
    },
    {
      title: t('sessions.colActions'),
      key: 'actions',
      width: 80,
      render: (_, session) => (
        <Popconfirm
          title={t('sessions.deleteTitle')}
          description={t('sessions.deleteDesc', { name: session.title || session.key })}
          onConfirm={() => deleteMutation.mutate(session.key)}
          okText={t('common.delete')}
          cancelText={t('common.cancel')}
          okButtonProps={{ danger: true }}
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            size="small"
          />
        </Popconfirm>
      ),
    },
  ];

  const expandedRowRender = (session: SessionInfo) => (
    <Descriptions size="small" column={4} className="px-4 py-2">
      <Descriptions.Item label={t('sessions.expandKey')}>
        <Text code className="text-xs">
          {session.key}
        </Text>
      </Descriptions.Item>
      <Descriptions.Item label={t('sessions.expandCreated')}>
        {session.created_at ? new Date(session.created_at).toLocaleString() : '-'}
      </Descriptions.Item>
      <Descriptions.Item label={t('sessions.expandUpdated')}>
        {session.updated_at ? new Date(session.updated_at).toLocaleString() : '-'}
      </Descriptions.Item>
      <Descriptions.Item label={t('sessions.expandMessages')}>{session.message_count}</Descriptions.Item>
    </Descriptions>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            {t('sessions.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('sessions.subtitle')}</p>
        </div>
        <Space>
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title={t('sessions.batchTitle')}
              description={t('sessions.batchDesc', { count: selectedRowKeys.length })}
              onConfirm={handleBatchDelete}
              okText={t('sessions.batchOk')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>
                {t('sessions.batchBtn', { count: selectedRowKeys.length })}
              </Button>
            </Popconfirm>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate(undefined)}
          >
            {t('sessions.newSession')}
          </Button>
        </Space>
      </div>

      {/* Search & Sort */}
      <Space wrap>
        <Input.Search
          placeholder={t('sessions.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onSearch={setSearchQuery}
          allowClear
          style={{ width: 280 }}
        />
        <Segmented
          className="activity-seg-align"
          value={sortBy}
          onChange={(val) => setSortBy(val as typeof sortBy)}
          options={[
            { value: 'updated', label: t('sessions.sortByTime'), icon: <ClockCircleOutlined /> },
            { value: 'messages', label: t('sessions.sortByMessages'), icon: <MessageOutlined /> },
          ]}
        />
      </Space>

      {/* Table */}
      <Table<SessionInfo>
        dataSource={processedSessions}
        columns={columns}
        rowKey="key"
        loading={isLoading}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        expandable={{
          expandedRowRender,
          expandRowByClick: false,
        }}
        locale={{
          emptyText: error ? (
            <div className="text-red-500">{t('sessions.loadError', { error: String(error) })}</div>
          ) : (
            <Space direction="vertical" className="py-6">
              <MessageOutlined className="text-4xl text-gray-300" />
              <span>{t('sessions.empty')}</span>
              <Button
                type="link"
                size="small"
                onClick={() => createMutation.mutate(undefined)}
              >
                {t('sessions.emptyCreate')}
              </Button>
            </Space>
          ),
        }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => t('sessions.paginationTotal', { total }),
        }}
        size="middle"
      />
    </div>
  );
}
