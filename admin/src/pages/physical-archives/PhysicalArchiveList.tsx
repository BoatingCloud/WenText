import { useState, useMemo } from 'react';
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Input,
  List,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  EyeOutlined,
  AppstoreOutlined,
  BankOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  physicalArchiveApi,
  systemConfigApi,
  archiveCategoryApi,
} from '../../services/api';
import type {
  PhysicalArchive,
  PhysicalArchiveStatus,
  ArchiveWorkflowStatus,
  CompanyCatalogItem,
  ArchiveCategory,
} from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import {
  statusOptions,
  workflowOptions,
  statusTagMap,
  workflowTagMap,
  statusLabelMap,
  workflowLabelMap,
} from './constants';

const PhysicalArchiveList: React.FC = () => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PhysicalArchiveStatus | undefined>(undefined);
  const [workflowStatus, setWorkflowStatus] = useState<ArchiveWorkflowStatus | undefined>(undefined);
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);

  const canCreate = hasPermission('archive:create');
  const canUpdate = hasPermission('archive:update');
  const canDelete = hasPermission('archive:delete');

  const { data: settingsData } = useQuery({
    queryKey: ['system-config-public'],
    queryFn: () => systemConfigApi.getPublicTheme(),
  });
  const companyCatalog: CompanyCatalogItem[] = settingsData?.data.data?.companyCatalog || [];

  const companyNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    companyCatalog.forEach((c) => { map[c.code] = c.name; });
    return map;
  }, [companyCatalog]);

  const { data: categoryTreeData } = useQuery({
    queryKey: ['archive-category-tree'],
    queryFn: () => archiveCategoryApi.getTree(),
  });
  const categoryTree = categoryTreeData?.data?.data || [];

  const categoryOptions = useMemo(() => {
    const result: Array<{ label: string; value: string }> = [];

    const walk = (nodes: ArchiveCategory[], ancestors: string[] = []) => {
      nodes.forEach((node) => {
        const names = [...ancestors, node.name];
        const fullName = names.join(' / ');
        result.push({
          value: node.id,
          label: node.isEnabled ? fullName : `${fullName}（已禁用）`,
        });
        if (Array.isArray(node.children) && node.children.length > 0) {
          walk(node.children, names);
        }
      });
    };

    walk(categoryTree);
    return result;
  }, [categoryTree]);

  const { data, isLoading } = useQuery({
    queryKey: ['physical-archives', page, pageSize, search, selectedCategoryId, status, workflowStatus, selectedCompanyCode],
    queryFn: () =>
      physicalArchiveApi.list({
        page,
        pageSize,
        search: search.trim() || undefined,
        categoryId: selectedCategoryId,
        status,
        workflowStatus,
        companyCode: selectedCompanyCode === '__unassigned__' ? '__unassigned__' : selectedCompanyCode || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => physicalArchiveApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physical-archives'] });
    },
  });

  const archives = data?.data.data || [];
  const total = data?.data.pagination?.total || 0;

  const companyListItems = [
    { key: '__all__', code: null as string | null, name: '全部档案', icon: <AppstoreOutlined /> },
    ...companyCatalog.map((c) => ({
      key: c.code,
      code: c.code as string | null,
      name: c.name,
      icon: <BankOutlined />,
    })),
    {
      key: '__unassigned__',
      code: '__unassigned__' as string | null,
      name: '未分配公司',
      icon: <BankOutlined style={{ color: '#999' }} />,
    },
  ];

  const columns: ColumnsType<PhysicalArchive> = [
    { title: '档案编号', dataIndex: 'archiveNo', key: 'archiveNo', width: 160 },
    { title: '档案代码', dataIndex: 'archiveCode', key: 'archiveCode', width: 140 },
    {
      title: '题名',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
      render: (text: string, record: PhysicalArchive) => (
        <a onClick={() => navigate(`/physical-archives/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '所属公司',
      dataIndex: 'companyCode',
      key: 'companyCode',
      width: 120,
      render: (code: string | null) => code ? (companyNameMap[code] || code) : <span style={{ color: '#999' }}>-</span>,
    },
    { title: '档案分类', dataIndex: 'categoryName', key: 'categoryName', width: 180, ellipsis: true },
    { title: '全宗', dataIndex: 'fondsName', key: 'fondsName', width: 100 },
    { title: '年度', dataIndex: 'year', key: 'year', width: 70 },
    { title: '保管位置', dataIndex: 'shelfLocation', key: 'shelfLocation', width: 110 },
    {
      title: '工作流状态',
      dataIndex: 'workflowStatus',
      key: 'workflowStatus',
      width: 110,
      render: (value: ArchiveWorkflowStatus) => (
        <Tag color={workflowTagMap[value] || 'default'}>{workflowLabelMap[value] || value}</Tag>
      ),
    },
    {
      title: '库存状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (value: PhysicalArchiveStatus) => (
        <Tag color={statusTagMap[value] || 'default'}>{statusLabelMap[value] || value}</Tag>
      ),
    },
    {
      title: '附件',
      key: 'attachments',
      width: 70,
      align: 'center',
      render: (_: unknown, record: PhysicalArchive) => {
        const count = record._count?.attachments || 0;
        return count > 0 ? (
          <Badge count={count} size="small">
            <PaperClipOutlined style={{ fontSize: 16 }} />
          </Badge>
        ) : <span style={{ color: '#ccc' }}>-</span>;
      },
    },
    { title: '借阅人', dataIndex: 'borrower', key: 'borrower', width: 90 },
    {
      title: '创建人',
      dataIndex: ['creator', 'name'],
      key: 'creator',
      width: 90,
      render: (_: unknown, record: PhysicalArchive) => record.creator?.name || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_value, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/physical-archives/${record.id}`)}
          >
            查看
          </Button>
          {canUpdate && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/physical-archives/${record.id}/edit`)}
            >
              编辑
            </Button>
          )}
          {canDelete && (
            <Popconfirm
              title="确定删除该实体档案？"
              onConfirm={async () => {
                await deleteMutation.mutateAsync(record.id);
                message.success('实体档案删除成功');
              }}
            >
              <Button size="small" icon={<DeleteOutlined />} danger loading={deleteMutation.isPending}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Row gutter={16} align="top">
      <Col xs={24} md={6} lg={5} xl={4}>
        <Card title="公司分类" size="small">
          <List
            size="small"
            dataSource={companyListItems}
            renderItem={(item) => (
              <List.Item
                onClick={() => {
                  setSelectedCompanyCode(item.code);
                  setPage(1);
                }}
                style={{
                  cursor: 'pointer',
                  backgroundColor:
                    (selectedCompanyCode === null && item.key === '__all__') ||
                    selectedCompanyCode === item.code
                      ? '#e6f4ff'
                      : undefined,
                  padding: '8px 12px',
                  borderRadius: 4,
                  marginBottom: 4,
                }}
              >
                <Space>
                  {item.icon}
                  <span>{item.name}</span>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Col>

      <Col xs={24} md={18} lg={19} xl={20}>
        <Card
          title="实体档案管理"
          extra={
            <Space wrap>
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                prefix={<SearchOutlined />}
                placeholder="搜索编号/代码/题名/责任者"
                style={{ width: 280 }}
                allowClear
              />
              <Select
                allowClear
                showSearch
                placeholder="档案分类"
                value={selectedCategoryId}
                style={{ width: 220 }}
                options={categoryOptions}
                onChange={(v) => { setSelectedCategoryId(v); setPage(1); }}
                optionFilterProp="label"
              />
              <Select
                allowClear
                placeholder="库存状态"
                value={status}
                style={{ width: 120 }}
                options={statusOptions.map(({ label, value }) => ({ label, value }))}
                onChange={(v) => { setStatus(v); setPage(1); }}
              />
              <Select
                allowClear
                placeholder="工作流状态"
                value={workflowStatus}
                style={{ width: 130 }}
                options={workflowOptions.map(({ label, value }) => ({ label, value }))}
                onChange={(v) => { setWorkflowStatus(v); setPage(1); }}
              />
              {canCreate && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/physical-archives/create')}
                >
                  新增档案
                </Button>
              )}
            </Space>
          }
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={archives}
            loading={isLoading}
            scroll={{ x: 1900 }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              },
            }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default PhysicalArchiveList;
