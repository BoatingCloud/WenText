import { useEffect, useState } from 'react';
import {
  App, Button, Card, Form, Input, Modal, Select, Space,
  Switch, Table, Tag, Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import {
  reviewWorkflowApi,
  roleApi,
  userApi,
  type ReviewWorkflowConfig,
  type ReviewWorkflowNode,
  type Role,
  type User,
} from '../services/api';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

const DOCUMENT_TYPES = [
  { value: 'CONTRACT', label: '合同' },
  { value: 'LAWYER_LETTER', label: '律师函' },
  { value: 'COLLECTION_LETTER', label: '催款函' },
  { value: 'AGREEMENT', label: '协议' },
  { value: 'NOTICE', label: '通知' },
  { value: 'OTHER', label: '其他' },
];

const ReviewWorkflowConfigPage: React.FC = () => {
  const [workflows, setWorkflows] = useState<ReviewWorkflowConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const { message, modal: antModal } = App.useApp();

  const loadData = async () => {
    setLoading(true);
    try {
      const [wfRes, roleRes, userRes] = await Promise.all([
        reviewWorkflowApi.list(),
        roleApi.list({ pageSize: 100 }),
        userApi.list({ pageSize: 200 }),
      ]);
      if (wfRes.data.success && wfRes.data.data) setWorkflows(wfRes.data.data);
      if (roleRes.data.success && roleRes.data.data) setRoles(roleRes.data.data);
      if (userRes.data.success && userRes.data.data) setUsers(userRes.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      isDefault: false,
      isEnabled: true,
      nodes: [{ name: '', nodeOrder: 1, approverType: 'ROLE', approverValue: '', isRequired: true }],
    });
    setModalOpen(true);
  };

  const openEdit = (wf: ReviewWorkflowConfig) => {
    setEditingId(wf.id);
    form.setFieldsValue({
      name: wf.name,
      description: wf.description || '',
      documentType: wf.documentType || undefined,
      isDefault: wf.isDefault,
      isEnabled: wf.isEnabled,
      nodes: wf.nodes.map((n) => ({
        name: n.name,
        nodeOrder: n.nodeOrder,
        approverType: n.approverType,
        approverValue: n.approverValue || '',
        isRequired: n.isRequired,
      })),
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const nodes = (values.nodes || []).map((n: any, i: number) => ({
        ...n,
        nodeOrder: i + 1,
      }));
      const payload = { ...values, nodes };

      if (editingId) {
        await reviewWorkflowApi.update(editingId, payload);
        message.success('工作流已更新');
      } else {
        await reviewWorkflowApi.create(payload);
        message.success('工作流已创建');
      }
      setModalOpen(false);
      loadData();
    } catch { /* validation */ }
  };

  const handleDelete = (wf: ReviewWorkflowConfig) => {
    antModal.confirm({
      title: '确认删除',
      content: `确定要删除工作流"${wf.name}"吗？`,
      onOk: async () => {
        try {
          await reviewWorkflowApi.delete(wf.id);
          message.success('工作流已删除');
          loadData();
        } catch (err: any) {
          message.error(err.response?.data?.message || '删除失败');
        }
      },
    });
  };

  const handleToggleEnabled = async (wf: ReviewWorkflowConfig) => {
    try {
      await reviewWorkflowApi.toggleEnabled(wf.id, !wf.isEnabled);
      message.success(wf.isEnabled ? '已禁用' : '已启用');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const handleSetDefault = async (wf: ReviewWorkflowConfig) => {
    try {
      await reviewWorkflowApi.setDefault(wf.id);
      message.success('已设置为默认工作流');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const columns: ColumnsType<ReviewWorkflowConfig> = [
    {
      title: '工作流名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <Text strong>{name}</Text>
          {record.isDefault && <Tag color="blue">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '文档类型',
      dataIndex: 'documentType',
      key: 'documentType',
      render: (type) => {
        if (!type) return <Text type="secondary">通用</Text>;
        const docType = DOCUMENT_TYPES.find(t => t.value === type);
        return docType ? docType.label : type;
      },
    },
    {
      title: '审批节点',
      dataIndex: 'nodes',
      key: 'nodes',
      render: (nodes: ReviewWorkflowNode[]) => (
        <Text>{nodes.length} 个节点</Text>
      ),
    },
    {
      title: '使用次数',
      key: 'usage',
      render: (_, record) => record._count?.reviews || 0,
    },
    {
      title: '状态',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      render: (enabled) => (
        <Tag color={enabled ? 'green' : 'default'}>
          {enabled ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          <Button
            size="small"
            onClick={() => handleToggleEnabled(record)}
          >
            {record.isEnabled ? '禁用' : '启用'}
          </Button>
          {!record.isDefault && (
            <Button
              size="small"
              onClick={() => handleSetDefault(record)}
            >
              设为默认
            </Button>
          )}
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            disabled={record._count && record._count.reviews > 0}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="审查工作流配置"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建工作流
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={workflows}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingId ? '编辑工作流' : '新建工作流'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        width={800}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="name"
            label="工作流名称"
            rules={[{ required: true, message: '请输入工作流名称' }]}
          >
            <Input placeholder="例如：合同审查流程" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="工作流说明" />
          </Form.Item>

          <Form.Item name="documentType" label="文档类型">
            <Select placeholder="选择文档类型（留空表示通用）" allowClear>
              {DOCUMENT_TYPES.map(t => (
                <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="isDefault" label="设为默认" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="isEnabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="审批节点">
            <Form.List name="nodes">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Card
                      key={field.key}
                      size="small"
                      title={`节点 ${index + 1}`}
                      extra={
                        fields.length > 1 && (
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<MinusCircleOutlined />}
                            onClick={() => remove(field.name)}
                          />
                        )
                      }
                      style={{ marginBottom: 16 }}
                    >
                      <Form.Item
                        {...field}
                        name={[field.name, 'name']}
                        label="节点名称"
                        rules={[{ required: true, message: '请输入节点名称' }]}
                      >
                        <Input placeholder="例如：部门负责人审批" />
                      </Form.Item>

                      <Form.Item
                        {...field}
                        name={[field.name, 'approverType']}
                        label="审批人类型"
                        rules={[{ required: true }]}
                      >
                        <Select>
                          <Select.Option value="USER">指定用户</Select.Option>
                          <Select.Option value="ROLE">指定角色</Select.Option>
                          <Select.Option value="DEPARTMENT_HEAD">部门负责人</Select.Option>
                        </Select>
                      </Form.Item>

                      <Form.Item
                        noStyle
                        shouldUpdate={(prev, curr) =>
                          prev.nodes?.[field.name]?.approverType !== curr.nodes?.[field.name]?.approverType
                        }
                      >
                        {({ getFieldValue }) => {
                          const approverType = getFieldValue(['nodes', field.name, 'approverType']);
                          if (approverType === 'USER') {
                            return (
                              <Form.Item
                                {...field}
                                name={[field.name, 'approverValue']}
                                label="审批人"
                                rules={[{ required: true, message: '请选择审批人' }]}
                              >
                                <Select placeholder="选择用户" showSearch optionFilterProp="children">
                                  {users.map(u => (
                                    <Select.Option key={u.id} value={u.id}>{u.name}</Select.Option>
                                  ))}
                                </Select>
                              </Form.Item>
                            );
                          }
                          if (approverType === 'ROLE') {
                            return (
                              <Form.Item
                                {...field}
                                name={[field.name, 'approverValue']}
                                label="审批角色"
                                rules={[{ required: true, message: '请选择角色' }]}
                              >
                                <Select placeholder="选择角色">
                                  {roles.map(r => (
                                    <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
                                  ))}
                                </Select>
                              </Form.Item>
                            );
                          }
                          return null;
                        }}
                      </Form.Item>

                      <Form.Item
                        {...field}
                        name={[field.name, 'isRequired']}
                        label="必须审批"
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加节点
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ReviewWorkflowConfigPage;
