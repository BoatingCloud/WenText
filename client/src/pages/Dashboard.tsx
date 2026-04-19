import { Card, Row, Col, Statistic, List, Typography, Space, Tag } from 'antd';
import {
  FileOutlined,
  FolderOutlined,
  CloudUploadOutlined,
  ShareAltOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { repositoryApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const { Title, Paragraph, Text } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: reposData } = useQuery({
    queryKey: ['accessible-repos'],
    queryFn: () => repositoryApi.accessible(),
  });

  const repositories = reposData?.data.data || [];

  const totalFiles = repositories.reduce((acc, repo) => acc + repo.fileCount, 0);
  const totalSize = repositories.reduce((acc, repo) => acc + repo.totalSize, 0);
  const capabilityTags = ['历史版本', '文件分享', '智能搜索', '远程存储', '回收站', '自动备份'];

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      <Title level={4}>欢迎回来，{user?.name}</Title>
      <Paragraph type="secondary" style={{ marginTop: -6 }}>
        文档平台已支持权限控制、版本追踪、分享协作与多存储接入能力。
      </Paragraph>

      <Card className="panel-card" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={8}>
          <Text strong>能力概览</Text>
          <Space size={[8, 8]} wrap>
            {capabilityTags.map((item) => (
              <Tag key={item} color="default">
                {item}
              </Tag>
            ))}
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="仓库数量"
              value={repositories.length}
              prefix={<FolderOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="文件总数"
              value={totalFiles}
              prefix={<FileOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="存储空间"
              value={formatSize(totalSize)}
              prefix={<CloudUploadOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="分享链接"
              value={0}
              prefix={<ShareAltOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="我的仓库" extra={<a onClick={() => navigate('/files')}>查看全部</a>}>
            <List
              dataSource={repositories.slice(0, 5)}
              renderItem={(repo) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/files/${repo.id}`)}
                >
                  <List.Item.Meta
                    avatar={<FolderOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                    title={repo.name}
                    description={
                      <Space>
                        <span>{repo.fileCount} 个文件</span>
                        <span>{formatSize(repo.totalSize)}</span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: '暂无仓库' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                最近访问
              </Space>
            }
          >
            <List
              dataSource={[]}
              renderItem={(item: { name: string; time: string }) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<FileOutlined />}
                    title={item.name}
                    description={item.time}
                  />
                </List.Item>
              )}
              locale={{ emptyText: '暂无最近访问记录' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
