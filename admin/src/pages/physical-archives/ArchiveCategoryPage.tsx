import { useEffect, useState } from 'react';
import { App, Button, Card, Col, Form, Input, InputNumber, Modal, Row, Space, Switch, Tag, Tree, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ApartmentOutlined } from '@ant-design/icons';
import { archiveCategoryApi, type ArchiveCategory } from '../../services/api';

const { Text } = Typography;

interface TreeDataNode {
  key: string;
  title: React.ReactNode;
  children?: TreeDataNode[];
  data: ArchiveCategory;
}

const ArchiveCategoryPage: React.FC = () => {
  const [tree, setTree] = useState<ArchiveCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ArchiveCategory | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const { message, modal: antModal } = App.useApp();

  const loadTree = async () => {
    setLoading(true);
    try {
      const res = await archiveCategoryApi.getTree();
      if (res.data.success && res.data.data) {
        setTree(res.data.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTree(); }, []);

  const toTreeData = (nodes: ArchiveCategory[]): TreeDataNode[] =>
    nodes.map((n) => ({
      key: n.id,
      title: (
        <Space>
          <span>{n.name}</span>
          <Text type="secondary" style={{ fontSize: 12 }}>({n.code})</Text>
          {!n.isEnabled && <Tag color="red">已禁用</Tag>}
        </Space>
      ),
      children: n.children ? toTreeData(n.children) : undefined,
      data: n,
    }));

  const findInTree = (nodes: ArchiveCategory[], id: string): ArchiveCategory | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = findInTree(n.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const handleSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length === 0) {
      setSelectedCategory(null);
      return;
    }
    const found = findInTree(tree, selectedKeys[0] as string);
    setSelectedCategory(found || null);
  };

  const openCreate = (parentId?: string) => {
    setEditingId(null);
    form.resetFields();
    if (parentId) form.setFieldValue('parentId', parentId);
    setModalOpen(true);
  };

  const openEdit = (cat: ArchiveCategory) => {
    setEditingId(cat.id);
    form.setFieldsValue({
      name: cat.name,
      code: cat.code,
      sortOrder: cat.sortOrder,
      description: cat.description || '',
      isEnabled: cat.isEnabled,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await archiveCategoryApi.update(editingId, values);
        message.success('分类已更新');
      } else {
        await archiveCategoryApi.create(values);
        message.success('分类已创建');
      }
      setModalOpen(false);
      loadTree();
    } catch { /* validation error */ }
  };

  const handleDelete = (cat: ArchiveCategory) => {
    antModal.confirm({
      title: `确认删除分类「${cat.name}」？`,
      content: '删除后不可恢复，且不能删除有子分类的节点。',
      onOk: async () => {
        await archiveCategoryApi.delete(cat.id);
        message.success('分类已删除');
        if (selectedCategory?.id === cat.id) setSelectedCategory(null);
        loadTree();
      },
    });
  };

  return (
    <Row gutter={16}>
      <Col xs={24} md={10}>
        <Card
          className="panel-card"
          title={<Space><ApartmentOutlined /><span>档案分类</span></Space>}
          extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>新增根分类</Button>}
          loading={loading}
        >
          {tree.length > 0 ? (
            <Tree
              treeData={toTreeData(tree)}
              defaultExpandAll
              onSelect={handleSelect}
              selectedKeys={selectedCategory ? [selectedCategory.id] : []}
              blockNode
            />
          ) : (
            <Text type="secondary">暂无分类数据</Text>
          )}
        </Card>
      </Col>
      <Col xs={24} md={14}>
        <Card className="panel-card" title="分类详情">
          {selectedCategory ? (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Row gutter={16}>
                <Col span={12}><Text type="secondary">名称：</Text>{selectedCategory.name}</Col>
                <Col span={12}><Text type="secondary">编码：</Text>{selectedCategory.code}</Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Text type="secondary">层级：</Text>{selectedCategory.level}</Col>
                <Col span={12}><Text type="secondary">排序：</Text>{selectedCategory.sortOrder}</Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Text type="secondary">状态：</Text>{selectedCategory.isEnabled ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>}</Col>
              </Row>
              {selectedCategory.description && (
                <div><Text type="secondary">描述：</Text>{selectedCategory.description}</div>
              )}
              <Space style={{ marginTop: 8 }}>
                <Button icon={<PlusOutlined />} onClick={() => openCreate(selectedCategory.id)}>新增子分类</Button>
                <Button icon={<EditOutlined />} onClick={() => openEdit(selectedCategory)}>编辑</Button>
                <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(selectedCategory)}>删除</Button>
              </Space>
            </Space>
          ) : (
            <Text type="secondary">请在左侧选择一个分类</Text>
          )}
        </Card>
      </Col>

      <Modal
        title={editingId ? '编辑分类' : '新增分类'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ sortOrder: 0, isEnabled: true }}>
          {!editingId && (
            <Form.Item name="parentId" hidden>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input maxLength={100} placeholder="输入分类名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="分类编码"
            rules={[
              { required: true, message: '请输入分类编码' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和连字符' },
            ]}
          >
            <Input maxLength={50} placeholder="如 ADMIN, FINANCE" disabled={!!editingId} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序号">
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea maxLength={255} rows={2} />
          </Form.Item>
          <Form.Item name="isEnabled" label="是否启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
};

export default ArchiveCategoryPage;
