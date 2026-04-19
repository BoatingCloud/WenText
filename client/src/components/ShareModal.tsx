import { useState } from 'react';
import { Modal, Form, Select, Input, DatePicker, InputNumber, Button, Space, Typography, App } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { shareApi, Document } from '../services/api';

const { Text } = Typography;

interface ShareModalProps {
  open: boolean;
  document: Document;
  onClose: () => void;
}

type ShareType = 'PUBLIC' | 'PASSWORD' | 'INTERNAL';

interface ShareFormValues {
  shareType: ShareType;
  password?: string;
  permissions: string[];
  expiresAt?: Dayjs;
  maxViews?: number;
}

const ShareModal: React.FC<ShareModalProps> = ({ open, document, onClose }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<ShareFormValues>();
  const [shareLink, setShareLink] = useState<string | null>(null);

  const createShareMutation = useMutation({
    mutationFn: (values: {
      shareType: ShareType;
      password?: string;
      permissions: string[];
      expiresAt?: string;
      maxViews?: number;
    }) => shareApi.create(document.id, values),
    onSuccess: (response) => {
      if (response.data.success && response.data.data) {
        const share = response.data.data;
        const link = `${window.location.origin}/share/${share.code}`;
        setShareLink(link);
        message.success('分享链接创建成功');
      }
    },
  });

  const handleSubmit = async () => {
    const values = await form.validateFields();
    createShareMutation.mutate({
      ...values,
      expiresAt: values.expiresAt?.toISOString(),
    });
  };

  const copyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      message.success('链接已复制');
    }
  };

  const handleClose = () => {
    setShareLink(null);
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={`分享 - ${document.name}`}
      open={open}
      onCancel={handleClose}
      footer={
        shareLink ? (
          <Button onClick={handleClose}>关闭</Button>
        ) : (
          <Space>
            <Button onClick={handleClose}>取消</Button>
            <Button type="primary" onClick={handleSubmit} loading={createShareMutation.isPending}>
              创建分享
            </Button>
          </Space>
        )
      }
    >
      {shareLink ? (
        <div className="share-card">
          <Text strong>分享链接</Text>
          <div className="share-link" style={{ marginTop: 8 }}>
            <Text copyable={{ text: shareLink }}>{shareLink}</Text>
            <Button icon={<CopyOutlined />} onClick={copyLink}>
              复制
            </Button>
          </div>
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            shareType: 'PUBLIC',
            permissions: ['view', 'download'],
          }}
        >
          <Form.Item
            name="shareType"
            label="分享类型"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="PUBLIC">公开分享</Select.Option>
              <Select.Option value="PASSWORD">密码分享</Select.Option>
              <Select.Option value="INTERNAL">内部分享</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.shareType !== curr.shareType}
          >
            {({ getFieldValue }) =>
              getFieldValue('shareType') === 'PASSWORD' && (
                <Form.Item
                  name="password"
                  label="提取码"
                  rules={[
                    { required: true, message: '请输入提取码' },
                    { min: 4, message: '提取码至少4位' },
                  ]}
                >
                  <Input.Password placeholder="请设置提取码" />
                </Form.Item>
              )
            }
          </Form.Item>

          <Form.Item
            name="permissions"
            label="权限"
            rules={[{ required: true }]}
          >
            <Select mode="multiple">
              <Select.Option value="view">查看</Select.Option>
              <Select.Option value="download">下载</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="expiresAt" label="过期时间">
            <DatePicker showTime placeholder="不设置则永不过期" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="maxViews" label="最大访问次数">
            <InputNumber min={1} placeholder="不设置则无限制" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};

export default ShareModal;
