import { useState } from 'react';
import { Form, Input, Button, Card, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSiteTheme } from '../theme/ThemeProvider';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { siteName, allowRegister } = useSiteTheme();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/');
    } catch (error) {
      // Error handled by axios interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <Card
        className="auth-panel"
        variant="borderless"
        title={
          <div className="auth-title">
            {siteName}
          </div>
        }
      >
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          size="large"
          autoComplete="on"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名或邮箱" autoComplete="username" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Link to="/forgot-password">忘记密码？</Link>
          </div>

          <div className="auth-footnote">
            {allowRegister ? (
              <>还没有账号？<Link to="/register">立即注册</Link></>
            ) : (
              '当前系统已关闭自助注册'
            )}
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
