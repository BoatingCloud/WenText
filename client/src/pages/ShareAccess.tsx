import { useState } from 'react';
import { Card, Input, Button, Typography, Space, Spin, Empty, App } from 'antd';
import { DownloadOutlined, FileOutlined, FolderOutlined, LockOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { shareApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;

const ShareAccess: React.FC = () => {
  const { message } = App.useApp();
  const { code } = useParams<{ code: string }>();
  const [password, setPassword] = useState('');
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['share-access', code, isPasswordVerified ? password : ''],
    queryFn: () => shareApi.accessInfo(code!, isPasswordVerified ? password : undefined),
    enabled: !!code,
    retry: false,
  });
  const accessPayload = data?.data.data;

  const accessMutation = useMutation({
    mutationFn: () => shareApi.access(code!, password),
    onSuccess: (response) => {
      if (response.data.success) {
        setIsPasswordVerified(true);
        refetch();
      }
    },
    onError: (err) => {
      const error = err as AxiosError<{ message?: string }>;
      message.error(error.response?.data?.message || '提取码错误');
    },
  });

  const handleDownload = async () => {
    if (!accessPayload || !('document' in accessPayload)) return;

    try {
      const doc = accessPayload.document;
      const response = await shareApi.downloadByCode(code!, isPasswordVerified ? password : undefined);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('下载失败');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}>
        <Spin size="large" />
      </div>
    );
  }

  const shareData = accessPayload;
  const needPassword =
    !isPasswordVerified &&
    !!shareData &&
    'needPassword' in shareData &&
    shareData.needPassword === true;
  const hasSharePayload =
    !!shareData &&
    'share' in shareData &&
    'document' in shareData;
  const accessErrorMessage =
    (error as AxiosError<{ message?: string }>)?.response?.data?.message || '分享链接无效或已过期';

  if (!hasSharePayload && !needPassword) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}>
        <Card style={{ width: 400, textAlign: 'center' }}>
          <Empty description={accessErrorMessage} />
        </Card>
      </div>
    );
  }

  if (needPassword) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}>
        <Card style={{ width: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <LockOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <Title level={4} style={{ marginTop: 16 }}>
              此分享需要提取码
            </Title>
          </div>
          <Input.Password
            size="large"
            placeholder="请输入提取码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={() => accessMutation.mutate()}
          />
          <Button
            type="primary"
            size="large"
            block
            style={{ marginTop: 16 }}
            onClick={() => accessMutation.mutate()}
            loading={accessMutation.isPending}
          >
            验证
          </Button>
        </Card>
      </div>
    );
  }

  if (!hasSharePayload) {
    return null;
  }

  const { share, document: doc } = shareData;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0f2f5',
      padding: 24,
    }}>
      <Card style={{ width: 500 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {doc.type === 'FOLDER' ? (
            <FolderOutlined style={{ fontSize: 64, color: '#faad14' }} />
          ) : (
            <FileOutlined style={{ fontSize: 64, color: '#1890ff' }} />
          )}
        </div>

        <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
          {doc.name}
        </Title>

        <Paragraph type="secondary" style={{ textAlign: 'center' }}>
          {doc.path}
        </Paragraph>

        <div style={{
          background: '#f5f5f5',
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
        }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">文件大小</Text>
              <Text>{formatSize(doc.size)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">访问次数</Text>
              <Text>{share.viewCount}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">下载次数</Text>
              <Text>{share.downloadCount}</Text>
            </div>
          </Space>
        </div>

        {share.permissions.includes('download') && doc.type === 'FILE' && (
          <Button
            type="primary"
            size="large"
            block
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            下载文件
          </Button>
        )}
      </Card>
    </div>
  );
};

export default ShareAccess;
