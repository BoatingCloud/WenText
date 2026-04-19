import { useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Switch,
  InputNumber,
  message,
  Popconfirm,
  Typography,
  Row,
  Col,
  List,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  BankOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositoryApi, Repository, systemConfigApi, CompanyCatalogItem } from '../services/api';

const RepositoryManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRepo, setEditingRepo] = useState<Repository | null>(null);
  const [form] = Form.useForm();
  const storageType = Form.useWatch('storageType', form) || 'LOCAL';
  const defaultStoragePath = Form.useWatch('storagePath', form);
  const storageConfigTemplate = storageType === 'MINIO'
    ? `{\n  "endpoint": "minio.example.com",\n  "port": 9000,\n  "useSSL": false,\n  "accessKey": "minioadmin",\n  "secretKey": "******",\n  "bucket": "wenyu",\n  "backup": {\n    "enabled": true,\n    "type": "LOCAL",\n    "basePath": "/data/storage-backup/default"\n  }\n}`
    : storageType === 'SFTP'
      ? `{\n  "host": "sftp.example.com",\n  "port": 22,\n  "username": "wenyu",\n  "password": "******",\n  "backup": {\n    "enabled": true,\n    "type": "LOCAL",\n    "basePath": "/data/storage-backup/default"\n  }\n}`
      : `{\n  "backup": {\n    "enabled": true,\n    "type": "LOCAL",\n    "basePath": "/data/storage-backup/default"\n  }\n}`;

  const { data: settingsData } = useQuery({
    queryKey: ['system-settings', 'repo-defaults'],
    queryFn: () => systemConfigApi.getSettings(),
  });

  const settings = settingsData?.data.data;
  const companyCatalog: CompanyCatalogItem[] = settings?.companyCatalog || [];

  // 获取有效的公司代码（排除特殊值）
  const getValidCompanyCode = () => {
    if (selectedCompanyCode && selectedCompanyCode !== '__unassigned__') {
      return selectedCompanyCode;
    }
    return undefined;
  };

  const getCreateDefaults = () => ({
    storageType: 'LOCAL',
    storagePath: settings?.defaultRepositoryBasePath || '/tmp/wenyu/storage',
    versionEnabled: true,
    maxVersions: settings?.defaultRepositoryMaxVersions || 100,
    encryptEnabled: false,
    storageConfigText: '',
    companyCode: getValidCompanyCode(),
  });

  const { data: reposData, isLoading } = useQuery({
    queryKey: ['repositories', page, pageSize, search],
    queryFn: () => repositoryApi.list({ page, pageSize, search }),
  });

  const allRepos = reposData?.data.data || [];

  // 根据选中的公司筛选仓库
  const filteredRepos = useMemo(() => {
    if (selectedCompanyCode === null) {
      return allRepos; // 显示所有
    }
    if (selectedCompanyCode === '__unassigned__') {
      return allRepos.filter((repo) => !repo.companyCode);
    }
    return allRepos.filter((repo) => repo.companyCode === selectedCompanyCode);
  }, [allRepos, selectedCompanyCode]);

  // 统计各公司仓库数量
  const companyRepoCount = useMemo(() => {
    const counts: Record<string, number> = { __all__: allRepos.length, __unassigned__: 0 };
    companyCatalog.forEach((c) => {
      counts[c.code] = 0;
    });
    allRepos.forEach((repo) => {
      if (repo.companyCode && counts[repo.companyCode] !== undefined) {
        counts[repo.companyCode]++;
      } else if (!repo.companyCode) {
        counts.__unassigned__++;
      }
    });
    return counts;
  }, [allRepos, companyCatalog]);

  const total = reposData?.data.pagination?.total || 0;

  const createMutation = useMutation({
    mutationFn: (values: Partial<Repository>) => repositoryApi.create(values),
    onSuccess: () => {
      message.success('仓库创建成功');
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<Repository> }) =>
      repositoryApi.update(id, values),
    onSuccess: () => {
      message.success('仓库更新成功');
      setModalOpen(false);
      setEditingRepo(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repositoryApi.delete(id),
    onSuccess: () => {
      message.success('仓库删除成功');
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    {
      title: '所属公司',
      dataIndex: 'companyCode',
      key: 'companyCode',
      render: (code: string | null) => {
        if (!code) return <Tag>未分配</Tag>;
        const company = companyCatalog.find((c) => c.code === code);
        return <Tag color="blue">{company?.name || code}</Tag>;
      },
    },
    {
      title: '存储类型',
      dataIndex: 'storageType',
      key: 'storageType',
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: '文件数',
      dataIndex: 'fileCount',
      key: 'fileCount',
    },
    {
      title: '存储大小',
      dataIndex: 'totalSize',
      key: 'totalSize',
      render: (size: number) => formatSize(size),
    },
    {
      title: '版本控制',
      dataIndex: 'versionEnabled',
      key: 'versionEnabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>
          {enabled ? '开启' : '关闭'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : status === 'READONLY' ? 'orange' : 'default'}>
          {status === 'ACTIVE' ? '正常' : status === 'READONLY' ? '只读' : status}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Repository) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              setEditingRepo(record);
              form.setFieldsValue({
                ...record,
                storageConfigText: JSON.stringify(record.storageConfig || {}, null, 2),
              });
              setModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除此仓库吗？"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const { storageConfigText, ...rest } = values;
    let storageConfig: Record<string, unknown> | undefined;

    if (storageConfigText && String(storageConfigText).trim()) {
      try {
        storageConfig = JSON.parse(storageConfigText);
      } catch {
        message.error('存储配置 JSON 格式错误，请检查后重试');
        return;
      }
    }

    if (editingRepo) {
      // 更新时只发送允许更新的字段
      const updatePayload: Partial<Repository> = {
        name: rest.name,
        description: rest.description,
        companyCode: rest.companyCode || null,
        storageConfig,
        versionEnabled: rest.versionEnabled,
        maxVersions: rest.maxVersions,
        encryptEnabled: rest.encryptEnabled,
        status: rest.status,
      };
      updateMutation.mutate({ id: editingRepo.id, values: updatePayload });
    } else {
      // 创建时发送完整的字段
      const createPayload: Partial<Repository> = {
        ...rest,
        storageConfig,
        companyCode: rest.companyCode || null,
      };
      createMutation.mutate(createPayload);
    }
  };

  const companyListItems = [
    {
      key: '__all__',
      code: null,
      name: '全部仓库',
      icon: <AppstoreOutlined />,
    },
    ...companyCatalog.map((c) => ({
      key: c.code,
      code: c.code,
      name: c.name,
      icon: <BankOutlined />,
    })),
    {
      key: '__unassigned__',
      code: '__unassigned__',
      name: '未分配公司',
      icon: <BankOutlined style={{ color: '#999' }} />,
    },
  ];

  return (
    <Row gutter={16} align="top">
      <Col xs={24} md={6} lg={5} xl={4}>
        <Card title="公司分类" size="small">
          <List
            size="small"
            dataSource={companyListItems}
            renderItem={(item) => (
              <List.Item
                onClick={() => setSelectedCompanyCode(item.code)}
                style={{
                  cursor: 'pointer',
                  backgroundColor:
                    (selectedCompanyCode === null && item.key === '__all__') ||
                    selectedCompanyCode === item.code
                      ? '#e6f4ff'
                      : undefined,
                  padding: '8px 12px',
                  borderRadius: 4,
                  marginBottom: 4,
                }}
              >
                <Space>
                  {item.icon}
                  <span>{item.name}</span>
                  <Tag style={{ marginLeft: 'auto' }}>
                    {item.key === '__all__'
                      ? companyRepoCount.__all__
                      : item.key === '__unassigned__'
                        ? companyRepoCount.__unassigned__
                        : companyRepoCount[item.code as string] || 0}
                  </Tag>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Col>

      <Col xs={24} md={18} lg={19} xl={20}>
        <Card
          title={
            selectedCompanyCode === null
              ? '全部仓库'
              : selectedCompanyCode === '__unassigned__'
                ? '未分配公司的仓库'
                : `${companyCatalog.find((c) => c.code === selectedCompanyCode)?.name || selectedCompanyCode} - 仓库列表`
          }
          extra={
            <Space>
              <Input
                placeholder="搜索仓库"
                prefix={<SearchOutlined />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 200 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingRepo(null);
                  form.resetFields();
                  form.setFieldsValue(getCreateDefaults());
                  form.setFieldsValue({ storageConfigText: '' });
                  setModalOpen(true);
                }}
              >
                添加仓库
              </Button>
            </Space>
          }
        >
          <Table
            columns={columns}
            dataSource={filteredRepos}
            rowKey="id"
            loading={isLoading}
            pagination={{
              current: page,
              pageSize,
              total: selectedCompanyCode === null ? total : filteredRepos.length,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
          />
        </Card>
      </Col>

      <Modal
        title={editingRepo ? '编辑仓库' : '添加仓库'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          setEditingRepo(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={getCreateDefaults()}
        >
          <Form.Item
            name="name"
            label="仓库名称"
            rules={[{ required: true, message: '请输入仓库名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="code"
            label="仓库编码"
            rules={[
              { required: true, message: '请输入仓库编码' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '编码只能包含字母、数字、下划线和连字符' },
            ]}
          >
            <Input disabled={!!editingRepo} />
          </Form.Item>
          <Form.Item
            name="companyCode"
            label="所属公司"
            extra="选择仓库所属的公司，用于数据权限控制"
          >
            <Select allowClear placeholder="选择所属公司（可选）">
              {companyCatalog.map((company) => (
                <Select.Option key={company.code} value={company.code}>
                  {company.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="storageConfigText"
            label="存储高级配置 (JSON)"
            extra="可配置 MinIO/SFTP 连接参数与 backup 备份策略。为空则使用系统默认。"
          >
            <Input.TextArea rows={8} placeholder={storageConfigTemplate} />
          </Form.Item>
          {!editingRepo && (
            <>
              <Form.Item
                name="storageType"
                label="存储类型"
                rules={[{ required: true }]}
              >
                <Select>
                  <Select.Option value="LOCAL">本地存储</Select.Option>
                  <Select.Option value="MINIO">MinIO/S3</Select.Option>
                  <Select.Option value="SFTP">SFTP</Select.Option>
                  <Select.Option value="FTP">FTP</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="storagePath"
                label="存储路径"
                extra={
                  storageType === 'LOCAL'
                    ? `本地存储请填写服务器绝对路径。当前系统默认基础路径：${settings?.defaultRepositoryBasePath || '/tmp/wenyu/storage'}`
                    : '远程存储请填写远端根目录，例如 /data/docs；连接参数请在"描述/配置"中补充。'
                }
                rules={[{ required: true, message: '请输入存储路径' }]}
              >
                <Input placeholder="例如: /data/repos/my-repo" />
              </Form.Item>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                建议每个仓库使用独立目录，避免不同仓库共享同一路径导致文件覆盖。示例：{defaultStoragePath || '/tmp/wenyu/storage'}/{'{仓库编码}'}
              </Typography.Text>
            </>
          )}
          <Form.Item
            name="versionEnabled"
            label="版本控制"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.versionEnabled !== curr.versionEnabled}
          >
            {({ getFieldValue }) =>
              getFieldValue('versionEnabled') && (
                <Form.Item name="maxVersions" label="最大版本数">
                  <InputNumber min={1} max={1000} style={{ width: '100%' }} />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item
            name="encryptEnabled"
            label="文件加密"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          {editingRepo && (
            <Form.Item name="status" label="状态">
              <Select>
                <Select.Option value="ACTIVE">正常</Select.Option>
                <Select.Option value="READONLY">只读</Select.Option>
                <Select.Option value="ARCHIVED">归档</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Row>
  );
};

export default RepositoryManagement;
