import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  FileSearchOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ApartmentOutlined,
  NodeIndexOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSiteTheme } from '../theme/ThemeProvider';

const { Header, Sider, Content } = Layout;

const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuthStore();
  const { siteName } = useSiteTheme();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    ...(hasPermission('user:view')
      ? [{ key: '/users', icon: <TeamOutlined />, label: '用户管理' }]
      : []),
    ...(hasPermission('role:view')
      ? [{ key: '/roles', icon: <SafetyOutlined />, label: '角色管理' }]
      : []),
    ...(hasPermission('repo:manage')
      ? [{ key: '/repositories', icon: <DatabaseOutlined />, label: '仓库管理' }]
      : []),
    ...(hasPermission('archive:view')
      ? [{ key: '/physical-archives', icon: <FileTextOutlined />, label: '实体档案' }]
      : []),
    ...(hasPermission('archive:view')
      ? [{ key: '/archive-categories', icon: <ApartmentOutlined />, label: '档案分类' }]
      : []),
    ...(hasPermission('archive:view')
      ? [{ key: '/borrow-approvals', icon: <AuditOutlined />, label: '借阅审批' }]
      : []),
    ...(hasPermission('system:manage')
      ? [{ key: '/borrow-workflow-config', icon: <NodeIndexOutlined />, label: '借阅工作流' }]
      : []),
    ...(hasPermission('system:manage')
      ? [{ key: '/review-workflow-config', icon: <NodeIndexOutlined />, label: '审查工作流' }]
      : []),
    ...(hasPermission('system:manage')
      ? [{ key: '/document-reviews', icon: <AuditOutlined />, label: '文档审查' }]
      : []),
    ...(hasPermission('audit:view')
      ? [{ key: '/audit-logs', icon: <FileSearchOutlined />, label: '审计日志' }]
      : []),
    ...(hasPermission('system:manage')
      ? [{ key: '/system-config', icon: <SettingOutlined />, label: '系统配置' }]
      : []),
  ];

  const userMenuItems = [
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
        <div className="logo app-logo" style={{ padding: collapsed ? '16px 8px' : '16px' }}>
          {collapsed ? siteName.slice(0, 2) : `${siteName} · 后台`}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[
            menuItems.find((item) => item.key !== '/' && location.pathname.startsWith(item.key))?.key
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
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space className="header-user">
              <Avatar icon={<UserOutlined />} src={user?.avatar} />
              <span>{user?.name}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
