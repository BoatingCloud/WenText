import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Badge, Select } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  FolderOutlined,
  SettingOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  LogoutOutlined,
  BellOutlined,
  BankOutlined,
  ApartmentOutlined,
  NodeIndexOutlined,
  AuditOutlined,
  BarChartOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCompanyScopeStore } from '../../stores/companyScopeStore';
import { useSiteTheme } from '../../theme/ThemeProvider';
import { approvalTodoApi } from '../../services/api';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [todoCount, setTodoCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuthStore();
  const { siteName } = useSiteTheme();
  const {
    isLoading: companyScopeLoading,
    selectedCompanyCode,
    getEffectiveCompanies,
    setSelectedCompanyCode,
    fetchCompanyData,
  } = useCompanyScopeStore();

  const effectiveCompanies = getEffectiveCompanies();

  // 获取用户公司权限数据
  useEffect(() => {
    if (user?.id) {
      fetchCompanyData(user.id);
    }
  }, [user?.id, fetchCompanyData]);

  // 获取审批待办未读数量
  useEffect(() => {
    const loadTodoCount = async () => {
      try {
        const res = await approvalTodoApi.unreadCount();
        if (res.data.success && typeof res.data.data === 'number') {
          setTodoCount(res.data.data);
        }
      } catch { /* ignore */ }
    };
    loadTodoCount();
    const timer = setInterval(loadTodoCount, 60000);
    return () => clearInterval(timer);
  }, []);

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '工作台',
    },
    {
      key: '/files',
      icon: <FolderOutlined />,
      label: '文件管理',
    },
    {
      key: '/reports/archives',
      icon: <BarChartOutlined />,
      label: '档案报表',
    },
    ...(hasPermission('user:view') || hasPermission('role:view') || hasPermission('repo:manage') || hasPermission('archive:view') || hasPermission('doc-review:view') || hasPermission('doc-review:view-dept') || hasPermission('doc-review:view-all') || hasPermission('system:manage') || hasPermission('system:config') || hasPermission('system:view')
      ? [
          {
            key: 'admin',
            icon: <SettingOutlined />,
            label: '系统管理',
            children: [
              ...(hasPermission('user:view')
                ? [{ key: '/admin/users', icon: <TeamOutlined />, label: '用户管理' }]
                : []),
              ...(hasPermission('role:view')
                ? [{ key: '/admin/roles', icon: <SafetyOutlined />, label: '角色管理' }]
                : []),
              ...(hasPermission('repo:manage')
                ? [{ key: '/admin/repositories', icon: <DatabaseOutlined />, label: '仓库管理' }]
                : []),
              ...(hasPermission('archive:view')
                ? [{ key: '/admin/physical-archives', icon: <FileTextOutlined />, label: '档案管理' }]
                : []),
              ...(hasPermission('archive:view')
                ? [{ key: '/admin/archive-categories', icon: <ApartmentOutlined />, label: '档案分类' }]
                : []),
              ...(hasPermission('archive:view')
                ? [{ key: '/admin/borrow-approvals', icon: <AuditOutlined />, label: '借阅审批' }]
                : []),
              ...(hasPermission('doc-review:view') || hasPermission('doc-review:view-dept') || hasPermission('doc-review:view-all')
                ? [{ key: '/admin/document-reviews', icon: <FileDoneOutlined />, label: '文档审查' }]
                : []),
              ...(hasPermission('system:manage')
                ? [{ key: '/admin/borrow-workflow-config', icon: <NodeIndexOutlined />, label: '借阅工作流' }]
                : []),
              ...(hasPermission('system:view')
                ? [{ key: '/admin/settings', icon: <SettingOutlined />, label: '系统设置' }]
                : []),
            ],
          },
        ]
      : []),
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/profile'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: async () => {
        await logout();
        navigate('/login');
      },
    },
  ];

  return (
    <Layout className="app-shell">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        width={248}
        className="app-sider"
      >
        <div className="logo app-logo">
          {collapsed ? siteName.slice(0, 2) : siteName}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[
            // 支持子路由匹配：/admin/physical-archives/create -> /admin/physical-archives
            ['/admin/physical-archives', '/admin/archive-categories', '/admin/borrow-workflow-config', '/admin/borrow-approvals', '/admin/document-reviews', '/admin/repositories', '/admin/roles', '/admin/users', '/admin/settings', '/files', '/statistics']
              .find((prefix) => location.pathname.startsWith(prefix))
            || (location.pathname === '/' ? '/' : location.pathname)
          ]}
          className="app-menu"
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div
            onClick={() => setCollapsed(!collapsed)}
            className="header-trigger"
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          <Space size="large" className="header-tools">
            {/* 公司切换选择器 */}
            {effectiveCompanies.length > 1 && (
              <Select
                value={selectedCompanyCode}
                onChange={setSelectedCompanyCode}
                loading={companyScopeLoading}
                style={{ minWidth: 150 }}
                size="small"
                placeholder="选择公司"
                suffixIcon={<BankOutlined />}
                options={effectiveCompanies.map((c) => ({
                  value: c.code,
                  label: c.name,
                }))}
              />
            )}
            {effectiveCompanies.length === 1 && (
              <Space size={4}>
                <BankOutlined />
                <span style={{ fontSize: 13 }}>{effectiveCompanies[0].name}</span>
              </Space>
            )}
            <Badge count={todoCount} onClick={() => navigate('/admin/borrow-approvals')}>
              <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space className="header-user">
                <Avatar icon={<UserOutlined />} src={user?.avatar} />
                <span>{user?.name}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content className="site-layout-content app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
