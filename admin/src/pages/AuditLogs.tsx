import { useState } from 'react';
import { Card, Table, DatePicker, Select, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface AuditLog {
  id: string;
  userId: string;
  user?: { name: string; username: string };
  action: string;
  module: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  status: string;
  createdAt: string;
}

const AuditLogs: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<{
    action?: string;
    module?: string;
    dateRange?: [dayjs.Dayjs, dayjs.Dayjs];
  }>({});

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, pageSize, filters],
    queryFn: () =>
      api.get('/audit-logs', {
        params: {
          page,
          pageSize,
          action: filters.action,
          module: filters.module,
          dateFrom: filters.dateRange?.[0]?.toISOString(),
          dateTo: filters.dateRange?.[1]?.toISOString(),
        },
      }),
  });

  const logs = (data?.data.data || []) as AuditLog[];
  const total = data?.data.pagination?.total || 0;

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 120,
      render: (user: { name: string; username: string } | undefined) =>
        user ? user.name : '-',
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 120,
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 100,
    },
    {
      title: '资源',
      key: 'resource',
      width: 200,
      render: (_: unknown, record: AuditLog) =>
        record.resourceType
          ? `${record.resourceType}: ${record.resourceId?.slice(0, 8)}...`
          : '-',
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 130,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={status === 'SUCCESS' ? 'green' : 'red'}>
          {status === 'SUCCESS' ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (details: Record<string, unknown> | undefined) =>
        details ? (
          <Text type="secondary" ellipsis>
            {JSON.stringify(details)}
          </Text>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <Card
      title="审计日志"
      extra={
        <Space>
          <Select
            placeholder="操作类型"
            allowClear
            style={{ width: 120 }}
            onChange={(value) => setFilters({ ...filters, action: value })}
          >
            <Select.Option value="LOGIN">登录</Select.Option>
            <Select.Option value="LOGOUT">退出</Select.Option>
            <Select.Option value="CREATE">创建</Select.Option>
            <Select.Option value="UPDATE">更新</Select.Option>
            <Select.Option value="DELETE">删除</Select.Option>
          </Select>
          <Select
            placeholder="模块"
            allowClear
            style={{ width: 120 }}
            onChange={(value) => setFilters({ ...filters, module: value })}
          >
            <Select.Option value="AUTH">认证</Select.Option>
            <Select.Option value="USER">用户</Select.Option>
            <Select.Option value="ROLE">角色</Select.Option>
            <Select.Option value="REPO">仓库</Select.Option>
            <Select.Option value="DOC">文档</Select.Option>
          </Select>
          <RangePicker
            onChange={(dates) =>
              setFilters({
                ...filters,
                dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs],
              })
            }
          />
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        scroll={{ x: 1200 }}
      />
    </Card>
  );
};

export default AuditLogs;
