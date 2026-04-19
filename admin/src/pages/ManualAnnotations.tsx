import { useEffect, useState } from 'react';
import {
  App, Button, Card, Form, Input, Modal, Select, Space,
  Table, Tag, Typography, Tooltip, Popconfirm, Badge, Tabs,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined,
  CloseOutlined, ReloadOutlined, CommentOutlined,
} from '@ant-design/icons';
import {
  annotationApi,
  type ManualReviewAnnotation,
  type AnnotationType,
  type AnnotationStatus,
  type AnnotationStats,
} from '../services/api';
import type { ColumnsType } from 'antd/es/table';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const ANNOTATION_TYPES = [
  { value: 'RISK', label: '风险点', color: 'red' },
  { value: 'KEY_POINT', label: '关键点', color: 'blue' },
  { value: 'GAP', label: '漏洞/缺失项', color: 'orange' },
  { value: 'COMPLIANCE', label: '合规性问题', color: 'purple' },
  { value: 'SUGGESTION', label: '建议', color: 'green' },
];

const PRIORITY_OPTIONS = [
  { value: 0, label: '低', color: 'default' },
  { value: 1, label: '中', color: 'blue' },
  { value: 2, label: '高', color: 'orange' },
  { value: 3, label: '紧急', color: 'red' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: '活跃', color: 'processing' },
  { value: 'RESOLVED', label: '已解决', color: 'success' },
  { value: 'IGNORED', label: '已忽略', color: 'default' },
];

interface ManualAnnotationsProps {
  reviewId: string;
}

const ManualAnnotations: React.FC<ManualAnnotationsProps> = ({ reviewId }) => {
  const [annotations, setAnnotations] = useState<ManualReviewAnnotation[]>([]);
  const [stats, setStats] = useState<AnnotationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<ManualReviewAnnotation | null>(null);
  const [form] = Form.useForm();
  const [commentForm] = Form.useForm();
  const [resolveForm] = Form.useForm();
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState<AnnotationStatus | 'ALL'>('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = { reviewId };
      if (activeTab !== 'ALL') {
        params.status = activeTab;
      }

      const [annRes, statsRes] = await Promise.all([
        annotationApi.list(params),
        annotationApi.getStats(reviewId),
      ]);

      if (annRes.data.success && annRes.data.data) setAnnotations(annRes.data.data);
      if (statsRes.data.success && statsRes.data.data) setStats(statsRes.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [reviewId, activeTab]);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ priority: 1 });
    setModalOpen(true);
  };

  const openEdit = (ann: ManualReviewAnnotation) => {
    setEditingId(ann.id);
    form.setFieldsValue({
      annotationType: ann.annotationType,
      category: ann.category,
      severity: ann.severity,
      title: ann.title,
      description: ann.description,
      location: ann.location,
      suggestion: ann.suggestion,
      priority: ann.priority,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingId) {
        await annotationApi.update(editingId, values);
        message.success('标注已更新');
      } else {
        await annotationApi.create({ ...values, reviewId });
        message.success('标注已创建');
      }

      setModalOpen(false);
      loadData();
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await annotationApi.delete(id);
      message.success('标注已删除');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const openResolve = (ann: ManualReviewAnnotation) => {
    setSelectedAnnotation(ann);
    resolveForm.resetFields();
    setResolveModalOpen(true);
  };

  const handleResolve = async () => {
    if (!selectedAnnotation) return;
    try {
      const values = await resolveForm.validateFields();
      await annotationApi.resolve(selectedAnnotation.id, values);
      message.success('标注已解决');
      setResolveModalOpen(false);
      loadData();
    } catch { /* validation */ }
  };

  const handleIgnore = async (id: string) => {
    try {
      await annotationApi.ignore(id);
      message.success('标注已忽略');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await annotationApi.reactivate(id);
      message.success('标注已重新激活');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const openComments = (ann: ManualReviewAnnotation) => {
    setSelectedAnnotation(ann);
    commentForm.resetFields();
    setCommentModalOpen(true);
  };

  const handleAddComment = async () => {
    if (!selectedAnnotation) return;
    try {
      const values = await commentForm.validateFields();
      await annotationApi.addComment(selectedAnnotation.id, values);
      message.success('评论已添加');
      commentForm.resetFields();
      loadData();
    } catch { /* validation */ }
  };

  const columns: ColumnsType<ManualReviewAnnotation> = [
    {
      title: '类型',
      dataIndex: 'annotationType',
      key: 'annotationType',
      width: 120,
      render: (type: AnnotationType) => {
        const typeConfig = ANNOTATION_TYPES.find(t => t.value === type);
        return typeConfig ? <Tag color={typeConfig.color}>{typeConfig.label}</Tag> : type;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: number) => {
        const config = PRIORITY_OPTIONS.find(p => p.value === priority);
        return config ? <Tag color={config.color}>{config.label}</Tag> : priority;
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
            {text}
          </Paragraph>
        </Tooltip>
      ),
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      width: 100,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: AnnotationStatus) => {
        const config = STATUS_OPTIONS.find(s => s.value === status);
        return config ? <Tag color={config.color}>{config.label}</Tag> : status;
      },
    },
    {
      title: '标注人',
      dataIndex: 'annotator',
      key: 'annotator',
      width: 100,
      render: (annotator) => annotator?.name || '-',
    },
    {
      title: '评论',
      key: 'comments',
      width: 80,
      render: (_, record) => (
        <Badge count={record._count?.comments || 0}>
          <Button
            size="small"
            icon={<CommentOutlined />}
            onClick={() => openComments(record)}
          />
        </Badge>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'ACTIVE' && (
            <>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              >
                编辑
              </Button>
              <Button
                size="small"
                icon={<CheckOutlined />}
                onClick={() => openResolve(record)}
              >
                解决
              </Button>
              <Popconfirm
                title="确认忽略此标注？"
                onConfirm={() => handleIgnore(record.id)}
              >
                <Button size="small" icon={<CloseOutlined />}>
                  忽略
                </Button>
              </Popconfirm>
            </>
          )}
          {(record.status === 'RESOLVED' || record.status === 'IGNORED') && (
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleReactivate(record.id)}
            >
              重新激活
            </Button>
          )}
          <Popconfirm
            title="确认删除此标注？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: 'ALL', label: `全部 (${stats?.total || 0})` },
    { key: 'ACTIVE', label: `活跃 (${stats?.byStatus?.ACTIVE || 0})` },
    { key: 'RESOLVED', label: `已解决 (${stats?.byStatus?.RESOLVED || 0})` },
    { key: 'IGNORED', label: `已忽略 (${stats?.byStatus?.IGNORED || 0})` },
  ];

  return (
    <Card
      title="人工标注"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建标注
        </Button>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as any)}
        items={tabItems}
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={annotations}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      {/* 创建/编辑标注 */}
      <Modal
        title={editingId ? '编辑标注' : '新建标注'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="annotationType"
            label="标注类型"
            rules={[{ required: true, message: '请选择标注类型' }]}
          >
            <Select placeholder="选择类型">
              {ANNOTATION_TYPES.map(t => (
                <Select.Option key={t.value} value={t.value}>
                  <Tag color={t.color}>{t.label}</Tag>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true }]}
          >
            <Select>
              {PRIORITY_OPTIONS.map(p => (
                <Select.Option key={p.value} value={p.value}>
                  <Tag color={p.color}>{p.label}</Tag>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="category" label="类别">
            <Input placeholder="例如：条款缺失、金额错误" />
          </Form.Item>

          <Form.Item name="severity" label="严重程度">
            <Select placeholder="选择严重程度" allowClear>
              <Select.Option value="低">低</Select.Option>
              <Select.Option value="中">中</Select.Option>
              <Select.Option value="高">高</Select.Option>
              <Select.Option value="严重">严重</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="简要描述问题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="详细描述"
            rules={[{ required: true, message: '请输入详细描述' }]}
          >
            <TextArea rows={4} placeholder="详细说明问题内容" />
          </Form.Item>

          <Form.Item name="location" label="位置">
            <Input placeholder="例如：第3页第2段、第5条款" />
          </Form.Item>

          <Form.Item name="suggestion" label="建议">
            <TextArea rows={3} placeholder="修改建议或解决方案" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 解决标注 */}
      <Modal
        title="解决标注"
        open={resolveModalOpen}
        onCancel={() => setResolveModalOpen(false)}
        onOk={handleResolve}
        destroyOnClose
      >
        <Form form={resolveForm} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item name="resolveNote" label="解决说明">
            <TextArea rows={4} placeholder="说明如何解决此问题" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 评论 */}
      <Modal
        title="评论"
        open={commentModalOpen}
        onCancel={() => setCommentModalOpen(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        {selectedAnnotation && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text strong>{selectedAnnotation.title}</Text>
              <Paragraph>{selectedAnnotation.description}</Paragraph>
            </div>

            <div style={{ marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}>
              {selectedAnnotation.comments?.map((comment) => (
                <Card key={comment.id} size="small" style={{ marginBottom: 8 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <Text strong>{comment.user.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(comment.createdAt).toLocaleString()}
                      </Text>
                    </Space>
                    <Text>{comment.content}</Text>
                  </Space>
                </Card>
              ))}
            </div>

            <Form form={commentForm} onFinish={handleAddComment}>
              <Form.Item
                name="content"
                rules={[{ required: true, message: '请输入评论内容' }]}
              >
                <TextArea rows={3} placeholder="输入评论..." />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  添加评论
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </Card>
  );
};

export default ManualAnnotations;
