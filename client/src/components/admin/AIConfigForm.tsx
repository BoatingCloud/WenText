import { useEffect, useState } from 'react';
import {
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Slider,
  Button,
  Space,
  Alert,
  Spin,
  App,
  Row,
  Col,
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemConfigApi, AIProvider, AIConfig } from '../../services/api';

const { Option } = Select;

// AI服务提供商配置
const AI_PROVIDERS = [
  {
    value: 'openai' as AIProvider,
    label: 'OpenAI GPT',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4',
  },
  {
    value: 'claude' as AIProvider,
    label: 'Anthropic Claude',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-opus',
  },
  {
    value: 'wenxin' as AIProvider,
    label: '文心一言（百度）',
    defaultEndpoint: 'https://aip.baidubce.com',
    defaultModel: 'ERNIE-Bot-4',
  },
  {
    value: 'qwen' as AIProvider,
    label: '通义千问（阿里）',
    defaultEndpoint: 'https://dashscope.aliyuncs.com',
    defaultModel: 'qwen-max',
  },
  {
    value: 'spark' as AIProvider,
    label: '讯飞星火',
    defaultEndpoint: 'https://spark-api.xf-yun.com',
    defaultModel: 'spark-3.5',
  },
  {
    value: 'zhipu' as AIProvider,
    label: '智谱AI',
    defaultEndpoint: 'https://open.bigmodel.cn/api',
    defaultModel: 'glm-4',
  },
  {
    value: 'custom' as AIProvider,
    label: '自定义',
    defaultEndpoint: '',
    defaultModel: '',
  },
];

const AIConfigForm: React.FC = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);

  // 获取AI配置
  const { data: configData, isLoading } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => systemConfigApi.getAIConfig(),
  });

  // 更新AI配置
  const updateMutation = useMutation({
    mutationFn: (values: Partial<AIConfig>) => systemConfigApi.updateAIConfig(values),
    onSuccess: () => {
      message.success('AI配置保存成功');
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '保存失败');
    },
  });

  // 初始化表单值
  useEffect(() => {
    if (configData?.data?.data) {
      form.setFieldsValue(configData.data.data);
    }
  }, [configData, form]);

  // 处理提供商变更
  const handleProviderChange = (provider: AIProvider) => {
    const providerConfig = AI_PROVIDERS.find(p => p.value === provider);
    if (providerConfig) {
      form.setFieldsValue({
        apiEndpoint: providerConfig.defaultEndpoint || undefined,
        model: providerConfig.defaultModel || undefined,
      });
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    try {
      await form.validateFields(['provider', 'apiKey']);
      const values = form.getFieldsValue();

      if (!values.apiKey) {
        message.error('请输入API密钥');
        return;
      }

      setTesting(true);
      setTestResult(null);

      const response = await systemConfigApi.testAIConnection({
        provider: values.provider,
        apiKey: values.apiKey,
        apiEndpoint: values.apiEndpoint,
        model: values.model,
      });

      if (response.data.data) {
        setTestResult(response.data.data);

        if (response.data.data.success) {
          message.success(`连接成功！延迟: ${response.data.data.latency}ms`);
        } else {
          message.error(response.data.data.message);
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '测试失败');
      setTestResult({
        success: false,
        message: error.response?.data?.message || '测试失败',
      });
    } finally {
      setTesting(false);
    }
  };

  // 保存配置
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      updateMutation.mutate(values);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  if (isLoading) {
    return <Spin />;
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        enabled: false,
        provider: 'openai',
        maxTokens: 4000,
        temperature: 0.3,
      }}
    >
      <Alert
        message="AI配置说明"
        description="配置AI服务后，系统可以使用AI进行文档审查、智能分析等功能。请妥善保管API密钥，不要泄露给他人。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form.Item
        label="启用AI功能"
        name="enabled"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      <Form.Item
        label="AI服务提供商"
        name="provider"
        rules={[{ required: true, message: '请选择AI服务提供商' }]}
      >
        <Select onChange={handleProviderChange}>
          {AI_PROVIDERS.map(provider => (
            <Option key={provider.value} value={provider.value}>
              {provider.label}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        label="API密钥"
        name="apiKey"
        rules={[{ required: true, message: '请输入API密钥' }]}
        extra="密钥将加密存储，显示时会脱敏处理"
      >
        <Input.Password placeholder="请输入API密钥" />
      </Form.Item>

      <Form.Item
        label="API端点"
        name="apiEndpoint"
        extra="留空使用默认端点"
      >
        <Input placeholder="如：https://api.openai.com/v1" />
      </Form.Item>

      <Form.Item
        label="模型名称"
        name="model"
        extra="如：gpt-4, claude-3-opus, ERNIE-Bot-4"
      >
        <Input placeholder="请输入模型名称" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="最大Token数"
            name="maxTokens"
            rules={[
              { required: true, message: '请输入最大Token数' },
              { type: 'number', min: 100, max: 32000, message: '范围：100-32000' },
            ]}
          >
            <InputNumber min={100} max={32000} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="温度参数"
            name="temperature"
            rules={[
              { required: true, message: '请输入温度参数' },
              { type: 'number', min: 0, max: 2, message: '范围：0-2' },
            ]}
            extra="控制输出的随机性，0表示确定性，2表示最大随机性"
          >
            <Slider min={0} max={2} step={0.1} marks={{ 0: '0', 1: '1', 2: '2' }} />
          </Form.Item>
        </Col>
      </Row>

      {testResult && (
        <Alert
          message={testResult.success ? '连接成功' : '连接失败'}
          description={
            testResult.success
              ? `延迟: ${testResult.latency}ms`
              : testResult.message
          }
          type={testResult.success ? 'success' : 'error'}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Form.Item>
        <Space>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={updateMutation.isPending}
          >
            保存配置
          </Button>
          <Button
            onClick={handleTestConnection}
            loading={testing}
          >
            测试连接
          </Button>
          <Button onClick={() => form.resetFields()}>
            重置
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default AIConfigForm;
