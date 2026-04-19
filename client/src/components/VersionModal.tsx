import { Modal, List, Button, Typography, Space, Empty, Spin, App } from 'antd';
import { RollbackOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentApi, Document, DocumentVersion } from '../services/api';

const { Text } = Typography;

interface VersionModalProps {
  open: boolean;
  document: Document;
  onClose: () => void;
}

const VersionModal: React.FC<VersionModalProps> = ({ open, document, onClose }) => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['versions', document.id],
    queryFn: () => documentApi.getVersions(document.id),
    enabled: open,
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) =>
      documentApi.restoreVersion(document.id, versionId),
    onSuccess: () => {
      message.success('版本恢复成功');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      onClose();
    },
  });

  const versions = data?.data.data || [];

  const formatSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('zh-CN');
  };

  return (
    <Modal
      title={`版本历史 - ${document.name}`}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={600}
    >
      {isLoading ? (
        <Spin />
      ) : versions.length === 0 ? (
        <Empty description="暂无版本历史" />
      ) : (
        <List
          className="version-list"
          dataSource={versions}
          renderItem={(version: DocumentVersion) => (
            <List.Item
              className="version-item"
              actions={[
                <Button
                  key="restore"
                  icon={<RollbackOutlined />}
                  onClick={() => restoreMutation.mutate(version.id)}
                  loading={restoreMutation.isPending}
                >
                  恢复
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>版本 {version.version}</Text>
                    {version.version === versions[0].version && (
                      <Text type="success">(当前版本)</Text>
                    )}
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">{formatDate(version.createdAt)}</Text>
                    <Text type="secondary">{formatSize(version.size)}</Text>
                    {version.commitMessage && (
                      <Text type="secondary">{version.commitMessage}</Text>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
};

export default VersionModal;
