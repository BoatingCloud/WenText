import { useEffect, useState } from 'react';
import {
  App, Badge, Button, Card, Form, Input, Modal, Select, Space,
  Table, Tabs, Tag, Typography, Upload, List, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  UploadOutlined, FileOutlined, ThunderboltOutlined, SendOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  documentReviewApi,
  type DocumentReview,
  type DocumentReviewType,
  type ReviewStatus,
  type DocumentReviewAttachment,
} from '../services/api';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import SignaturePad from '../components/SignaturePad';

const { Text } = Typography;

const DOCUMENT_TYPES = [
  { value: 'CONTRACT', label: '合同' },
  { value: 'LAWYER_LETTER', label: '律师函' },
  { value: 'COLLECTION_LETTER', label: '催款函' },
  { value: 'AGREEMENT', label: '协议' },
  { value: 'NOTICE', label: '通知' },
  { value: 'OTHER', label: '其他' },
];

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: '草稿', color: 'default' },
  { value: 'AI_REVIEWING', label: 'AI审查中', color: 'processing' },
  { value: 'PENDING', label: '待审批', color: 'warning' },
  { value: 'IN_PROGRESS', label: '审批中', color: 'processing' },
  { value: 'APPROVED', label: '已通过', color: 'success' },
  { value: 'REJECTED', label: '已驳回', color: 'error' },
  { value: 'CANCELLED', label: '已取消', color: 'default' },
];

const DocumentReviewsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [reviews, setReviews] = useState<DocumentReview[]>([]);
  const [pendingReviews, setPendingReviews] = useState<DocumentReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<DocumentReview | null>(null);
  const [attachments, setAttachments] = useState<DocumentReviewAttachment[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [signature, setSignature] = useState<string>('');
  const [form] = Form.useForm();
  const [approvalForm] = Form.useForm();
  const { message } = App.useApp();
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await documentReviewApi.list();
      if (res.data.success && res.data.data) setReviews(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingApprovals = async () => {
    try {
      const res = await documentReviewApi.getPendingApprovals();
      if (res.data.success && res.data.data) setPendingReviews(res.data.data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadData();
    loadPendingApprovals();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (review: DocumentReview) => {
    setEditingId(review.id);
    form.setFieldsValue({
      title: review.title,
      documentType: review.documentType,
      departmentId: review.departmentId,
      companyCode: review.companyCode,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingId) {
        await documentReviewApi.update(editingId, values);
        message.success('审查记录已更新');
      } else {
        await documentReviewApi.create(values);
        message.success('审查记录已创建');
      }

      setModalOpen(false);
      loadData();
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await documentReviewApi.delete(id);
      message.success('审查记录已删除');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const openAttachments = async (review: DocumentReview) => {
    setSelectedReview(review);
    setFileList([]);
    try {
      const res = await documentReviewApi.getAttachments(review.id);
      if (res.data.success && res.data.data) {
        setAttachments(res.data.data);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || '加载附件失败');
    }
    setAttachmentModalOpen(true);
  };

  const handleUpload = async (file: File) => {
    if (!selectedReview) return;

    try {
      const res = await documentReviewApi.uploadAttachment(selectedReview.id, file);
      if (res.data.success && res.data.data) {
        message.success('上传成功');
        const attachRes = await documentReviewApi.getAttachments(selectedReview.id);
        if (attachRes.data.success && attachRes.data.data) {
          setAttachments(attachRes.data.data);
        }
        setFileList([]);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || '上传失败');
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedReview) return;

    try {
      await documentReviewApi.deleteAttachment(selectedReview.id, attachmentId);
      message.success('附件已删除');
      setAttachments(attachments.filter(a => a.id !== attachmentId));
    } catch (err: any) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const handleTriggerAI = async (id: string) => {
    try {
      await documentReviewApi.triggerAIReview(id);
      message.success('AI审查已启动');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '启动失败');
    }
  };

  const handleSubmitForApproval = async (id: string) => {
    try {
      await documentReviewApi.submitForApproval(id);
      message.success('已提交审批');
      loadData();
      loadPendingApprovals();
    } catch (err: any) {
      message.error(err.response?.data?.message || '提交失败');
    }
  };

  const openApproveModal = (review: DocumentReview) => {
    setSelectedReview(review);
    approvalForm.resetFields();
    setSignature('');
    setApproveModalOpen(true);
  };

  const openRejectModal = (review: DocumentReview) => {
    setSelectedReview(review);
    approvalForm.resetFields();
    setSignature('');
    setRejectModalOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedReview) return;
    try {
      const values = await approvalForm.validateFields();
      await documentReviewApi.approve(selectedReview.id, {
        comment: values.comment,
        signatureUrl: signature || undefined,
      });
      message.success('审批通过');
      setApproveModalOpen(false);
      loadData();
      loadPendingApprovals();
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const handleReject = async () => {
    if (!selectedReview) return;
    try {
      const values = await approvalForm.validateFields();
      if (!values.comment) {
        message.error('驳回原因不能为空');
        return;
      }
      await documentReviewApi.reject(selectedReview.id, {
        comment: values.comment,
        signatureUrl: signature || undefined,
      });
      message.success('已驳回');
      setRejectModalOpen(false);
      loadData();
      loadPendingApprovals();
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const columns: ColumnsType<DocumentReview> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '文档类型',
      dataIndex: 'documentType',
      key: 'documentType',
      width: 120,
      render: (type: DocumentReviewType) => {
        const config = DOCUMENT_TYPES.find(t => t.value === type);
        return config ? config.label : type;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ReviewStatus) => {
        const config = STATUS_OPTIONS.find(s => s.value === status);
        return config ? <Tag color={config.color}>{config.label}</Tag> : status;
      },
    },
    {
      title: '发起人',
      dataIndex: 'initiator',
      key: 'initiator',
      width: 100,
      render: (initiator) => initiator?.name || '-',
    },
    {
      title: '附件数',
      key: 'attachments',
      width: 80,
      render: (_, record) => record.attachments?.length || 0,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 380,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/document-reviews/${record.id}`)}
          >
            查看
          </Button>
          <Button
            size="small"
            icon={<FileOutlined />}
            onClick={() => openAttachments(record)}
          >
            附件
          </Button>
          {record.status === 'DRAFT' && (
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
                icon={<ThunderboltOutlined />}
                onClick={() => handleTriggerAI(record.id)}
                disabled={!record.attachments || record.attachments.length === 0}
              >
                AI审查
              </Button>
              <Popconfirm
                title="确认提交审批？"
                description="提交后将无法编辑"
                onConfirm={() => handleSubmitForApproval(record.id)}
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<SendOutlined />}
                  disabled={!record.attachments || record.attachments.length === 0}
                >
                  提交审批
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'DRAFT' && (
            <Popconfirm
              title="确认删除此审查记录？"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const pendingColumns: ColumnsType<DocumentReview> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '文档类型',
      dataIndex: 'documentType',
      key: 'documentType',
      width: 120,
      render: (type: DocumentReviewType) => {
        const config = DOCUMENT_TYPES.find(t => t.value === type);
        return config ? config.label : type;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ReviewStatus) => {
        const config = STATUS_OPTIONS.find(s => s.value === status);
        return config ? <Tag color={config.color}>{config.label}</Tag> : status;
      },
    },
    {
      title: '发起人',
      dataIndex: 'initiator',
      key: 'initiator',
      width: 100,
      render: (initiator) => initiator?.name || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/document-reviews/${record.id}`)}
          >
            查看
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => openApproveModal(record)}
          >
            通过
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => openRejectModal(record)}
          >
            驳回
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="文档审查"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建审查
        </Button>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'pending',
            label: <Badge count={pendingReviews.length} size="small" offset={[8, 0]}>待我审批</Badge>,
          },
          { key: 'all', label: '全部审查' },
        ]}
      />

      {activeTab === 'pending' ? (
        <Table
          columns={pendingColumns}
          dataSource={pendingReviews}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={reviews}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      )}

      {/* 创建/编辑审查 */}
      <Modal
        title={editingId ? '编辑审查' : '新建审查'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="例如：XX合同审查" />
          </Form.Item>

          <Form.Item
            name="documentType"
            label="文档类型"
            rules={[{ required: true, message: '请选择文档类型' }]}
          >
            <Select placeholder="选择文档类型">
              {DOCUMENT_TYPES.map(t => (
                <Select.Option key={t.value} value={t.value}>
                  {t.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="departmentId" label="部门">
            <Input placeholder="部门ID（可选）" />
          </Form.Item>

          <Form.Item name="companyCode" label="公司代码">
            <Input placeholder="公司代码（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 附件管理 */}
      <Modal
        title="附件管理"
        open={attachmentModalOpen}
        onCancel={() => setAttachmentModalOpen(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Upload
            fileList={fileList}
            beforeUpload={(file) => {
              handleUpload(file);
              return false;
            }}
            onRemove={() => setFileList([])}
          >
            <Button icon={<UploadOutlined />}>选择文件上传</Button>
          </Upload>

          <List
            dataSource={attachments}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Popconfirm
                    key="delete"
                    title="确认删除此附件？"
                    onConfirm={() => handleDeleteAttachment(item.id)}
                  >
                    <Button size="small" danger>删除</Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<FileOutlined style={{ fontSize: 24 }} />}
                  title={item.fileName}
                  description={
                    <Space>
                      <Text type="secondary">
                        {(item.fileSize / 1024 / 1024).toFixed(2)} MB
                      </Text>
                      <Text type="secondary">
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                      <Text type="secondary">
                        上传人: {item.uploader?.name}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Space>
      </Modal>

      {/* 审批通过 */}
      <Modal
        title="审批通过"
        open={approveModalOpen}
        onOk={handleApprove}
        onCancel={() => setApproveModalOpen(false)}
        destroyOnClose
      >
        <Form form={approvalForm} layout="vertical">
          <Form.Item name="comment" label="审批意见">
            <Input.TextArea rows={3} placeholder="可选，填写审批意见" />
          </Form.Item>
          <Form.Item label="签名（可选）">
            <SignaturePad onConfirm={(url) => setSignature(url)} onClear={() => setSignature('')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 审批驳回 */}
      <Modal
        title="驳回申请"
        open={rejectModalOpen}
        onOk={handleReject}
        onCancel={() => setRejectModalOpen(false)}
        destroyOnClose
      >
        <Form form={approvalForm} layout="vertical">
          <Form.Item name="comment" label="驳回原因" rules={[{ required: true, message: '请填写驳回原因' }]}>
            <Input.TextArea rows={3} placeholder="请填写驳回原因" />
          </Form.Item>
          <Form.Item label="签名（可选）">
            <SignaturePad onConfirm={(url) => setSignature(url)} onClear={() => setSignature('')} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default DocumentReviewsPage;
