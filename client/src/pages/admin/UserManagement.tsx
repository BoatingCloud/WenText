import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Popconfirm,
  App,
  Row,
  Col,
  Tree,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, KeyOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, roleApi, authApi, departmentApi, User, Role } from '../../services/api';
import type { DataNode } from 'antd/es/tree';

const UserManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [batchRoleModalOpen, setBatchRoleModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm<{ roleIds: string[] }>();
  const [resetPasswordForm] = Form.useForm();

  // 获取部门树
  const { data: departmentTreeData, isLoading: isDepartmentLoading } = useQuery({
    queryKey: ['department-tree'],
    queryFn: () => departmentApi.getTree(),
  });

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', page, pageSize, search, selectedDepartmentId],
    queryFn: () => {
      console.log('[UserManagement] Fetching users with params:', { page, pageSize, search, departmentId: selectedDepartmentId });
      return userApi.list({ page, pageSize, search, departmentId: selectedDepartmentId });
    },
  });

  const { data: allRolesData } = useQuery({
    queryKey: ['all-roles-for-users'],
    queryFn: () => roleApi.list({ pageSize: 200 }),
  });

  const roleOptions = allRolesData?.data.data || [];

  const createMutation = useMutation({
    mutationFn: (values: Partial<User> & { roleIds?: string[] }) => userApi.create(values),
    onSuccess: () => {
      message.success('用户创建成功');
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<User> }) =>
      userApi.update(id, values),
    onSuccess: () => {
      message.success('用户更新成功');
      setModalOpen(false);
      setEditingUser(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.delete(id),
    onSuccess: () => {
      message.success('用户删除成功');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const batchAssignRolesMutation = useMutation({
    mutationFn: (payload: { userIds: string[]; roleIds: string[] }) =>
      userApi.batchAssignRoles(payload.userIds, payload.roleIds),
    onSuccess: () => {
      message.success('批量角色分配成功');
      setBatchRoleModalOpen(false);
      setSelectedUserIds([]);
      batchForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: { userId: string; newPassword: string }) =>
      authApi.adminResetPassword(data),
    onSuccess: () => {
      message.success('密码重置成功');
      setResetPasswordModalOpen(false);
      setResetPasswordUser(null);
      resetPasswordForm.resetFields();
    },
  });

  const users = usersData?.data.data || [];
  const total = usersData?.data.pagination?.total || 0;

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: Role[]) => (
        <Space>
          {roles.map((role) => (
            <Tag key={role.id}>{role.name}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : status === 'LOCKED' ? 'red' : 'default'}>
          {status === 'ACTIVE' ? '正常' : status === 'LOCKED' ? '锁定' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: User) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              setEditingUser(record);
              form.setFieldsValue({
                ...record,
                roleIds: record.roles.map((role) => role.id),
              });
              setModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Button
            icon={<KeyOutlined />}
            size="small"
            onClick={() => {
              setResetPasswordUser(record);
              resetPasswordForm.resetFields();
              setResetPasswordModalOpen(true);
            }}
          >
            重置密码
          </Button>
          <Popconfirm
            title="确定要删除此用户吗？"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const { roleIds = [], ...profileValues } = values as Partial<User> & { roleIds?: string[] };
    if (editingUser) {
      await updateMutation.mutateAsync({ id: editingUser.id, values: profileValues });
      await userApi.assignRoles(editingUser.id, roleIds);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } else {
      createMutation.mutate({ ...profileValues, roleIds });
    }
  };

  const handleBatchAssignRoles = async () => {
    const values = await batchForm.validateFields();
    batchAssignRolesMutation.mutate({
      userIds: selectedUserIds,
      roleIds: values.roleIds || [],
    });
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;
    const values = await resetPasswordForm.validateFields();
    resetPasswordMutation.mutate({
      userId: resetPasswordUser.id,
      newPassword: values.newPassword,
    });
  };

  const convertToTreeData = (departments: any[]): DataNode[] => {
    console.log('[UserManagement] convertToTreeData input:', departments);

    // 过滤掉公司目录根节点(ORG_COMPANY_ROOT),只显示集团根节点
    const filteredDepartments = departments.filter(
      (dept) => dept.code !== 'ORG_COMPANY_ROOT' && dept.nodeType !== 'COMPANY_ROOT'
    );

    console.log('[UserManagement] After filtering:', filteredDepartments);

    return filteredDepartments.map((dept) => ({
      key: dept.id,
      title: `${dept.name}${dept.userCount ? ` (${dept.userCount})` : ''}`,
      children: dept.children ? convertToTreeData(dept.children) : [],
    }));
  };

  return (
    <Row gutter={16}>
      <Col span={6}>
        <Card title="组织架构" loading={isDepartmentLoading}>
          <Tree
            treeData={departmentTreeData?.data.data ? convertToTreeData(departmentTreeData.data.data) : []}
            onSelect={(selectedKeys) => {
              console.log('[UserManagement] Tree onSelect:', selectedKeys);
              const newDepartmentId = selectedKeys[0] as string | undefined;
              console.log('[UserManagement] Setting departmentId to:', newDepartmentId);
              setSelectedDepartmentId(newDepartmentId);
              setPage(1);
            }}
            selectedKeys={selectedDepartmentId ? [selectedDepartmentId] : []}
            showLine
            defaultExpandAll
          />
        </Card>
      </Col>
      <Col span={18}>
        <Card
      title="用户管理"
      extra={
        <Space>
          <Input
            placeholder="搜索用户"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingUser(null);
              form.resetFields();
              setModalOpen(true);
            }}
          >
            添加用户
          </Button>
          <Button
            onClick={() => setBatchRoleModalOpen(true)}
            disabled={selectedUserIds.length === 0}
          >
            批量设置角色
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={isLoading}
        rowSelection={{
          selectedRowKeys: selectedUserIds,
          onChange: (keys) => setSelectedUserIds(keys as string[]),
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          setEditingUser(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' },
              ]}
            >
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value="ACTIVE">正常</Select.Option>
              <Select.Option value="INACTIVE">禁用</Select.Option>
              <Select.Option value="LOCKED">锁定</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="roleIds" label="角色">
            <Select
              mode="multiple"
              allowClear
              placeholder="选择用户角色"
              options={roleOptions.map((role) => ({ value: role.id, label: role.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`批量设置角色（已选 ${selectedUserIds.length} 人）`}
        open={batchRoleModalOpen}
        onOk={handleBatchAssignRoles}
        onCancel={() => {
          setBatchRoleModalOpen(false);
          batchForm.resetFields();
        }}
        confirmLoading={batchAssignRolesMutation.isPending}
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item
            name="roleIds"
            label="目标角色"
            rules={[{ required: true, message: '请选择至少一个角色' }]}
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="选择要分配的角色"
              options={roleOptions.map((role) => ({ value: role.id, label: role.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码 - ${resetPasswordUser?.name || ''}`}
        open={resetPasswordModalOpen}
        onOk={handleResetPassword}
        onCancel={() => {
          setResetPasswordModalOpen(false);
          setResetPasswordUser(null);
          resetPasswordForm.resetFields();
        }}
        confirmLoading={resetPasswordMutation.isPending}
      >
        <Form form={resetPasswordForm} layout="vertical">
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' },
              { max: 100, message: '密码最多100个字符' },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
      </Col>
    </Row>
  );
};

export default UserManagement;
