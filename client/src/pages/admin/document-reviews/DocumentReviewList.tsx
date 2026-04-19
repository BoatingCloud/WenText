import { useState, useMemo } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  documentReviewApi,
  systemConfigApi,
  userApi,
} from '../../../services/api';
import type {
  DocumentReview,
  DocumentReviewType,
  ReviewStatus,
  CompanyCatalogItem,
} from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import {
  documentTypeOptions,
  reviewStatusOptions,
  documentTypeTagMap,
  reviewStatusTagMap,
  documentTypeLabelMap,
  reviewStatusLabelMap,
} from './constants';

const DocumentReviewList: React.FC = () => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const currentUser = useAuthStore((s) => s.user);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ReviewStatus | undefined>(undefined);
  const [documentType, setDocumentType] = useState<DocumentReviewType | undefined>(undefined);
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string | undefined>(undefined);

  const canCreate = hasPermission('doc-review:create');
  const canView = hasPermission('doc-review:view') || hasPermission('doc-review:view-dept') || hasPermission('doc-review:view-all');
  const canEdit = hasPermission('doc-review:edit-own') || hasPermission('doc-review:edit');
  const canDelete = hasPermission('doc-review:delete-own') || hasPermission('doc-review:delete');

  // 获取系统配置（公司目录）
  const { data: settingsData } = useQuery({
    queryKey: ['system-config-public'],
    queryFn: () => systemConfigApi.getPublicTheme(),
  });
  const companyCatalog: CompanyCatalogItem[] = settingsData?.data.data?.companyCatalog || [];

  // 获取当前用户的公司数据权限
  const { data: companyScopesData } = useQuery({
    queryKey: ['my-company-scopes', currentUser?.id],
    enabled: !!currentUser?.id,
    queryFn: () => userApi.getCompanyScopes(currentUser!.id),
  });
  const isAllCompanies = companyScopesData?.data.data?.isAllCompanies ?? false;
  const myCompanyCodes = companyScopesData?.data.data?.companyCodes ?? [];

  // 根据用户权限过滤可见的公司列表
  const visibleCompanyCatalog = useMemo(() => {
    if (isAllCompanies) return companyCatalog;
    return companyCatalog.filter((c) => myCompanyCodes.includes(c.code));
  }, [companyCatalog, isAllCompanies, myCompanyCodes]);

  const companyNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    companyCatalog.forEach((c) => { map[c.code] = c.name; });
    return map;
  }, [companyCatalog]);

  // 获取文档审查列表
  const { data, isLoading } = useQuery({
    queryKey: ['document-reviews', page, pageSize, status, documentType, selectedCompanyCode],
    queryFn: () =>
      documentReviewApi.list({
        page,
        pageSize,
        status,
        documentType,
        companyCode: selectedCompanyCode,
      }),
  });

  const reviews = data?.data.data || [];
  const total = data?.data.pagination?.total || 0;

  // 删除审查
  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentReviewApi.delete(id),
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['document-reviews'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '删除失败');
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const columns: ColumnsType<DocumentReview> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      ellipsis: true,
      render: (text, record) => (
        <Space>
          <FileTextOutlined />
          <a onClick={() => navigate(`/admin/document-reviews/${record.id}`)}>{text}</a>
        </Space>
      ),
    },
    {
      title: '文档类型',
      dataIndex: 'documentType',
      key: 'documentType',
      width: 120,
      render: (type: DocumentReviewType) => (
        <Tag color={documentTypeTagMap[type]}>{documentTypeLabelMap[type]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: ReviewStatus) => (
        <Tag color={reviewStatusTagMap[status]}>{reviewStatusLabelMap[status]}</Tag>
      ),
    },
    {
      title: '发起人',
      dataIndex: 'initiator',
      key: 'initiator',
      width: 120,
      render: (initiator) => initiator?.name || '-',
    },
    {
      title: '部门',
      dataIndex: 'departmentFullPath',
      key: 'department',
      width: 200,
      render: (fullPath, record) => fullPath || record.department?.name || '-',
    },
    {
      title: '公司',
      dataIndex: 'companyCode',
      key: 'companyCode',
      width: 150,
      render: (code) => (code ? companyNameMap[code] || code : '-'),
    },
    {
      title: '附件数',
      key: 'attachmentCount',
      width: 80,
      align: 'center',
      render: (_, record) => record._count?.attachments || 0,
    },
    {
      title: '标注数',
      key: 'annotationCount',
      width: 80,
      align: 'center',
      render: (_, record) => record._count?.annotations || 0,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => {
        const isOwner = record.initiatorId === currentUser?.id;
        const isDraft = record.status === 'DRAFT';

        return (
          <Space size="small">
            {canView && (
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/admin/document-reviews/${record.id}`)}
              >
                查看
              </Button>
            )}
            {canEdit && isDraft && isOwner && (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/admin/document-reviews/${record.id}/edit`)}
              >
                编辑
              </Button>
            )}
            {canDelete && isDraft && isOwner && (
              <Popconfirm
                title="确定要删除这条审查记录吗？"
                onConfirm={() => handleDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 筛选区域 */}
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Input
              placeholder="搜索标题"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="文档类型"
              value={documentType}
              onChange={setDocumentType}
              allowClear
              style={{ width: '100%' }}
              options={documentTypeOptions}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="审查状态"
              value={status}
              onChange={setStatus}
              allowClear
              style={{ width: '100%' }}
              options={reviewStatusOptions}
            />
          </Col>
          <Col span={5}>
            <Select
              placeholder="所属公司"
              value={selectedCompanyCode}
              onChange={setSelectedCompanyCode}
              allowClear
              style={{ width: '100%' }}
              options={visibleCompanyCatalog.map((c) => ({
                label: c.name,
                value: c.code,
              }))}
            />
          </Col>
          <Col span={5} style={{ textAlign: 'right' }}>
            {canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/admin/document-reviews/new')}
              >
                新建审查
              </Button>
            )}
          </Col>
        </Row>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={reviews}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1400 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Space>
    </Card>
  );
};

export default DocumentReviewList;
