import { useEffect, useState } from 'react';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Upload,
  List,
  Popconfirm,
  Tag,
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  UploadOutlined,
  FileTextOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import {
  documentReviewApi,
  systemConfigApi,
  userApi,
} from '../../../services/api';
import type {
  CreateDocumentReviewInput,
  UpdateDocumentReviewInput,
  CompanyCatalogItem,
  DocumentReviewAttachment,
} from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import { documentTypeOptions } from './constants';

const DocumentReviewForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const currentUser = useAuthStore((s) => s.user);
  const [uploading, setUploading] = useState(false);
  const [createdReviewId, setCreatedReviewId] = useState<string | null>(null);

  const isEdit = !!id && id !== 'new';
  const reviewId = isEdit ? id : createdReviewId;

  // 获取系统配置（公司目录）
  const { data: settingsData } = useQuery({
    queryKey: ['system-config-public'],
    queryFn: () => systemConfigApi.getPublicTheme(),
  });
  const companyCatalog: CompanyCatalogItem[] = settingsData?.data.data?.companyCatalog || [];

  // 获取当前用户的公司数据权限
  const { data: companyScopesData } = useQuery({
    queryKey: ['my-company-scopes', currentUser?.id],
    enabled: !!currentUser?.id,
    queryFn: () => userApi.getCompanyScopes(currentUser!.id),
  });
  const isAllCompanies = companyScopesData?.data.data?.isAllCompanies ?? false;
  const myCompanyCodes = companyScopesData?.data.data?.companyCodes ?? [];

  // 根据用户权限过滤可见的公司列表
  const visibleCompanyCatalog = isAllCompanies
    ? companyCatalog
    : companyCatalog.filter((c) => myCompanyCodes.includes(c.code));

  // 获取审查详情（编辑模式）
  const { data: reviewData, isLoading: isLoadingReview } = useQuery({
    queryKey: ['document-review', reviewId],
    queryFn: () => documentReviewApi.get(reviewId!),
    enabled: !!reviewId,
  });

  const review = reviewData?.data.data;
  const attachments: DocumentReviewAttachment[] = (review?.attachments as any) || [];

  // 创建审查
  const createMutation = useMutation({
    mutationFn: (data: CreateDocumentReviewInput) => documentReviewApi.create(data),
    onSuccess: (response) => {
      message.success('创建成功，可继续上传附件');
      queryClient.invalidateQueries({ queryKey: ['document-reviews'] });
      const newId = response.data.data?.id;
      setCreatedReviewId(newId || null);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '创建失败');
    },
  });

  // 更新审查
  const updateMutation = useMutation({
    mutationFn: (data: UpdateDocumentReviewInput) => documentReviewApi.update(reviewId!, data),
    onSuccess: () => {
      message.success('更新成功');
      queryClient.invalidateQueries({ queryKey: ['document-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['document-review', reviewId] });
      navigate(`/admin/document-reviews/${reviewId}`);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '更新失败');
    },
  });

  // 删除附件
  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => documentReviewApi.deleteAttachment(reviewId!, attachmentId),
    onSuccess: () => {
      message.success('附件已删除');
      queryClient.invalidateQueries({ queryKey: ['document-review', reviewId] });
    },
    onError: (error: any) => message.error(error.response?.data?.message || '删除失败'),
  });

  // 初始化表单数据
  useEffect(() => {
    if (reviewId && reviewData?.data.data) {
      const r = reviewData.data.data;
      form.setFieldsValue({
        title: r.title,
        documentType: r.documentType,
        departmentId: r.departmentId,
        companyCode: r.companyCode,
        workflowId: r.workflowId,
      });
    } else if (!isEdit && !createdReviewId) {
      // 新建时设置默认值
      form.setFieldsValue({
        departmentId: currentUser?.departmentId,
        companyCode: myCompanyCodes.length > 0 ? myCompanyCodes[0] : undefined,
      });
    }
  }, [reviewId, reviewData, form, currentUser, myCompanyCodes, isEdit, createdReviewId]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit || createdReviewId) {
        updateMutation.mutate(values);
      } else {
        createMutation.mutate(values);
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    if (!reviewId) {
      message.warning('请先保存基本信息');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file as File);
      await documentReviewApi.uploadAttachment(reviewId, formData);
      message.success('上传成功');
      queryClient.invalidateQueries({ queryKey: ['document-review', reviewId] });
      onSuccess?.({});
    } catch (error: any) {
      message.error(error.response?.data?.message || '上传失败');
      onError?.(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: DocumentReviewAttachment) => {
    if (!reviewId) return;
    try {
      const response = await documentReviewApi.downloadAttachment(reviewId, attachment.id);
      const blob = new Blob([response.data as any]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('下载失败');
    }
  };

  const handleComplete = () => {
    navigate(`/admin/document-reviews/${reviewId}`);
  };

  const isLoading = isLoadingReview || createMutation.isPending || updateMutation.isPending;
  const canUpload = !!reviewId;

  return (
    <Spin spinning={isLoading}>
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/admin/document-reviews')}
            />
            {isEdit ? '编辑审查' : createdReviewId ? '新建审查（已保存）' : '新建审查'}
          </Space>
        }
        extra={
          <Space>
            <Button onClick={() => navigate('/admin/document-reviews')}>取消</Button>
            {createdReviewId ? (
              <Button type="primary" onClick={handleComplete}>完成</Button>
            ) : (
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSubmit} loading={isLoading}>
                保存
              </Button>
            )}
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          style={{ maxWidth: 800 }}
        >
          <Form.Item
            label="审查标题"
            name="title"
            rules={[
              { required: true, message: '请输入审查标题' },
              { max: 200, message: '标题最多200个字符' },
            ]}
          >
            <Input placeholder="请输入审查标题" />
          </Form.Item>

          <Form.Item
            label="文档类型"
            name="documentType"
            rules={[{ required: true, message: '请选择文档类型' }]}
          >
            <Select placeholder="请选择文档类型" options={documentTypeOptions} />
          </Form.Item>

          <Form.Item
            label="所属公司"
            name="companyCode"
          >
            <Select
              placeholder="请选择所属公司"
              allowClear
              options={visibleCompanyCatalog.map((c) => ({
                label: c.name,
                value: c.code,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="备注"
            name="remark"
          >
            <Input.TextArea
              placeholder="请输入备注信息"
              rows={4}
              maxLength={1000}
              showCount
            />
          </Form.Item>

          {/* 附件上传区域 */}
          <Form.Item label="附件">
            {canUpload ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Upload customRequest={handleUpload} showUploadList={false} multiple={false}>
                  <Button icon={<UploadOutlined />} loading={uploading}>上传附件</Button>
                </Upload>
                {attachments.length > 0 && (
                  <List
                    size="small"
                    bordered
                    dataSource={attachments}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          <Button key="download" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(item)}>下载</Button>,
                          <Popconfirm key="delete" title="确认删除此附件？" onConfirm={() => deleteAttachmentMutation.mutate(item.id)} okText="确认" cancelText="取消">
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>,
                        ]}
                      >
                        <Space>
                          <FileTextOutlined />
                          <span>{item.fileName}</span>
                          <Tag>{(Number(item.fileSize) / 1024 / 1024).toFixed(2)} MB</Tag>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </Space>
            ) : (
              <span style={{ color: '#999' }}>保存基本信息后可上传附件</span>
            )}
          </Form.Item>
        </Form>
      </Card>
    </Spin>
  );
};

export default DocumentReviewForm;
