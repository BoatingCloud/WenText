import { useEffect, useState } from 'react';
import {
  App, Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Space,
  Switch, Table, Tag, Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, NodeIndexOutlined, MinusCircleOutlined } from '@ant-design/icons';
import {
  borrowWorkflowApi,
  roleApi,
  userApi,
  type BorrowWorkflowConfig,
  type BorrowWorkflowNode,
  type Role,
  type User,
} from '../../services/api';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

const BorrowWorkflowConfigPage: React.FC = () => {
  const [workflows, setWorkflows] = useState<BorrowWorkflowConfig[]>([]);
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
        borrowWorkflowApi.list(),
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

  const openEdit = (wf: BorrowWorkflowConfig) => {
    setEditingId(wf.id);
    form.setFieldsValue({
      name: wf.name,
      description: wf.description || '',
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
      // 确保 nodeOrder 递增
      const nodes = (values.nodes || []).map((n: Omit<BorrowWorkflowNode, 'id' | 'workflowId'>, i: number) => ({
        ...n,
        nodeOrder: i + 1,
      }));
      const payload = { ...values, nodes };

      if (editingId) {
        await borrowWorkflowApi.update(editingId, payload);
        message.success('工作流已更新');
      } else {
        await borrowWorkflowApi.create(payload);
        message.success('工作流已创建');
      }
      setModalOpen(false);
      loadData();
    } catch { /* validation */ }
  };

  const handleDelete = (wf: BorrowWorkflowConfig) => {
    antModal.confirm({
      title: `确认删除工作流「${wf.name}」？`,
      content: wf._count?.requests ? `已关联 ${wf._count.requests} 个借阅申请，无法删除。` : '删除后不可恢复。',
      onOk: async () => {
        await borrowWorkflowApi.delete(wf.id);
        message.success('工作流已删除');
        loadData();
      },
    });
  };

  const columns: ColumnsType<BorrowWorkflowConfig> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '审批节点',
      key: 'nodes',
      render: (_, r) => r.nodes.map((n) => <Tag key={n.id}>{n.name}</Tag>),
    },
    {
      title: '默认',
      dataIndex: 'isDefault',
      key: 'isDefault',
      width: 80,
      render: (v: boolean) => v ? <Tag color="blue">默认</Tag> : '-',
    },
    {
      title: '状态',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      width: 80,
      render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: '关联申请',
      key: 'requests',
      width: 90,
      render: (_, r) => r._count?.requests ?? 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      className="panel-card"
      title={<Space><NodeIndexOutlined /><span>借阅工作流配置</span></Space>}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增工作流</Button>}
    >
      <Table
        columns={columns}
        dataSource={workflows}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingId ? '编辑工作流' : '新增工作流'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="工作流名称" rules={[{ required: true, message: '请输入名称' }]}>
                <Input maxLength={100} placeholder="如：默认审批流程" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="description" label="描述">
                <Input maxLength={500} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="isDefault" label="设为默认" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isEnabled" label="启用" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Text strong>审批节点</Text>
          <Form.List name="nodes">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size={8}>
                {fields.map((field, index) => (
                  <Card size="small" key={field.key} title={`节点 ${index + 1}`} extra={
                    fields.length > 1 && (
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    )
                  }>
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item {...field} name={[field.name, 'name']} label="节点名称" rules={[{ required: true }]}>
                          <Input placeholder="如：部门主管审批" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item {...field} name={[field.name, 'approverType']} label="审批人类型" rules={[{ required: true }]}>
                          <Select>
                            <Select.Option value="ROLE">角色</Select.Option>
                            <Select.Option value="USER">指定用户</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item noStyle shouldUpdate={(prev, cur) =>
                          prev.nodes?.[field.name]?.approverType !== cur.nodes?.[field.name]?.approverType
                        }>
                          {() => {
                            const type = form.getFieldValue(['nodes', field.name, 'approverType']);
                            if (type === 'ROLE') {
                              return (
                                <Form.Item {...field} name={[field.name, 'approverValue']} label="角色" rules={[{ required: true }]}>
                                  <Select placeholder="选择角色">
                                    {roles.map((r) => <Select.Option key={r.code} value={r.code}>{r.name}</Select.Option>)}
                                  </Select>
                                </Form.Item>
                              );
                            }
                            return (
                              <Form.Item {...field} name={[field.name, 'approverValue']} label="用户" rules={[{ required: true }]}>
                                <Select placeholder="选择用户" showSearch optionFilterProp="label"
                                  options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.username})` }))}
                                />
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item {...field} name={[field.name, 'nodeOrder']} hidden>
                      <InputNumber />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'isRequired']} hidden initialValue={true}>
                      <Input />
                    </Form.Item>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ name: '', nodeOrder: fields.length + 1, approverType: 'ROLE', approverValue: '', isRequired: true })} icon={<PlusOutlined />} block>
                  添加审批节点
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </Card>
  );
};

export default BorrowWorkflowConfigPage;
