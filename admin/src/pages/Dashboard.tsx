import { Card, Row, Col, Statistic, Typography, Table, Space, Tag } from 'antd';
import {
  UserOutlined,
  DatabaseOutlined,
  FileOutlined,
  CloudUploadOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { repositoryApi, userApi, roleApi } from '../services/api';

const { Title, Paragraph } = Typography;

const Dashboard: React.FC = () => {
  const { data: usersData } = useQuery({
    queryKey: ['users-count'],
    queryFn: () => userApi.list({ pageSize: 1 }),
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles-count'],
    queryFn: () => roleApi.list({ pageSize: 1 }),
  });

  const { data: reposData } = useQuery({
    queryKey: ['repos'],
    queryFn: () => repositoryApi.list({ pageSize: 100 }),
  });

  const userCount = usersData?.data.pagination?.total || 0;
  const roleCount = rolesData?.data.pagination?.total || 0;
  const repos = reposData?.data.data || [];

  const totalFiles = repos.reduce((acc, repo) => acc + repo.fileCount, 0);
  const totalSize = repos.reduce((acc, repo) => acc + repo.totalSize, 0);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const repoColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '存储类型', dataIndex: 'storageType', key: 'storageType' },
    { title: '文件数', dataIndex: 'fileCount', key: 'fileCount' },
    {
      title: '存储大小',
      dataIndex: 'totalSize',
      key: 'totalSize',
      render: (size: number) => formatSize(size),
    },
    { title: '状态', dataIndex: 'status', key: 'status' },
  ];

  return (
    <div>
      <Title level={4}>系统总览</Title>

      <Card className="panel-card" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={6}>
          <Paragraph style={{ margin: 0 }}>
            当前平台围绕文档管理核心能力构建，覆盖权限、版本、搜索、分享、远程存储与审计追踪。
          </Paragraph>
          <Space size={[8, 8]} wrap>
            <Tag color="default">权限管理</Tag>
            <Tag color="default">历史版本</Tag>
            <Tag color="default">智能搜索</Tag>
            <Tag color="default">文件分享</Tag>
            <Tag color="default">远程存储</Tag>
            <Tag color="default">回收站</Tag>
            <Tag color="default">自动备份</Tag>
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="用户总数"
              value={userCount}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="角色数量"
              value={roleCount}
              prefix={<SafetyOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="仓库数量"
              value={repos.length}
              prefix={<DatabaseOutlined />}
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
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <CloudUploadOutlined />
                存储使用情况
              </Space>
            }
            extra={<span>总计: {formatSize(totalSize)}</span>}
          >
            <Table
              columns={repoColumns}
              dataSource={repos}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
