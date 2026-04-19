import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tree,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repositoryApi, roleApi, userApi, systemConfigApi, Permission, Role } from '../services/api';

const RoleManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [repoModalOpen, setRepoModalOpen] = useState(false);
  const [repoRole, setRepoRole] = useState<Role | null>(null);
  const [repoPermissionMap, setRepoPermissionMap] = useState<Record<string, string[]>>({});
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveRole, setArchiveRole] = useState<Role | null>(null);
  const [archivePermissionMap, setArchivePermissionMap] = useState<Record<string, string[]>>({});
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [selectedRoleUserIds, setSelectedRoleUserIds] = useState<string[]>([]);
  const [form] = Form.useForm();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleApi.list({ pageSize: 100 }),
  });

  const { data: permissionsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => roleApi.getPermissions(),
  });

  const { data: repositoriesData } = useQuery({
    queryKey: ['repositories-for-role-binding'],
    queryFn: () => repositoryApi.list({ pageSize: 200 }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-role-binding'],
    queryFn: () => userApi.list({ pageSize: 500 }),
  });

  const { data: siteSettingsData } = useQuery({
    queryKey: ['site-settings-for-roles'],
    queryFn: () => systemConfigApi.getSettings(),
  });

  const { data: roleRepoPermissionsData } = useQuery({
    queryKey: ['role-repo-permissions', repoRole?.id],
    queryFn: () => roleApi.getRepositoryPermissions(repoRole!.id),
    enabled: !!repoRole && repoModalOpen,
  });

  const { data: roleArchivePermissionsData } = useQuery({
    queryKey: ['role-archive-permissions', archiveRole?.id],
    queryFn: () => roleApi.getArchivePermissions(archiveRole!.id),
    enabled: !!archiveRole && archiveModalOpen,
  });

  const { data: roleUsersData } = useQuery({
    queryKey: ['role-users', userRole?.id],
    queryFn: () => roleApi.getUsers(userRole!.id),
    enabled: !!userRole && userModalOpen,
  });

  const createMutation = useMutation({
    mutationFn: (values: Partial<Role> & { permissionIds: string[] }) => roleApi.create(values),
    onSuccess: () => {
      message.success('角色创建成功');
      setModalOpen(false);
      form.resetFields();
      setSelectedPermissions([]);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<Role> & { permissionIds: string[] } }) =>
      roleApi.update(id, values),
    onSuccess: () => {
      message.success('角色更新成功');
      setModalOpen(false);
      setEditingRole(null);
      form.resetFields();
      setSelectedPermissions([]);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => roleApi.delete(id),
    onSuccess: () => {
      message.success('角色删除成功');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateRoleRepoPermissionsMutation = useMutation({
    mutationFn: ({ roleId, entries }: { roleId: string; entries: Array<{ repositoryId: string; permissions: string[] }> }) =>
      roleApi.updateRepositoryPermissions(roleId, entries),
    onSuccess: () => {
      message.success('角色仓库权限更新成功');
      setRepoModalOpen(false);
      setRepoRole(null);
      setRepoPermissionMap({});
    },
  });

  const updateRoleArchivePermissionsMutation = useMutation({
    mutationFn: ({ roleId, entries }: { roleId: string; entries: Array<{ companyCode: string; permissions: string[] }> }) =>
      roleApi.updateArchivePermissions(roleId, entries),
    onSuccess: () => {
      message.success('角色档案权限更新成功');
      setArchiveModalOpen(false);
      setArchiveRole(null);
      setArchivePermissionMap({});
    },
  });

  const updateRoleUsersMutation = useMutation({
    mutationFn: ({ roleId, userIds }: { roleId: string; userIds: string[] }) =>
      roleApi.updateUsers(roleId, userIds),
    onSuccess: () => {
      message.success('角色用户配置成功');
      setUserModalOpen(false);
      setUserRole(null);
      setSelectedRoleUserIds([]);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['role-users'] });
    },
  });

  const roles = rolesData?.data.data || [];
  const permissions = permissionsData?.data.data || [];
  const repositories = repositoriesData?.data.data || [];
  const users = usersData?.data.data || [];

  const repoPermissionOptions = [
    { label: '查看', value: 'view' },
    { label: '上传', value: 'upload' },
    { label: '编辑', value: 'edit' },
    { label: '删除', value: 'delete' },
    { label: '分享', value: 'share' },
    { label: '版本', value: 'version' },
    { label: '管理', value: 'manage' },
  ];

  const archivePermissionOptions = [
    { label: '查看', value: 'view' },
    { label: '创建', value: 'create' },
    { label: '编辑', value: 'edit' },
    { label: '删除', value: 'delete' },
    { label: '借阅', value: 'borrow' },
    { label: '归还', value: 'return' },
    { label: '审批', value: 'approve' },
    { label: '销毁', value: 'destroy' },
  ];

  const selectedRoleRepoPermissions = roleRepoPermissionsData?.data.data || [];
  const selectedRoleArchivePermissions = roleArchivePermissionsData?.data.data || [];
  const selectedRoleUsers = roleUsersData?.data.data || [];

  const companyCatalog = siteSettingsData?.data.data?.companyCatalog || [];

  const userOptions = useMemo(() => {
    return users.map((user) => ({
      value: user.id,
      label: `${user.name} (${user.username})${user.department?.name ? ` - ${user.department.name}` : ''}`,
    }));
  }, [users]);

  const permissionTree = (() => {
    const modules: Record<string, Permission[]> = {};
    permissions.forEach((p) => {
      if (!modules[p.module]) {
        modules[p.module] = [];
      }
      modules[p.module].push(p);
    });

    return Object.entries(modules).map(([module, perms]) => ({
      title: module,
      key: `module-${module}`,
      children: perms.map((p) => ({
        title: `${p.name} (${p.code})`,
        key: p.id,
      })),
    }));
  })();

  const columns = [
    { title: '角色名称', dataIndex: 'name', key: 'name' },
    { title: '角色编码', dataIndex: 'code', key: 'code' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '系统角色',
      dataIndex: 'isSystem',
      key: 'isSystem',
      render: (isSystem: boolean) => (
        <Tag color={isSystem ? 'blue' : 'default'}>
          {isSystem ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '权限数量',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (perms: Permission[]) => perms.length,
    },
    {
      title: '用户数量',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 110,
      render: (count?: number) => count ?? 0,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Role) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              setEditingRole(record);
              form.setFieldsValue(record);
              setSelectedPermissions(record.permissions.map((p) => p.id));
              setModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Button
            size="small"
            icon={<TeamOutlined />}
            onClick={() => {
              setUserRole(record);
              setUserModalOpen(true);
            }}
          >
            配置用户
          </Button>
          <Button
            size="small"
            onClick={() => {
              setRepoRole(record);
              setRepoModalOpen(true);
            }}
          >
            仓库权限
          </Button>
          <Button
            size="small"
            onClick={() => {
              setArchiveRole(record);
              setArchiveModalOpen(true);
            }}
          >
            档案权限
          </Button>
          <Popconfirm
            title="确定要删除此角色吗？"
            onConfirm={() => deleteMutation.mutate(record.id)}
            disabled={record.isSystem}
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              disabled={record.isSystem}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const permissionIds = selectedPermissions
      .filter((k) => !k.startsWith('module-'))
      .filter((k) => uuidPattern.test(k));
    const submitValues = {
      ...values,
      description: values.description?.trim() || undefined,
      permissionIds,
    };

    if (editingRole) {
      updateMutation.mutate({
        id: editingRole.id,
        values: submitValues,
      });
    } else {
      createMutation.mutate(submitValues);
    }
  };

  const handleSaveRoleRepoPermissions = async () => {
    if (!repoRole) {
      return;
    }

    const entries = repositories.map((repo) => ({
      repositoryId: repo.id,
      permissions: repoPermissionMap[repo.id] || [],
    }));

    updateRoleRepoPermissionsMutation.mutate({
      roleId: repoRole.id,
      entries,
    });
  };

  const handleSaveRoleArchivePermissions = async () => {
    if (!archiveRole) {
      return;
    }

    const entries = companyCatalog.map((company: { code: string; name: string }) => ({
      companyCode: company.code,
      permissions: archivePermissionMap[company.code] || [],
    }));

    updateRoleArchivePermissionsMutation.mutate({
      roleId: archiveRole.id,
      entries,
    });
  };

  const handleSaveRoleUsers = async () => {
    if (!userRole) {
      return;
    }

    updateRoleUsersMutation.mutate({
      roleId: userRole.id,
      userIds: selectedRoleUserIds,
    });
  };

  useEffect(() => {
    if (!repoModalOpen || !repoRole) {
      return;
    }
    const initialMap = selectedRoleRepoPermissions.reduce<Record<string, string[]>>((acc, item) => {
      acc[item.repositoryId] = item.permissions;
      return acc;
    }, {});
    setRepoPermissionMap(initialMap);
  }, [repoModalOpen, repoRole, selectedRoleRepoPermissions]);

  useEffect(() => {
    if (!archiveModalOpen || !archiveRole) {
      return;
    }
    const initialMap = selectedRoleArchivePermissions.reduce<Record<string, string[]>>((acc, item) => {
      acc[item.companyCode] = item.permissions;
      return acc;
    }, {});
    setArchivePermissionMap(initialMap);
  }, [archiveModalOpen, archiveRole, selectedRoleArchivePermissions]);

  useEffect(() => {
    if (!userModalOpen || !userRole) {
      return;
    }
    setSelectedRoleUserIds(selectedRoleUsers.map((item) => item.id));
  }, [userModalOpen, userRole, selectedRoleUsers]);

  return (
    <Card
      title="角色管理"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingRole(null);
            form.resetFields();
            setSelectedPermissions([]);
            setModalOpen(true);
          }}
        >
          添加角色
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={roles}
        rowKey="id"
        loading={isLoading}
      />

      <Modal
        title={editingRole ? '编辑角色' : '添加角色'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          setEditingRole(null);
          form.resetFields();
          setSelectedPermissions([]);
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="code"
            label="角色编码"
            rules={[{ required: true, message: '请输入角色编码' }]}
          >
            <Input disabled={!!editingRole} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="权限">
            <Tree
              checkable
              treeData={permissionTree}
              checkedKeys={selectedPermissions}
              onCheck={(keys) => setSelectedPermissions(keys as string[])}
              style={{ maxHeight: 300, overflow: 'auto' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`角色用户配置 - ${userRole?.name || ''}`}
        open={userModalOpen}
        onOk={handleSaveRoleUsers}
        onCancel={() => {
          setUserModalOpen(false);
          setUserRole(null);
          setSelectedRoleUserIds([]);
        }}
        confirmLoading={updateRoleUsersMutation.isPending}
      >
        <Select
          mode="multiple"
          allowClear
          showSearch
          style={{ width: '100%' }}
          placeholder="选择要绑定到该角色的用户"
          options={userOptions}
          value={selectedRoleUserIds}
          onChange={(values) => setSelectedRoleUserIds(values)}
          filterOption={(input, option) =>
            String(option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
        />
      </Modal>

      <Modal
        title={`角色仓库权限 - ${repoRole?.name || ''}`}
        open={repoModalOpen}
        onOk={handleSaveRoleRepoPermissions}
        onCancel={() => {
          setRepoModalOpen(false);
          setRepoRole(null);
          setRepoPermissionMap({});
        }}
        confirmLoading={updateRoleRepoPermissionsMutation.isPending}
        width={760}
      >
        <Table
          rowKey="id"
          dataSource={repositories}
          pagination={false}
          size="small"
          columns={[
            { title: '仓库名称', dataIndex: 'name', key: 'name' },
            { title: '编码', dataIndex: 'code', key: 'code' },
            {
              title: '权限',
              key: 'permissions',
              render: (_: unknown, repo: { id: string }) => (
                <Select
                  mode="multiple"
                  allowClear
                  style={{ width: '100%' }}
                  placeholder="选择该角色在仓库中的权限"
                  options={repoPermissionOptions}
                  value={repoPermissionMap[repo.id] || []}
                  onChange={(values: string[]) => {
                    setRepoPermissionMap((prev) => ({
                      ...prev,
                      [repo.id]: values,
                    }));
                  }}
                />
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title={`角色档案权限 - ${archiveRole?.name || ''}`}
        open={archiveModalOpen}
        onOk={handleSaveRoleArchivePermissions}
        onCancel={() => {
          setArchiveModalOpen(false);
          setArchiveRole(null);
          setArchivePermissionMap({});
        }}
        confirmLoading={updateRoleArchivePermissionsMutation.isPending}
        width={760}
      >
        <Table
          rowKey="code"
          dataSource={companyCatalog}
          pagination={false}
          size="small"
          columns={[
            { title: '公司名称', dataIndex: 'name', key: 'name' },
            { title: '编码', dataIndex: 'code', key: 'code' },
            {
              title: '权限',
              key: 'permissions',
              render: (_: unknown, company: { code: string }) => (
                <Select
                  mode="multiple"
                  allowClear
                  style={{ width: '100%' }}
                  placeholder="选择该角色在该公司档案中的权限"
                  options={archivePermissionOptions}
                  value={archivePermissionMap[company.code] || []}
                  onChange={(values: string[]) => {
                    setArchivePermissionMap((prev) => ({
                      ...prev,
                      [company.code]: values,
                    }));
                  }}
                />
              ),
            },
          ]}
        />
      </Modal>
    </Card>
  );
};

export default RoleManagement;
