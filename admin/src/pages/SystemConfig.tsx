import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, Form, Input, InputNumber, Radio, Row, Space, Switch, Typography } from 'antd';
import { BgColorsOutlined, MinusCircleOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSiteTheme } from '../theme/ThemeProvider';
import { resolveThemePreset, ThemePresetId } from '../theme/themePresets';
import { systemConfigApi } from '../services/api';

const { Paragraph, Text, Title } = Typography;

interface SiteSettingsFormValues {
  siteName: string;
  siteDescription: string;
  groupName: string;
  themePreset: ThemePresetId;
  allowRegister: boolean;
  passwordMinLength: number;
  uploadMaxSizeMB: number;
  defaultRepositoryBasePath: string;
  defaultRepositoryMaxVersions: number;
  companyCatalog: Array<{
    name: string;
    code: string;
  }>;
  fondsCatalog: Array<{
    name: string;
    code: string;
  }>;
  archiveBorrowMode: 'direct' | 'workflow';
}

const SystemConfig: React.FC = () => {
  const [form] = Form.useForm<SiteSettingsFormValues>();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const {
    themeOptions,
    refreshThemeConfig
  } = useSiteTheme();

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const response = await systemConfigApi.getSettings();
        if (response.data.success && response.data.data) {
          form.setFieldsValue(response.data.data);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [form]);

  const selectedPreset = Form.useWatch('themePreset', form) || 'sea-salt-blue';

  const previewTheme = useMemo(() => {
    return resolveThemePreset(selectedPreset as ThemePresetId);
  }, [selectedPreset]);

  const handleSubmit = async (values: SiteSettingsFormValues) => {
    if (!values.themePreset) {
      message.error('请选择一个主题');
      return;
    }

    const normalizedValues: SiteSettingsFormValues = {
      ...values,
      groupName: (values.groupName || '').trim(),
      companyCatalog: (values.companyCatalog || [])
        .map((item) => ({
          name: (item.name || '').trim(),
          code: (item.code || '').trim(),
        }))
        .filter((item) => item.name && item.code),
      fondsCatalog: (values.fondsCatalog || [])
        .map((item) => ({
          name: (item.name || '').trim(),
          code: (item.code || '').trim(),
        }))
        .filter((item) => item.name && item.code),
    };

    if (!normalizedValues.groupName) {
      message.error('请填写集团名称');
      return;
    }

    if (normalizedValues.fondsCatalog.length === 0) {
      message.error('请至少配置一个全宗名称');
      return;
    }

    setIsSaving(true);
    try {
      await systemConfigApi.updateSettings(normalizedValues);
      await refreshThemeConfig();
      // 使其他页面（如用户管理）的系统配置缓存失效，确保公司目录等数据同步更新
      queryClient.invalidateQueries({ queryKey: ['site-settings-for-users'] });
      queryClient.invalidateQueries({ queryKey: ['department-tree'] });
      message.success('系统设置已保存并应用');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Card
        className="panel-card"
        title={
          <Space>
            <BgColorsOutlined />
            <span>站点与系统设置</span>
          </Space>
        }
        loading={isLoading}
      >
        <Paragraph style={{ marginTop: 0, marginBottom: 18 }} type="secondary">
          统一管理整站基础信息、主题风格、注册策略与上传限制。保存后会自动应用到整站。
        </Paragraph>

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
            站点信息
          </Title>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="siteName"
                label="站点名称"
                rules={[{ required: true, message: '请输入站点名称' }]}
              >
                <Input maxLength={100} placeholder="输入站点名称" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="siteDescription"
                label="站点简介"
                rules={[{ max: 200, message: '站点简介最多 200 字' }]}
              >
                <Input maxLength={200} placeholder="用于登录页和说明文案" />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5} style={{ marginTop: 8, marginBottom: 12 }}>
            组织配置
          </Title>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="groupName"
                label="集团名称"
                rules={[{ required: true, message: '请输入集团名称' }]}
              >
                <Input maxLength={100} placeholder="例如：天地源" />
              </Form.Item>
            </Col>
          </Row>

          <Form.List name="companyCatalog">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {fields.map((field) => (
                  <Row key={field.key} gutter={8} align="middle">
                    <Col xs={24} md={11}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'name']}
                        label="公司名称"
                        rules={[{ required: true, message: '请输入公司名称' }]}
                      >
                        <Input placeholder="输入公司名称" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={11}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'code']}
                        label="公司编码"
                        rules={[{ required: true, message: '请输入公司编码' }]}
                      >
                        <Input placeholder="输入公司编码" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={2}>
                      <Button
                        danger
                        type="text"
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(field.name)}
                      >
                        删除
                      </Button>
                    </Col>
                  </Row>
                ))}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ name: '', code: '' })}
                  style={{ width: '100%' }}
                >
                  新增公司
                </Button>
              </Space>
            )}
          </Form.List>

          <Form.Item name="themePreset" hidden>
            <Input />
          </Form.Item>

          <Form.Item label="主题风格" required>
            <div className="theme-preset-grid">
              {themeOptions.map((option) => {
                const optionTheme = resolveThemePreset(option.id);
                const isActive = option.id === selectedPreset;

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`theme-preset-item${isActive ? ' active' : ''}`}
                    onClick={() => form.setFieldValue('themePreset', option.id)}
                  >
                    <div className="theme-preset-head">
                      <Text strong>{option.name}</Text>
                      <span className="theme-preset-dots">
                        <i style={{ background: optionTheme.preview.bg }} />
                        <i style={{ background: optionTheme.preview.panel }} />
                        <i style={{ background: optionTheme.preview.action }} />
                      </span>
                    </div>
                    <Text type="secondary">{option.description}</Text>
                  </button>
                );
              })}
            </div>
          </Form.Item>

          <Title level={5} style={{ marginTop: 8, marginBottom: 12 }}>
            注册与安全
          </Title>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="allowRegister"
                label="允许用户自助注册"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="passwordMinLength"
                label="注册密码最小长度"
                rules={[{ required: true, message: '请输入密码最小长度' }]}
              >
                <InputNumber min={6} max={32} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5} style={{ marginTop: 8, marginBottom: 12 }}>
            仓库与上传
          </Title>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="uploadMaxSizeMB"
                label="单文件上传上限 (MB)"
                rules={[{ required: true, message: '请输入上传上限' }]}
              >
                <InputNumber min={10} max={2048} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="defaultRepositoryMaxVersions"
                label="新仓库默认最大版本数"
                rules={[{ required: true, message: '请输入默认最大版本数' }]}
              >
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="defaultRepositoryBasePath"
            label="新仓库默认基础路径"
            extra="用于新建仓库时预填路径，建议使用独立挂载目录"
            rules={[{ required: true, message: '请输入默认基础路径' }]}
          >
            <Input placeholder="/tmp/wenyu/storage" />
          </Form.Item>

          <Title level={5} style={{ marginTop: 8, marginBottom: 12 }}>
            档案管理设置
          </Title>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="archiveBorrowMode"
                label="借阅模式"
                extra="直接借阅：管理员直接操作借还；工作流审批：借阅需提交申请并经审批链"
              >
                <Radio.Group>
                  <Radio value="direct">直接借阅</Radio>
                  <Radio value="workflow">工作流审批借阅</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Title level={5} style={{ marginTop: 8, marginBottom: 12 }}>
            档案基础字典
          </Title>
          <Form.List name="fondsCatalog">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {fields.map((field) => (
                  <Row key={field.key} gutter={8} align="middle">
                    <Col xs={24} md={11}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'name']}
                        label="全宗名称"
                        rules={[{ required: true, message: '请输入全宗名称' }]}
                      >
                        <Input placeholder="例如：深圳文雨" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={11}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'code']}
                        label="全宗代码"
                        rules={[{ required: true, message: '请输入全宗代码' }]}
                      >
                        <Input placeholder="例如：SZ" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={2}>
                      <Button
                        danger
                        type="text"
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(field.name)}
                      >
                        删除
                      </Button>
                    </Col>
                  </Row>
                ))}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ name: '', code: '' })}
                  style={{ width: '100%' }}
                >
                  新增全宗
                </Button>
              </Space>
            )}
          </Form.List>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSaving}
              icon={<SaveOutlined />}
            >
              保存并应用
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card className="panel-card" title="即时预览">
        <div
          className="theme-preview"
          style={{
            background: previewTheme.colors.bgMain,
            color: previewTheme.colors.textPrimary,
            boxShadow: previewTheme.colors.shadow,
          }}
        >
          <div
            className="theme-preview-panel"
            style={{
              background: previewTheme.colors.bgPanel,
              borderColor: previewTheme.colors.line,
            }}
          >
            <Text style={{ color: previewTheme.colors.textPrimary }}>导航与页面容器</Text>
            <button
              type="button"
              className="theme-preview-action"
              style={{
                background: previewTheme.colors.actionSoft,
                color: previewTheme.colors.action,
              }}
            >
              行动按钮
            </button>
          </div>
        </div>
      </Card>
    </Space>
  );
};

export default SystemConfig;
