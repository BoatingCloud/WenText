import { useState } from 'react';
import { Form, Input, Button, Card, Steps, App } from 'antd';
import { MailOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../services/api';
import { useSiteTheme } from '../theme/ThemeProvider';

const { Step } = Steps;

const ForgotPassword: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { siteName } = useSiteTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // 发送验证码
  const sendCodeMutation = useMutation({
    mutationFn: (values: { email: string }) => authApi.forgotPassword(values),
    onSuccess: (response, variables) => {
      setEmail(variables.email);
      message.success('验证码已发送到您的邮箱');
      // TODO: 生产环境应该移除这个提示
      if (response.data.data?.code) {
        message.info(`验证码: ${response.data.data.code} (开发环境)`);
        setVerificationCode(response.data.data.code);
      }
      setCurrentStep(1);
    },
    onError: () => {
      message.error('发送验证码失败');
    },
  });

  // 重置密码
  const resetPasswordMutation = useMutation({
    mutationFn: (values: { email: string; code: string; newPassword: string }) =>
      authApi.resetPassword(values),
    onSuccess: () => {
      message.success('密码重置成功，请使用新密码登录');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    },
    onError: () => {
      message.error('密码重置失败，请检查验证码是否正确');
    },
  });

  const handleSendCode = (values: { email: string }) => {
    sendCodeMutation.mutate(values);
  };

  const handleResetPassword = (values: { code: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    resetPasswordMutation.mutate({
      email,
      code: values.code,
      newPassword: values.newPassword,
    });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 450, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>{siteName}</h1>
          <p style={{ color: '#666', fontSize: 14 }}>重置密码</p>
        </div>

        <Steps current={currentStep} style={{ marginBottom: 32 }}>
          <Step title="输入邮箱" icon={<MailOutlined />} />
          <Step title="验证身份" icon={<SafetyOutlined />} />
          <Step title="设置新密码" icon={<LockOutlined />} />
        </Steps>

        {currentStep === 0 && (
          <Form onFinish={handleSendCode} layout="vertical">
            <Form.Item
              label="邮箱地址"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱地址' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="请输入注册时使用的邮箱"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={sendCodeMutation.isPending}
              >
                发送验证码
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              <Button type="link" onClick={() => navigate('/login')}>
                返回登录
              </Button>
            </div>
          </Form>
        )}

        {currentStep === 1 && (
          <Form onFinish={handleResetPassword} layout="vertical" initialValues={{ code: verificationCode }}>
            <Form.Item
              label="验证码"
              name="code"
              rules={[
                { required: true, message: '请输入验证码' },
                { len: 6, message: '验证码为6位数字' },
                { pattern: /^\d{6}$/, message: '验证码必须是6位数字' },
              ]}
            >
              <Input
                prefix={<SafetyOutlined />}
                placeholder="请输入邮箱收到的6位验证码"
                size="large"
                maxLength={6}
              />
            </Form.Item>

            <Form.Item
              label="新密码"
              name="newPassword"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码至少6个字符' },
                { max: 100, message: '密码最多100个字符' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入新密码"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="确认密码"
              name="confirmPassword"
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
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请再次输入新密码"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={resetPasswordMutation.isPending}
              >
                重置密码
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              <Button type="link" onClick={() => setCurrentStep(0)}>
                返回上一步
              </Button>
              <Button type="link" onClick={() => navigate('/login')}>
                返回登录
              </Button>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default ForgotPassword;
