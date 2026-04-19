import { useState } from 'react';
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
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositoryApi, Repository } from '../../services/api';

const RepositoryManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRepo, setEditingRepo] = useState<Repository | null>(null);
  const [form] = Form.useForm();
  const storageType = Form.useWatch('storageType', form) || 'LOCAL';
  const storageConfigTemplate = storageType === 'MINIO'
    ? `{\n  "endpoint": "minio.example.com",\n  "port": 9000,\n  "useSSL": false,\n  "accessKey": "minioadmin",\n  "secretKey": "******",\n  "bucket": "wenyu",\n  "backup": {\n    "enabled": true,\n    "type": "LOCAL",\n    "basePath": "/data/storage-backup/default"\n  }\n}`
    : storageType === 'SFTP'
      ? `{\n  "host": "sftp.example.com",\n  "port": 22,\n  "username": "wenyu",\n  "password": "******",\n  "backup": {\n    "enabled": true,\n    "type": "LOCAL",\n    "basePath": "/data/storage-backup/default"\n  }\n}`
      : `{\n  "backup": {\n    "enabled": true,\n    "type": "LOCAL",\n    "basePath": "/data/storage-backup/default"\n  }\n}`;

  const { data: reposData, isLoading } = useQuery({
    queryKey: ['repositories', page, pageSize, search],
    queryFn: () => repositoryApi.list({ page, pageSize, search }),
  });

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

  const repos = reposData?.data.data || [];
  const total = reposData?.data.pagination?.total || 0;

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

    const payload: Partial<Repository> = {
      ...rest,
      storageConfig,
    };

    if (editingRepo) {
      updateMutation.mutate({ id: editingRepo.id, values: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Card
      title="仓库管理"
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
        dataSource={repos}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

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
          initialValues={{
            storageType: 'LOCAL',
            storagePath: '/tmp/wenyu/storage/repository',
            versionEnabled: true,
            maxVersions: 100,
            encryptEnabled: false,
            storageConfigText: '',
          }}
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
                    ? '本地存储请填写服务器绝对路径，例如 /tmp/wenyu/storage/contracts。'
                    : '远程存储请填写远端根目录，例如 /data/docs；连接参数请在“描述/配置”中补充。'
                }
                rules={[{ required: true, message: '请输入存储路径' }]}
              >
                <Input placeholder="例如: /data/repos/my-repo" />
              </Form.Item>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                建议每个仓库使用独立目录，避免不同仓库共享同一路径导致文件覆盖。
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
    </Card>
  );
};

export default RepositoryManagement;
