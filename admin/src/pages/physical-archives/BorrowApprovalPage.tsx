import { useEffect, useState } from 'react';
import {
  App, Badge, Button, Card, Descriptions, Form, Input, Modal, Space, Table, Tabs, Tag, Timeline, Typography,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, AuditOutlined } from '@ant-design/icons';
import {
  borrowRequestApi,
  type BorrowRequest,
  type BorrowRequestStatus,
} from '../../services/api';
import SignaturePad from '../../components/SignaturePad';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const statusMap: Record<BorrowRequestStatus, { label: string; color: string }> = {
  PENDING: { label: '待审批', color: 'orange' },
  IN_PROGRESS: { label: '审批中', color: 'processing' },
  APPROVED: { label: '已通过', color: 'success' },
  REJECTED: { label: '已驳回', color: 'error' },
  CANCELLED: { label: '已取消', color: 'default' },
};

const BorrowApprovalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [data, setData] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<BorrowRequest | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [signature, setSignature] = useState<string>('');
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const loadData = async (tab: string, page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      let res;
      if (tab === 'pending') {
        res = await borrowRequestApi.myPending({ page, pageSize });
      } else if (tab === 'my') {
        res = await borrowRequestApi.myApplications({ page, pageSize });
      } else {
        res = await borrowRequestApi.list({ page, pageSize });
      }
      if (res.data.success) {
        setData(res.data.data || []);
        setPagination({
          page: res.data.pagination?.page || page,
          pageSize: res.data.pagination?.pageSize || pageSize,
          total: res.data.pagination?.total || 0,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  const viewDetail = async (id: string) => {
    try {
      const res = await borrowRequestApi.get(id);
      if (res.data.success && res.data.data) {
        setCurrentRequest(res.data.data);
        setDetailOpen(true);
      }
    } catch { /* */ }
  };

  const handleApprove = async () => {
    try {
      const values = await form.validateFields();
      await borrowRequestApi.approve(currentRequest!.id, {
        comment: values.comment,
        signatureUrl: signature || undefined,
      });
      message.success('审批通过');
      setApproveOpen(false);
      setDetailOpen(false);
      setSignature('');
      form.resetFields();
      loadData(activeTab);
    } catch { /* */ }
  };

  const handleReject = async () => {
    try {
      const values = await form.validateFields();
      if (!values.comment) {
        message.error('驳回原因不能为空');
        return;
      }
      await borrowRequestApi.reject(currentRequest!.id, {
        comment: values.comment,
        signatureUrl: signature || undefined,
      });
      message.success('已驳回');
      setRejectOpen(false);
      setDetailOpen(false);
      setSignature('');
      form.resetFields();
      loadData(activeTab);
    } catch { /* */ }
  };

  const handleCancel = async (id: string) => {
    await borrowRequestApi.cancel(id);
    message.success('申请已取消');
    loadData(activeTab);
  };

  const columns: ColumnsType<BorrowRequest> = [
    { title: '档案名称', key: 'archive', render: (_, r) => r.archive?.title || '-' },
    { title: '档案编号', key: 'archiveNo', render: (_, r) => r.archive?.archiveNo || '-' },
    { title: '申请人', key: 'applicant', render: (_, r) => r.applicant?.name || '-' },
    { title: '借阅理由', dataIndex: 'borrowReason', key: 'reason', ellipsis: true },
    {
      title: '状态', key: 'status', width: 100,
      render: (_, r) => {
        const s = statusMap[r.status];
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '申请时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => viewDetail(r.id)}>详情</Button>
          {activeTab === 'my' && (r.status === 'PENDING' || r.status === 'IN_PROGRESS') && (
            <Button size="small" danger onClick={() => handleCancel(r.id)}>取消</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      className="panel-card"
      title={<Space><AuditOutlined /><span>借阅审批管理</span></Space>}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'pending', label: <Badge count={data.length} size="small" offset={[8, 0]}>待我审批</Badge> },
          { key: 'my', label: '我的申请' },
          { key: 'all', label: '全部申请' },
        ]}
      />
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: (p, ps) => loadData(activeTab, p, ps),
        }}
      />

      {/* 详情 Modal */}
      <Modal
        title="借阅申请详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={700}
        footer={
          activeTab === 'pending' && currentRequest && (currentRequest.status === 'PENDING' || currentRequest.status === 'IN_PROGRESS') ? (
            <Space>
              <Button onClick={() => setDetailOpen(false)}>关闭</Button>
              <Button danger onClick={() => { setRejectOpen(true); form.resetFields(); setSignature(''); }}>驳回</Button>
              <Button type="primary" onClick={() => { setApproveOpen(true); form.resetFields(); setSignature(''); }}>通过</Button>
            </Space>
          ) : undefined
        }
      >
        {currentRequest && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="档案名称">{currentRequest.archive?.title}</Descriptions.Item>
              <Descriptions.Item label="档案编号">{currentRequest.archive?.archiveNo}</Descriptions.Item>
              <Descriptions.Item label="申请人">{currentRequest.applicant?.name}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusMap[currentRequest.status].color}>{statusMap[currentRequest.status].label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="借阅理由" span={2}>{currentRequest.borrowReason || '-'}</Descriptions.Item>
              {currentRequest.expectedBorrowAt && (
                <Descriptions.Item label="预计借阅">{dayjs(currentRequest.expectedBorrowAt).format('YYYY-MM-DD')}</Descriptions.Item>
              )}
              {currentRequest.expectedReturnAt && (
                <Descriptions.Item label="预计归还">{dayjs(currentRequest.expectedReturnAt).format('YYYY-MM-DD')}</Descriptions.Item>
              )}
            </Descriptions>

            <Typography.Title level={5}>审批记录</Typography.Title>
            {currentRequest.approvalRecords.length > 0 ? (
              <Timeline items={currentRequest.approvalRecords.map((r) => ({
                color: r.action === 'APPROVE' ? 'green' : 'red',
                dot: r.action === 'APPROVE' ? <CheckCircleOutlined /> : <CloseCircleOutlined />,
                children: (
                  <div>
                    <Space>
                      <Tag>{r.nodeName}</Tag>
                      <strong>{r.approver?.name}</strong>
                      <Tag color={r.action === 'APPROVE' ? 'success' : 'error'}>
                        {r.action === 'APPROVE' ? '通过' : '驳回'}
                      </Tag>
                      <Typography.Text type="secondary">{dayjs(r.createdAt).format('YYYY-MM-DD HH:mm')}</Typography.Text>
                    </Space>
                    {r.comment && <div style={{ marginTop: 4 }}>{r.comment}</div>}
                    {r.signatureUrl && <img src={r.signatureUrl} alt="签名" style={{ maxHeight: 60, marginTop: 4 }} />}
                  </div>
                ),
              }))} />
            ) : (
              <Typography.Text type="secondary">暂无审批记录</Typography.Text>
            )}
          </Space>
        )}
      </Modal>

      {/* 通过 Modal */}
      <Modal title="审批通过" open={approveOpen} onOk={handleApprove} onCancel={() => setApproveOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="comment" label="审批意见">
            <Input.TextArea rows={3} placeholder="可选，填写审批意见" />
          </Form.Item>
          <Form.Item label="签名（可选）">
            <SignaturePad onConfirm={(url) => setSignature(url)} onClear={() => setSignature('')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 驳回 Modal */}
      <Modal title="驳回申请" open={rejectOpen} onOk={handleReject} onCancel={() => setRejectOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
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

export default BorrowApprovalPage;
