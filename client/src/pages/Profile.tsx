import { Card, Form, Input, Button, Avatar, Row, Col, Divider, App } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

const Profile: React.FC = () => {
  const { message } = App.useApp();
  const { user } = useAuthStore();
  const [passwordForm] = Form.useForm();

  const changePasswordMutation = useMutation({
    mutationFn: (values: { oldPassword: string; newPassword: string }) =>
      authApi.changePassword(values),
    onSuccess: () => {
      message.success('密码修改成功');
      passwordForm.resetFields();
    },
  });

  if (!user) return null;

  const organizationPath = (() => {
    const department = user.department;
    if (!department) {
      return '未设置';
    }
    const parent = department.parent;
    if (!parent) {
      return department.name;
    }
    if (parent.parent) {
      return `${parent.parent.name} / ${parent.name} / ${department.name}`;
    }
    return `${parent.name} / ${department.name}`;
  })();

  return (
    <Row gutter={[24, 24]}>
      <Col xs={24} lg={8}>
        <Card>
          <div style={{ textAlign: 'center' }}>
            <Avatar size={100} icon={<UserOutlined />} src={user.avatar} />
            <h2 style={{ marginTop: 16, marginBottom: 4 }}>{user.name}</h2>
            <p style={{ color: '#999' }}>@{user.username}</p>
          </div>
          <Divider />
          <div>
            <p><strong>邮箱：</strong>{user.email}</p>
            <p><strong>手机：</strong>{user.phone || '未设置'}</p>
            <p><strong>组织：</strong>{organizationPath}</p>
            <p><strong>角色：</strong>{user.roles.map(r => r.name).join(', ') || '无'}</p>
            <p><strong>注册时间：</strong>{new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </Card>
      </Col>

      <Col xs={24} lg={16}>
        <Card title="修改密码">
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={(values) => changePasswordMutation.mutate(values)}
            style={{ maxWidth: 400 }}
          >
            <Form.Item
              name="oldPassword"
              label="当前密码"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码至少6个字符' },
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="确认新密码"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: '请确认新密码' },
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
              <Input.Password />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={changePasswordMutation.isPending}
              >
                修改密码
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

export default Profile;
