import { useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tree,
  TreeSelect,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { TreeProps } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentApi, repositoryApi, roleApi, systemConfigApi, userApi, Department, Role, User } from '../services/api';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'LOCKED';

interface UserUpdatePayload {
  email?: string;
  name?: string;
  phone?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  departmentId?: string | null;
}

interface UserFormValues {
  username: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  departmentId?: string;
  roleIds?: string[];
}

interface DepartmentFormValues {
  name: string;
  code: string;
  description?: string;
  sortOrder?: number;
  nodeType?: 'COMPANY' | 'DEPARTMENT';
}

interface DepartmentSelectNode {
  title: string;
  value: string;
  selectable?: boolean;
  children?: DepartmentSelectNode[];
  disabled?: boolean;
}

const ROOT_GROUP_CODE = 'ORG_GROUP_ROOT';
const ROOT_COMPANY_CODE = 'ORG_COMPANY_ROOT';

const UserManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [treeSearch, setTreeSearch] = useState('');

  const [selectedOrgId, setSelectedOrgId] = useState<string>();
  const [modalOpen, setModalOpen] = useState(false);
  const [batchRoleModalOpen, setBatchRoleModalOpen] = useState(false);
  const [orgEditorOpen, setOrgEditorOpen] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [form] = Form.useForm<UserFormValues>();
  const [batchForm] = Form.useForm<{ roleIds: string[] }>();
  const [departmentForm] = Form.useForm<DepartmentFormValues>();

  // 数据权限和仓库权限相关状态
  const [dataPermissionModalOpen, setDataPermissionModalOpen] = useState(false);
  const [dataPermissionUser, setDataPermissionUser] = useState<User | null>(null);
  const [selectedCompanyCodes, setSelectedCompanyCodes] = useState<string[]>([]);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [selectedArchiveCompanyCodes, setSelectedArchiveCompanyCodes] = useState<string[]>([]);

  const { data: departmentTreeData } = useQuery({
    queryKey: ['department-tree'],
    queryFn: () => departmentApi.getTree(),
  });

  const departmentRoots = departmentTreeData?.data.data || [];
  const groupRoot = useMemo(
    () => departmentRoots.find((item) => item.code === ROOT_GROUP_CODE || item.nodeType === 'ROOT'),
    [departmentRoots]
  );

  const groupRootName = groupRoot?.name || '集团';

  const orgNodeMap = useMemo(() => {
    const result: Record<string, Department> = {};
    const walk = (node?: Department) => {
      if (!node) return;
      result[node.id] = node;
      (node.children || []).forEach((child) => walk(child));
    };
    walk(groupRoot);
    return result;
  }, [groupRoot]);

  const selectedOrgNode = selectedOrgId ? orgNodeMap[selectedOrgId] : undefined;
  const orgEditorParentNode = selectedOrgNode || groupRoot;

  const userQueryFilters = useMemo(() => {
    const filters: {
      departmentId?: string;
      organizationType?: 'GROUP' | 'COMPANY';
      status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
    } = {};

    if (statusFilter !== 'ALL') {
      filters.status = statusFilter;
    }

    if (!selectedOrgNode || selectedOrgNode.nodeType === 'ROOT') {
      return filters;
    }

    if (selectedOrgNode.nodeType === 'COMPANY_ROOT') {
      filters.organizationType = 'COMPANY';
      return filters;
    }

    if (selectedOrgNode.nodeType === 'COMPANY') {
      // 点击公司节点时,查询该公司及其子部门的用户
      filters.departmentId = selectedOrgNode.id;
      return filters;
    }

    if (selectedOrgNode.nodeType === 'DEPARTMENT') {
      filters.departmentId = selectedOrgNode.id;
      return filters;
    }

    return filters;
  }, [selectedOrgNode, statusFilter]);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', page, pageSize, search, userQueryFilters],
    queryFn: () =>
      userApi.list({
        page,
        pageSize,
        search,
        status: userQueryFilters.status,
        departmentId: userQueryFilters.departmentId,
        organizationType: userQueryFilters.organizationType,
      }),
  });

  const { data: allRolesData } = useQuery({
    queryKey: ['all-roles-for-users'],
    queryFn: () => roleApi.list({ pageSize: 200 }),
  });

  // 获取系统配置（公司目录）
  const { data: siteSettingsData } = useQuery({
    queryKey: ['site-settings-for-users'],
    queryFn: () => systemConfigApi.getSettings(),
  });

  // 获取所有仓库
  const { data: allRepositoriesData } = useQuery({
    queryKey: ['all-repositories-for-users'],
    queryFn: () => repositoryApi.list({ pageSize: 500 }),
  });

  const companyCatalog = siteSettingsData?.data.data?.companyCatalog || [];
  const allRepositories = allRepositoriesData?.data.data || [];

  const roleOptions = allRolesData?.data.data || [];
  const users = usersData?.data.data || [];
  const total = usersData?.data.pagination?.total || 0;

  const createMutation = useMutation({
    mutationFn: (values: Partial<User> & { password?: string; roleIds?: string[]; departmentId?: string }) =>
      userApi.create(values),
    onSuccess: () => {
      message.success('用户创建成功');
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: UserUpdatePayload }) =>
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

  const createDepartmentMutation = useMutation({
    mutationFn: (values: DepartmentFormValues & { parentId?: string; organizationType?: 'GROUP' | 'COMPANY' }) =>
      departmentApi.create(values),
    onSuccess: () => {
      message.success('组织新增成功');
      setOrgEditorOpen(false);
      setEditingDepartment(null);
      departmentForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['department-tree'] });
    },
  });

  const reorderDepartmentMutation = useMutation({
    mutationFn: (payload: { id: string; parentId: string; index: number }) =>
      departmentApi.reorder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tree'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: DepartmentFormValues }) =>
      departmentApi.update(id, values),
    onSuccess: () => {
      message.success('组织更新成功');
      setOrgEditorOpen(false);
      setEditingDepartment(null);
      departmentForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['department-tree'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: (id: string) => departmentApi.delete(id),
    onSuccess: () => {
      message.success('组织删除成功');
      setSelectedOrgId(undefined);
      queryClient.invalidateQueries({ queryKey: ['department-tree'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // 更新用户公司权限
  const updateCompanyScopesMutation = useMutation({
    mutationFn: ({ userId, companyCodes }: { userId: string; companyCodes: string[] }) =>
      userApi.updateCompanyScopes(userId, companyCodes),
    onSuccess: () => {
      message.success('公司权限更新成功');
    },
  });

  // 更新用户仓库权限
  const updateRepositoryScopesMutation = useMutation({
    mutationFn: ({ userId, repositoryIds }: { userId: string; repositoryIds: string[] }) =>
      userApi.updateRepositoryScopes(userId, repositoryIds),
    onSuccess: () => {
      message.success('仓库权限更新成功');
    },
  });

  // 更新用户档案权限
  const updateArchiveScopesMutation = useMutation({
    mutationFn: ({ userId, companyCodes }: { userId: string; companyCodes: string[] }) =>
      userApi.updateArchiveScopes(userId, companyCodes),
    onSuccess: () => {
      message.success('档案权限更新成功');
      setDataPermissionModalOpen(false);
      setDataPermissionUser(null);
    },
  });

  const getUserOrgPath = (user: User): string => {
    const department = user.department;
    if (!department) {
      return '-';
    }

    const parent = department.parent;
    if (!parent) {
      return department.name;
    }

    if (parent.code === ROOT_GROUP_CODE) {
      return `${parent.name} / ${department.name}`;
    }

    if (parent.parent?.code === ROOT_COMPANY_CODE) {
      return `${groupRootName} / ${parent.name} / ${department.name}`;
    }

    if (parent.code === ROOT_COMPANY_CODE) {
      return `${groupRootName} / ${department.name}`;
    }

    return `${parent.name} / ${department.name}`;
  };

  const columns = [
    { title: '用户名', dataIndex: 'name', key: 'name', width: 120 },
    { title: '账号', dataIndex: 'username', key: 'username', width: 140 },
    {
      title: '默认组织',
      key: 'department',
      render: (_: unknown, record: User) => getUserOrgPath(record),
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: Role[]) => (
        <Space wrap>
          {roles.length > 0 ? roles.map((role) => <Tag key={role.id}>{role.name}</Tag>) : <span>-</span>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : status === 'LOCKED' ? 'red' : 'default'}>
          {status === 'ACTIVE' ? '启用' : status === 'LOCKED' ? '锁定' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: User) => (
        <Space>
          <Button
            icon={<SafetyOutlined />}
            size="small"
            onClick={async () => {
              setDataPermissionUser(record);
              try {
                const [companyRes, repoRes, archiveRes] = await Promise.all([
                  userApi.getCompanyScopes(record.id),
                  userApi.getRepositoryScopes(record.id),
                  userApi.getArchiveScopes(record.id),
                ]);
                setSelectedCompanyCodes(companyRes.data.data?.companyCodes || []);
                setSelectedRepoIds(companyRes.data.data?.isAllCompanies ? [] : (repoRes.data.data?.repositories.map(r => r.id) || []));
                setSelectedArchiveCompanyCodes(archiveRes.data.data?.companyCodes || []);
              } catch {
                setSelectedCompanyCodes([]);
                setSelectedRepoIds([]);
                setSelectedArchiveCompanyCodes([]);
              }
              setDataPermissionModalOpen(true);
            }}
          >
            数据权限
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              setEditingUser(record);
              form.setFieldsValue({
                username: record.username,
                name: record.name,
                email: record.email,
                phone: record.phone ?? undefined,
                status: record.status,
                departmentId: record.departmentId,
                roleIds: record.roles.map((role) => role.id),
              });
              setModalOpen(true);
            }}
          >
            编辑
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

  const departmentSelectTree = useMemo(() => {
    const build = (node?: Department): DepartmentSelectNode[] => {
      if (!node) return [];
      const current = {
        title: node.name,
        value: node.id,
        selectable: node.nodeType === 'DEPARTMENT',
        disabled: node.nodeType !== 'DEPARTMENT',
        children: (node.children || []).flatMap((child) => build(child)),
      };
      return [current];
    };
    return build(groupRoot);
  }, [groupRoot]);

  const treeData: DataNode[] = useMemo(() => {
    const build = (node?: Department): DataNode[] => {
      if (!node) return [];
      return [
        {
          key: node.id,
          title: node.name,
          children: (node.children || []).flatMap((child) => build(child)),
        },
      ];
    };
    return build(groupRoot);
  }, [groupRoot]);

  const parentKeyMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    const walk = (node?: Department, parentId: string | null = null) => {
      if (!node) return;
      map[node.id] = parentId;
      (node.children || []).forEach((child) => walk(child, node.id));
    };
    walk(groupRoot, null);
    return map;
  }, [groupRoot]);

  const getChildrenKeys = (parentId: string): string[] => {
    const parent = orgNodeMap[parentId];
    if (!parent) {
      return [];
    }
    return (parent.children || []).map((child) => child.id);
  };

  const onTreeDrop: TreeProps['onDrop'] = (info) => {
    const dragKey = String(info.dragNode.key);
    const dropKey = String(info.node.key);
    if (dragKey === dropKey) {
      return;
    }

    const dragNode = orgNodeMap[dragKey];
    const dropNode = orgNodeMap[dropKey];
    if (!dragNode || !dropNode) {
      return;
    }
    if (dragNode.nodeType === 'ROOT' || dragNode.nodeType === 'COMPANY_ROOT') {
      message.warning('根节点不支持拖拽');
      return;
    }
    if (!info.dropToGap && dropNode.nodeType === 'DEPARTMENT') {
      message.warning('职能部门下不可再挂载组织');
      return;
    }

    let targetParentId: string | undefined;
    let targetIndex = 0;

    if (info.dropToGap) {
      targetParentId = parentKeyMap[dropKey] || undefined;
      if (!targetParentId) {
        message.warning('不支持拖拽到顶层');
        return;
      }
      const siblings = getChildrenKeys(targetParentId);
      const targetPos = siblings.indexOf(dropKey);
      if (targetPos < 0) {
        return;
      }
      const relativeDropPos = info.dropPosition - Number(info.node.pos.split('-').pop());
      targetIndex = targetPos + (relativeDropPos > 0 ? 1 : 0);

      const dragIndex = siblings.indexOf(dragKey);
      if (dragIndex >= 0 && dragIndex < targetIndex) {
        targetIndex -= 1;
      }
    } else {
      targetParentId = dropKey;
      targetIndex = getChildrenKeys(dropKey).length;
    }

    if (!targetParentId) {
      return;
    }

    reorderDepartmentMutation.mutate({
      id: dragKey,
      parentId: targetParentId,
      index: Math.max(0, targetIndex),
    });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const { roleIds = [], ...profileValues } = values;

    if (editingUser) {
      const updatePayload: UserUpdatePayload = {
        email: profileValues.email?.trim(),
        name: profileValues.name?.trim(),
        status: profileValues.status,
        departmentId: profileValues.departmentId || null,
      };
      const phoneValue = profileValues.phone?.trim();
      if (phoneValue) {
        updatePayload.phone = phoneValue;
      }

      await updateMutation.mutateAsync({ id: editingUser.id, values: updatePayload });
      await userApi.assignRoles(editingUser.id, roleIds);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      return;
    }

    createMutation.mutate({
      username: profileValues.username.trim(),
      name: profileValues.name.trim(),
      email: profileValues.email.trim(),
      password: profileValues.password,
      phone: profileValues.phone?.trim() || undefined,
      departmentId: profileValues.departmentId || undefined,
      roleIds,
    });
  };

  const handleBatchAssignRoles = async () => {
    const values = await batchForm.validateFields();
    batchAssignRolesMutation.mutate({
      userIds: selectedUserIds,
      roleIds: values.roleIds || [],
    });
  };

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    form.resetFields();
    if (selectedOrgNode?.nodeType === 'DEPARTMENT') {
      form.setFieldsValue({
        departmentId: selectedOrgNode.id,
        status: 'ACTIVE',
      });
    } else {
      form.setFieldsValue({
        status: 'ACTIVE',
      });
    }
    setModalOpen(true);
  };

  const handleOpenCreateDepartment = () => {
    const parent = selectedOrgNode || groupRoot;
    if (!parent) {
      message.error('组织树未加载完成');
      return;
    }

    if (parent.nodeType !== 'ROOT' && parent.nodeType !== 'COMPANY') {
      message.warning('仅支持在集团或公司节点下新增组织');
      return;
    }

    setEditingDepartment(null);
    departmentForm.resetFields();
    departmentForm.setFieldsValue({
      sortOrder: 0,
      nodeType: parent.nodeType === 'ROOT' ? 'DEPARTMENT' : undefined,
    });
    setOrgEditorOpen(true);
  };

  const handleOpenEditDepartment = () => {
    if (!selectedOrgNode || (selectedOrgNode.nodeType !== 'DEPARTMENT' && selectedOrgNode.nodeType !== 'COMPANY')) {
      message.warning('请选择一个可编辑的组织节点');
      return;
    }
    setEditingDepartment(selectedOrgNode);
    departmentForm.setFieldsValue({
      name: selectedOrgNode.name,
      code: selectedOrgNode.code,
      description: selectedOrgNode.description,
      sortOrder: selectedOrgNode.sortOrder ?? 0,
      nodeType: selectedOrgNode.nodeType === 'COMPANY' ? 'COMPANY' : 'DEPARTMENT',
    });
    setOrgEditorOpen(true);
  };

  const handleDeleteDepartment = () => {
    if (!selectedOrgNode || (selectedOrgNode.nodeType !== 'DEPARTMENT' && selectedOrgNode.nodeType !== 'COMPANY')) {
      message.warning('请选择一个可删除的组织节点');
      return;
    }
    deleteDepartmentMutation.mutate(selectedOrgNode.id);
  };

  const handleSaveDepartment = async () => {
    const values = await departmentForm.validateFields();

    if (editingDepartment) {
      updateDepartmentMutation.mutate({
        id: editingDepartment.id,
        values,
      });
      return;
    }

    const parent = selectedOrgNode || groupRoot;
    if (!parent || (parent.nodeType !== 'ROOT' && parent.nodeType !== 'COMPANY')) {
      message.error('新增组织失败：请先选择集团或公司节点');
      return;
    }

    if (parent.nodeType === 'ROOT' && values.nodeType === 'COMPANY') {
      createDepartmentMutation.mutate({
        ...values,
        sortOrder: values.sortOrder ?? 0,
        organizationType: 'COMPANY',
      });
      return;
    }

    createDepartmentMutation.mutate({
      ...values,
      sortOrder: values.sortOrder ?? 0,
      parentId: parent.id,
      organizationType: parent.nodeType === 'ROOT' ? 'GROUP' : 'COMPANY',
    });
  };

  return (
    <Row gutter={16} align="top">
      <Col xs={24} md={8} lg={7} xl={6}>
        <Card
          title="组织架构"
          extra={
            <Space>
              <Button size="small" icon={<PlusOutlined />} onClick={handleOpenCreateDepartment}>
                新增
              </Button>
              <Button size="small" icon={<EditOutlined />} onClick={handleOpenEditDepartment}>
                编辑
              </Button>
              <Popconfirm
                title="确定删除该组织吗？"
                onConfirm={handleDeleteDepartment}
              >
                <Button size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Input
              placeholder="搜索组织名称/编码"
              prefix={<SearchOutlined />}
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
            />
            <Tree
              showLine
              defaultExpandAll
              draggable={(node) => {
                const data = orgNodeMap[String(node.key)];
                return !!data && data.nodeType !== 'ROOT' && data.nodeType !== 'COMPANY_ROOT';
              }}
              selectedKeys={selectedOrgId ? [selectedOrgId] : []}
              treeData={treeData}
              filterTreeNode={(node) => {
                if (!treeSearch.trim()) return false;
                const keyword = treeSearch.trim().toLowerCase();
                const item = orgNodeMap[String(node.key)];
                if (!item) return false;
                return item.name.toLowerCase().includes(keyword) || item.code.toLowerCase().includes(keyword);
              }}
              onSelect={(keys) => {
                setSelectedOrgId(keys[0] as string | undefined);
                setPage(1);
              }}
              onDrop={onTreeDrop}
            />
          </Space>
        </Card>
      </Col>

      <Col xs={24} md={16} lg={17} xl={18}>
        <Card
          title="用户列表"
          extra={
            <Space wrap>
              <Input
                placeholder="用户名/账号搜索"
                prefix={<SearchOutlined />}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{ width: 220 }}
              />
              <Select<StatusFilter>
                style={{ width: 160 }}
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                options={[
                  { label: '全部用户', value: 'ALL' },
                  { label: '启用的用户', value: 'ACTIVE' },
                  { label: '禁用的用户', value: 'INACTIVE' },
                  { label: '锁定的用户', value: 'LOCKED' },
                ]}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateUser}>
                新增用户
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
              showSizeChanger: true,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
          />
        </Card>
      </Col>

      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
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
            name="name"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="username"
            label="账号"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input disabled={!!editingUser} />
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
          <Form.Item name="departmentId" label="默认组织">
            <TreeSelect
              allowClear
              treeDefaultExpandAll
              treeData={departmentSelectTree}
              placeholder="选择默认组织"
            />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value="ACTIVE">启用</Select.Option>
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
        title={editingDepartment ? '编辑组织' : '新增组织'}
        open={orgEditorOpen}
        onOk={handleSaveDepartment}
        onCancel={() => {
          setOrgEditorOpen(false);
          setEditingDepartment(null);
          departmentForm.resetFields();
        }}
        confirmLoading={createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
      >
        <Form form={departmentForm} layout="vertical">
          {!editingDepartment && orgEditorParentNode?.nodeType === 'ROOT' && (
            <Form.Item
              name="nodeType"
              label="组织类型"
              rules={[{ required: true, message: '请选择组织类型' }]}
            >
              <Select
                options={[
                  { label: '集团部门', value: 'DEPARTMENT' },
                  { label: '公司', value: 'COMPANY' },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label="组织名称"
            rules={[{ required: true, message: '请输入组织名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="code"
            label="组织编码"
            rules={[{ required: true, message: '请输入组织编码' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`数据权限配置 - ${dataPermissionUser?.name || ''}`}
        open={dataPermissionModalOpen}
        width={700}
        onOk={async () => {
          if (!dataPermissionUser) return;
          try {
            await updateCompanyScopesMutation.mutateAsync({
              userId: dataPermissionUser.id,
              companyCodes: selectedCompanyCodes,
            });
            await updateRepositoryScopesMutation.mutateAsync({
              userId: dataPermissionUser.id,
              repositoryIds: selectedRepoIds,
            });
            await updateArchiveScopesMutation.mutateAsync({
              userId: dataPermissionUser.id,
              companyCodes: selectedArchiveCompanyCodes,
            });
          } catch {
            message.error('权限更新失败');
          }
        }}
        onCancel={() => {
          setDataPermissionModalOpen(false);
          setDataPermissionUser(null);
          setSelectedCompanyCodes([]);
          setSelectedRepoIds([]);
          setSelectedArchiveCompanyCodes([]);
        }}
        confirmLoading={updateCompanyScopesMutation.isPending || updateRepositoryScopesMutation.isPending || updateArchiveScopesMutation.isPending}
      >
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ marginBottom: 12 }}>公司数据权限</h4>
          <p style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>
            选择用户可以访问的公司数据范围。这是最高级别的数据权限控制，用户只能访问勾选公司下的数据。
          </p>
          <Checkbox.Group
            value={selectedCompanyCodes}
            onChange={(values) => {
              const newCompanyCodes = values as string[];
              const oldCompanyCodes = selectedCompanyCodes;
              setSelectedCompanyCodes(newCompanyCodes);

              // 找出新增的公司
              const addedCodes = newCompanyCodes.filter((code) => !oldCompanyCodes.includes(code));
              // 找出移除的公司
              const removedCodes = oldCompanyCodes.filter((code) => !newCompanyCodes.includes(code));

              // 新增公司时，自动勾选该公司下的所有仓库
              const reposToAdd = allRepositories
                .filter((repo) => repo.companyCode && addedCodes.includes(repo.companyCode))
                .map((repo) => repo.id);

              // 移除公司时，取消勾选该公司下的仓库
              const reposToRemove = new Set(
                allRepositories
                  .filter((repo) => repo.companyCode && removedCodes.includes(repo.companyCode))
                  .map((repo) => repo.id)
              );

              setSelectedRepoIds((prev) => {
                const filtered = prev.filter((id) => !reposToRemove.has(id));
                const combined = [...new Set([...filtered, ...reposToAdd])];
                return combined;
              });
            }}
            style={{ width: '100%' }}
          >
            <Row gutter={[16, 8]}>
              {companyCatalog.map((company) => (
                <Col span={8} key={company.code}>
                  <Checkbox value={company.code}>{company.name}</Checkbox>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
          {companyCatalog.length === 0 && (
            <p style={{ color: '#999', fontSize: 12 }}>暂无公司数据，请先在系统设置中配置公司目录</p>
          )}
        </div>

        <div>
          <h4 style={{ marginBottom: 12 }}>仓库访问权限（白名单）</h4>
          <p style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>
            选择用户可以访问的仓库。<strong>这是最高级别的访问控制</strong>，角色的仓库功能权限仅决定能否执行操作，此处决定用户能否看到和访问该仓库。
          </p>
          <Checkbox.Group
            value={selectedRepoIds}
            onChange={(values) => setSelectedRepoIds(values as string[])}
            style={{ width: '100%' }}
          >
            <Row gutter={[16, 8]}>
              {allRepositories
                .filter((repo) => !repo.companyCode || selectedCompanyCodes.includes(repo.companyCode))
                .map((repo) => (
                  <Col span={12} key={repo.id}>
                    <Checkbox value={repo.id}>
                      {repo.name}
                      {repo.companyCode && (
                        <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                          ({companyCatalog.find((c) => c.code === repo.companyCode)?.name || repo.companyCode})
                        </span>
                      )}
                    </Checkbox>
                  </Col>
                ))}
            </Row>
          </Checkbox.Group>
          {allRepositories.filter((repo) => !repo.companyCode || selectedCompanyCodes.includes(repo.companyCode)).length === 0 && (
            <p style={{ color: '#999', fontSize: 12 }}>
              {selectedCompanyCodes.length === 0 ? '请先选择公司权限' : '当前选中的公司范围内暂无仓库'}
            </p>
          )}
        </div>

        <div>
          <h4 style={{ marginBottom: 12 }}>档案访问权限（白名单）</h4>
          <p style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>
            选择用户可以访问的档案公司范围。<strong>这是档案模块的最高级别访问控制</strong>，角色的档案功能权限仅决定能否执行操作，此处决定用户能否看到和访问该公司的档案。
          </p>
          <Checkbox.Group
            value={selectedArchiveCompanyCodes}
            onChange={(values) => setSelectedArchiveCompanyCodes(values as string[])}
            style={{ width: '100%' }}
          >
            <Row gutter={[16, 8]}>
              {companyCatalog.map((company) => (
                <Col span={8} key={company.code}>
                  <Checkbox value={company.code}>{company.name}</Checkbox>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
          {companyCatalog.length === 0 && (
            <p style={{ color: '#999', fontSize: 12 }}>暂无公司数据，请先在系统设置中配置公司目录</p>
          )}
        </div>
      </Modal>
    </Row>
  );
};

export default UserManagement;
