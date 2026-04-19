import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Card, Input, Space, Spin, Typography } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, DownloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { ApiResponse, documentApi } from '../services/api';

const { Text, Title } = Typography;

const DocumentEditor: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { repoId, documentId } = useParams<{ repoId: string; documentId: string }>();

  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('');

  const contentQuery = useQuery({
    queryKey: ['document-content', documentId],
    queryFn: () => documentApi.getContent(documentId!),
    enabled: !!documentId,
    retry: false,
  });

  const documentQuery = useQuery({
    queryKey: ['document-meta', documentId],
    queryFn: () => documentApi.get(documentId!),
    enabled: !!documentId,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { content: string; commitMessage?: string }) =>
      documentApi.updateContent(documentId!, payload),
    onSuccess: () => {
      setSavedContent(content);
      setCommitMessage('');
      message.success('保存成功');
    },
  });

  const isDirty = useMemo(() => content !== savedContent, [content, savedContent]);

  useEffect(() => {
    if (!contentQuery.data?.data.data) {
      return;
    }
    const raw = contentQuery.data.data.data.content ?? '';
    setContent(raw);
    setSavedContent(raw);
  }, [contentQuery.data?.data.data?.documentId]);

  const saveContent = async () => {
    if (!isDirty) return;
    await saveMutation.mutateAsync({
      content,
      commitMessage: commitMessage.trim() || undefined,
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!saveMutation.isPending) {
          void saveContent();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDirty, content, commitMessage, saveMutation.isPending]);

  const handleDownload = async () => {
    if (!documentId) return;
    const response = await documentApi.download(documentId);
    const docName = documentQuery.data?.data.data?.name || 'download';
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', docName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const goBack = () => {
    if (repoId) {
      navigate(`/files/${repoId}`);
      return;
    }
    navigate('/files');
  };

  if (contentQuery.isLoading || documentQuery.isLoading) {
    return <Spin />;
  }

  if (contentQuery.isError) {
    const error = contentQuery.error as AxiosError<ApiResponse>;
    const reason = error.response?.data?.message || '暂不支持在线编辑该文件';
    const docName = documentQuery.data?.data.data?.name || '当前文件';

    return (
      <Card>
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={goBack}>
            返回文件列表
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {docName}
          </Title>
          <Text type="secondary">{reason}</Text>
          <Button icon={<DownloadOutlined />} onClick={() => void handleDownload()}>
            下载文件
          </Button>
        </Space>
      </Card>
    );
  }

  const fileName = contentQuery.data?.data.data?.name || documentQuery.data?.data.data?.name || '';

  return (
    <Card>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={goBack}>
              返回
            </Button>
            <Text strong>{fileName}</Text>
            {isDirty && <Text type="warning">未保存</Text>}
          </Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => void saveContent()}
            loading={saveMutation.isPending}
            disabled={!isDirty}
          >
            保存
          </Button>
        </Space>

        <Input
          placeholder="提交备注（可选）"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          maxLength={200}
        />

        <Input.TextArea
          className="editor-container"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          autoSize={false}
          style={{ minHeight: 'calc(100vh - 280px)', fontFamily: 'Menlo, Monaco, monospace' }}
        />
      </Space>
    </Card>
  );
};

export default DocumentEditor;
