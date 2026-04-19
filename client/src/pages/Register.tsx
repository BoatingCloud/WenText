import { useState } from 'react';
import { Form, Input, Button, Card, App, Result } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, IdcardOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useSiteTheme } from '../theme/ThemeProvider';

const Register: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { siteName, allowRegister } = useSiteTheme();

  const onFinish = async (values: {
    username: string;
    email: string;
    password: string;
    name: string;
  }) => {
    setLoading(true);
    try {
      const response = await authApi.register(values);
      if (response.data.success) {
        message.success('注册成功，请登录');
        navigate('/login');
      }
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
            注册账号 · {siteName}
          </div>
        }
      >
        {!allowRegister ? (
          <Result
            status="warning"
            title="已关闭自助注册"
            subTitle="当前系统仅允许管理员创建账号。"
            extra={
              <Button type="primary" onClick={() => navigate('/login')}>
                返回登录
              </Button>
            }
          />
        ) : (
          <Form name="register" onFinish={onFinish} size="large" autoComplete="on">
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
            </Form.Item>

            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '邮箱格式不正确' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="邮箱" autoComplete="email" />
            </Form.Item>

            <Form.Item
              name="name"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input prefix={<IdcardOutlined />} placeholder="姓名" autoComplete="name" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="确认密码"
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                注册
              </Button>
            </Form.Item>

            <div className="auth-footnote">
              已有账号？<Link to="/login">立即登录</Link>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default Register;
