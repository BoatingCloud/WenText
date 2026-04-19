import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Tabs,
  message,
  Spin,
  Alert,
  Modal,
  Upload,
  List,
  Popconfirm,
  Form,
  Input,
  Select,
  Collapse,
  Avatar,
  Tooltip,
  Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  RobotOutlined,
  ReloadOutlined,
  FileTextOutlined,
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  CommentOutlined,
  UserOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { documentReviewApi } from '../../../services/api';
import type {
  DocumentReview,
  DocumentReviewAttachment,
  ManualReviewAnnotation,
  AnnotationType,
  AnnotationStatus,
} from '../../../services/api';
import AIReviewResult from '../../../components/document-review/AIReviewResult';
import AttachmentPreview from './AttachmentPreview';

const { TextArea } = Input;

const annotationTypeOptions = [
  { label: '风险点', value: 'RISK' },
  { label: '关键点', value: 'KEY_POINT' },
  { label: '漏洞', value: 'GAP' },
  { label: '合规性', value: 'COMPLIANCE' },
  { label: '建议', value: 'SUGGESTION' },
];

const severityOptions = [
  { label: '低', value: 'LOW' },
  { label: '中', value: 'MEDIUM' },
  { label: '高', value: 'HIGH' },
  { label: '严重', value: 'CRITICAL' },
];

const annotationStatusOptions = [
  { label: '待处理', value: 'ACTIVE' },
  { label: '已解决', value: 'RESOLVED' },
  { label: '已忽略', value: 'IGNORED' },
];

const DocumentReviewDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('basic');
  const [uploading, setUploading] = useState(false);
  const [annotationModal, setAnnotationModal] = useState<{ visible: boolean; attachment?: DocumentReviewAttachment }>({ visible: false });
  const [commentModal, setCommentModal] = useState<{ visible: boolean; annotationId?: string }>({ visible: false });
  const [previewModal, setPreviewModal] = useState<{ open: boolean; attachment?: DocumentReviewAttachment }>({ open: false });
  const [annotationForm] = Form.useForm();
  const [commentForm] = Form.useForm();

  const { data: reviewData, isLoading } = useQuery({
    queryKey: ['documentReview', id],
    queryFn: () => documentReviewApi.get(id!),
    enabled: !!id,
  });

  const review = reviewData?.data.data as DocumentReview;

  const { data: aiResultData, isLoading: aiResultLoading, refetch: refetchAIResult } = useQuery({
    queryKey: ['aiReviewResult', id],
    queryFn: () => documentReviewApi.getAIReviewResult(id!),
    enabled: !!id && review?.aiReviewStatus === 'COMPLETED',
  });

  const aiResult = aiResultData?.data.data;

  // 附件删除
  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => documentReviewApi.deleteAttachment(id!, attachmentId),
    onSuccess: () => {
      message.success('附件已删除');
      queryClient.invalidateQueries({ queryKey: ['documentReview', id] });
    },
    onError: (error: any) => message.error(error.response?.data?.message || '删除失败'),
  });

  // AI 审查
  const triggerAIReviewMutation = useMutation({
    mutationFn: () => documentReviewApi.triggerAIReview(id!),
    onSuccess: () => {
      message.success('AI审查已启动，请稍后查看结果');
      queryClient.invalidateQueries({ queryKey: ['documentReview', id] });
      const interval = setInterval(() => {
        refetchAIResult();
        queryClient.invalidateQueries({ queryKey: ['documentReview', id] });
      }, 3000);
      setTimeout(() => clearInterval(interval), 30000);
    },
    onError: (error: any) => message.error(error.response?.data?.message || 'AI审查启动失败'),
  });

  // 创建批注
  const createAnnotationMutation = useMutation({
    mutationFn: (data: { attachmentId: string; annotationType: AnnotationType; content: string; severity?: string }) =>
      documentReviewApi.createAnnotation(id!, data),
    onSuccess: () => {
      message.success('批注已添加');
      setAnnotationModal({ visible: false });
      annotationForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['documentReview', id] });
    },
    onError: (error: any) => message.error(error.response?.data?.message || '添加批注失败'),
  });

  // 更新批注状态
  const updateAnnotationMutation = useMutation({
    mutationFn: ({ annotationId, data }: { annotationId: string; data: { status?: AnnotationStatus; content?: string } }) =>
      documentReviewApi.updateAnnotation(id!, annotationId, data),
    onSuccess: () => {
      message.success('批注已更新');
      queryClient.invalidateQueries({ queryKey: ['documentReview', id] });
    },
    onError: (error: any) => message.error(error.response?.data?.message || '更新失败'),
  });

  // 删除批注
  const deleteAnnotationMutation = useMutation({
    mutationFn: (annotationId: string) => documentReviewApi.deleteAnnotation(id!, annotationId),
    onSuccess: () => {
      message.success('批注已删除');
      queryClient.invalidateQueries({ queryKey: ['documentReview', id] });
    },
    onError: (error: any) => message.error(error.response?.data?.message || '删除失败'),
  });

  // 添加评论
  const addCommentMutation = useMutation({
    mutationFn: ({ annotationId, content }: { annotationId: string; content: string }) =>
      documentReviewApi.addAnnotationComment(id!, annotationId, content),
    onSuccess: () => {
      message.success('评论已添加');
      setCommentModal({ visible: false });
      commentForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['documentReview', id] });
    },
    onError: (error: any) => message.error(error.response?.data?.message || '添加评论失败'),
  });

  // 删除评论
  const deleteCommentMutation = useMutation({
    mutationFn: ({ annotationId, commentId }: { annotationId: string; commentId: string }) =>
      documentReviewApi.deleteAnnotationComment(id!, annotationId, commentId),
    onSuccess: () => {
      message.success('评论已删除');
      queryClient.invalidateQueries({ queryKey: ['documentReview', id] });
    },
    onError: (error: any) => message.error(error.response?.data?.message || '删除评论失败'),
  });

  const handleTriggerAIReview = () => {
    Modal.confirm({
      title: '确认启动AI审查',
      content: '将使用AI对上传的文档进行智能审查，这可能需要几分钟时间。确认继续吗？',
      onOk: () => triggerAIReviewMutation.mutate(),
    });
  };

  const handleUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file as File);
      await documentReviewApi.uploadAttachment(id!, formData);
      message.success('上传成功');
      queryClient.invalidateQueries({ queryKey: ['documentReview', id] });
      onSuccess?.({});
    } catch (error: any) {
      message.error(error.response?.data?.message || '上传失败');
      onError?.(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: DocumentReviewAttachment) => {
    try {
      const response = await documentReviewApi.downloadAttachment(id!, attachment.id);
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

  const handleCreateAnnotation = () => {
    annotationForm.validateFields().then((values) => {
      createAnnotationMutation.mutate({
        attachmentId: annotationModal.attachment!.id,
        annotationType: values.annotationType,
        content: values.content,
        severity: values.severity,
      });
    });
  };

  const handleAddComment = () => {
    commentForm.validateFields().then((values) => {
      addCommentMutation.mutate({
        annotationId: commentModal.annotationId!,
        content: values.content,
      });
    });
  };

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>;
  }

  if (!review) {
    return <Card><Alert message="审查记录不存在" type="error" /></Card>;
  }

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      DRAFT: 'default', AI_REVIEWING: 'processing', PENDING: 'warning',
      IN_PROGRESS: 'processing', APPROVED: 'success', REJECTED: 'error', CANCELLED: 'default',
    };
    return map[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      DRAFT: '草稿', AI_REVIEWING: 'AI审查中', PENDING: '待审批',
      IN_PROGRESS: '审批中', APPROVED: '已通过', REJECTED: '已驳回', CANCELLED: '已取消',
    };
    return map[status] || status;
  };

  const getDocumentTypeText = (type: string) => {
    const map: Record<string, string> = {
      CONTRACT: '合同', LAWYER_LETTER: '律师函', COLLECTION_LETTER: '催款函',
      AGREEMENT: '协议', NOTICE: '通知', OTHER: '其他',
    };
    return map[type] || type;
  };

  const getAnnotationTypeText = (type: string) => {
    const map: Record<string, string> = {
      RISK: '风险点', KEY_POINT: '关键点', GAP: '漏洞', COMPLIANCE: '合规性', SUGGESTION: '建议',
    };
    return map[type] || type;
  };

  const getAnnotationStatusColor = (status: string) => {
    const map: Record<string, string> = { ACTIVE: 'warning', RESOLVED: 'success', IGNORED: 'default' };
    return map[status] || 'default';
  };

  const getAnnotationStatusText = (status: string) => {
    const map: Record<string, string> = { ACTIVE: '待处理', RESOLVED: '已解决', IGNORED: '已忽略' };
    return map[status] || status;
  };

  const getSeverityColor = (severity?: string) => {
    const map: Record<string, string> = { LOW: 'green', MEDIUM: 'orange', HIGH: 'red', CRITICAL: 'magenta' };
    return map[severity || ''] || 'blue';
  };

  const attachments: DocumentReviewAttachment[] = (review.attachments as any) || [];
  const annotations: ManualReviewAnnotation[] = (review.annotations as any) || [];

  // 按附件分组批注
  const annotationsByAttachment = attachments.reduce((acc, att) => {
    acc[att.id] = annotations.filter((a) => a.attachmentId === att.id);
    return acc;
  }, {} as Record<string, ManualReviewAnnotation[]>);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/document-reviews')}>返回列表</Button>
      </Space>

      <Card
        title={<Space><FileTextOutlined />{review.title}</Space>}
        extra={
          <Space>
            <Tag color={getStatusColor(review.status)}>{getStatusText(review.status)}</Tag>
            {review.aiReviewStatus && (
              <Tag color={review.aiReviewStatus === 'COMPLETED' ? 'success' : 'processing'}>
                AI: {review.aiReviewStatus === 'COMPLETED' ? '已完成' : review.aiReviewStatus === 'PROCESSING' ? '审查中' : '待审查'}
              </Tag>
            )}
          </Space>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="基本信息" key="basic">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="文档类型">{getDocumentTypeText(review.documentType)}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={getStatusColor(review.status)}>{getStatusText(review.status)}</Tag></Descriptions.Item>
              <Descriptions.Item label="发起人">{review.initiator?.name}</Descriptions.Item>
              <Descriptions.Item label="发起部门">{review.department?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="公司">{review.companyCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{new Date(review.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
              <Descriptions.Item label="附件数量">{review._count?.attachments || 0} 个</Descriptions.Item>
              <Descriptions.Item label="批注数量">{review._count?.annotations || 0} 条</Descriptions.Item>
            </Descriptions>
          </Tabs.TabPane>

          <Tabs.TabPane tab={`附件与批注 (${attachments.length})`} key="attachments">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Upload customRequest={handleUpload} showUploadList={false} multiple={false}>
                <Button icon={<UploadOutlined />} loading={uploading}>上传附件</Button>
              </Upload>

              {attachments.length > 0 ? (
                <Collapse accordion>
                  {attachments.map((attachment) => (
                    <Collapse.Panel
                      key={attachment.id}
                      header={
                        <Space
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setPreviewModal({ open: true, attachment });
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <FileTextOutlined />
                          <span>{attachment.fileName}</span>
                          <Tag>{(Number(attachment.fileSize) / 1024 / 1024).toFixed(2)} MB</Tag>
                          <Tag color="blue">{annotationsByAttachment[attachment.id]?.length || 0} 条批注</Tag>
                        </Space>
                      }
                      extra={
                        <Space onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="预览">
                            <Button size="small" icon={<EyeOutlined />} onClick={() => setPreviewModal({ open: true, attachment })} />
                          </Tooltip>
                          <Tooltip title="添加批注">
                            <Button size="small" icon={<PlusOutlined />} onClick={() => { setAnnotationModal({ visible: true, attachment }); }} />
                          </Tooltip>
                          <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(attachment)}>下载</Button>
                          <Popconfirm title="确认删除此附件？" onConfirm={() => deleteAttachmentMutation.mutate(attachment.id)} okText="确认" cancelText="取消">
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      }
                    >
                      {annotationsByAttachment[attachment.id]?.length > 0 ? (
                        <List
                          dataSource={annotationsByAttachment[attachment.id]}
                          renderItem={(annotation) => (
                            <List.Item
                              actions={[
                                <Select
                                  key="status"
                                  size="small"
                                  value={annotation.status}
                                  style={{ width: 90 }}
                                  options={annotationStatusOptions}
                                  onChange={(status) => updateAnnotationMutation.mutate({ annotationId: annotation.id, data: { status } })}
                                />,
                                <Button key="comment" size="small" icon={<CommentOutlined />} onClick={() => setCommentModal({ visible: true, annotationId: annotation.id })}>
                                  {annotation._count?.comments || 0}
                                </Button>,
                                <Popconfirm key="delete" title="确认删除此批注？" onConfirm={() => deleteAnnotationMutation.mutate(annotation.id)} okText="确认" cancelText="取消">
                                  <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>,
                              ]}
                            >
                              <List.Item.Meta
                                avatar={<Avatar icon={<UserOutlined />} src={annotation.annotator?.avatar} />}
                                title={
                                  <Space>
                                    <Tag color={getSeverityColor(annotation.severity)}>{getAnnotationTypeText(annotation.annotationType)}</Tag>
                                    <Tag color={getAnnotationStatusColor(annotation.status)}>{getAnnotationStatusText(annotation.status)}</Tag>
                                    {annotation.severity && <Tag>{severityOptions.find(s => s.value === annotation.severity)?.label || annotation.severity}</Tag>}
                                    <span style={{ fontSize: 12, color: '#999' }}>{annotation.annotator?.name} · {new Date(annotation.createdAt).toLocaleString('zh-CN')}</span>
                                  </Space>
                                }
                                description={
                                  <div>
                                    <div style={{ marginBottom: 8 }}>{annotation.description || annotation.title}</div>
                                    {annotation.comments && annotation.comments.length > 0 && (
                                      <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                                        {annotation.comments.map((comment) => (
                                          <div key={comment.id} style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                                            <span><strong>{comment.user?.name}：</strong>{comment.content}</span>
                                            <Popconfirm title="删除评论？" onConfirm={() => deleteCommentMutation.mutate({ annotationId: annotation.id, commentId: comment.id })} okText="确认" cancelText="取消">
                                              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                            </Popconfirm>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                }
                              />
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Empty description="暂无批注" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Collapse.Panel>
                  ))}
                </Collapse>
              ) : (
                <Alert message="暂无附件" type="info" showIcon />
              )}
            </Space>
          </Tabs.TabPane>

          <Tabs.TabPane tab="AI审查结果" key="ai-review">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {!review.aiReviewStatus || review.aiReviewStatus === 'PENDING' ? (
                <Alert message="尚未进行AI审查" description="点击下方按钮启动AI智能审查" type="info" showIcon
                  action={<Button type="primary" icon={<RobotOutlined />} onClick={handleTriggerAIReview} loading={triggerAIReviewMutation.isPending} disabled={attachments.length === 0}>启动AI审查</Button>}
                />
              ) : review.aiReviewStatus === 'PROCESSING' ? (
                <Alert message="AI审查进行中" description="正在分析文档内容，请稍候..." type="info" showIcon icon={<Spin />}
                  action={<Button icon={<ReloadOutlined />} onClick={() => refetchAIResult()}>刷新</Button>}
                />
              ) : review.aiReviewStatus === 'FAILED' ? (
                <Alert message="AI审查失败" description={aiResult?.error || '审查过程中发生错误'} type="error" showIcon
                  action={<Button type="primary" icon={<RobotOutlined />} onClick={handleTriggerAIReview} loading={triggerAIReviewMutation.isPending}>重新审查</Button>}
                />
              ) : review.aiReviewStatus === 'COMPLETED' && aiResult?.result ? (
                <>
                  <Button icon={<ReloadOutlined />} onClick={handleTriggerAIReview} loading={triggerAIReviewMutation.isPending}>重新审查</Button>
                  <AIReviewResult result={aiResult.result} loading={aiResultLoading} />
                </>
              ) : (
                <Alert message="暂无审查结果" type="warning" />
              )}
            </Space>
          </Tabs.TabPane>
        </Tabs>
      </Card>

      {/* 添加批注弹窗 */}
      <Modal
        title={`添加批注 - ${annotationModal.attachment?.fileName}`}
        open={annotationModal.visible}
        onOk={handleCreateAnnotation}
        onCancel={() => { setAnnotationModal({ visible: false }); annotationForm.resetFields(); }}
        confirmLoading={createAnnotationMutation.isPending}
      >
        <Form form={annotationForm} layout="vertical">
          <Form.Item name="annotationType" label="批注类型" rules={[{ required: true, message: '请选择批注类型' }]}>
            <Select options={annotationTypeOptions} placeholder="选择批注类型" />
          </Form.Item>
          <Form.Item name="severity" label="严重程度">
            <Select options={severityOptions} placeholder="选择严重程度" allowClear />
          </Form.Item>
          <Form.Item name="content" label="批注内容" rules={[{ required: true, message: '请输入批注内容' }]}>
            <TextArea rows={4} placeholder="输入批注内容..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加评论弹窗 */}
      <Modal
        title="添加评论"
        open={commentModal.visible}
        onOk={handleAddComment}
        onCancel={() => { setCommentModal({ visible: false }); commentForm.resetFields(); }}
        confirmLoading={addCommentMutation.isPending}
      >
        <Form form={commentForm} layout="vertical">
          <Form.Item name="content" label="评论内容" rules={[{ required: true, message: '请输入评论内容' }]}>
            <TextArea rows={3} placeholder="输入评论..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* OnlyOffice 预览 */}
      {previewModal.attachment && (
        <AttachmentPreview
          reviewId={id!}
          attachmentId={previewModal.attachment.id}
          fileName={previewModal.attachment.fileName}
          open={previewModal.open}
          onClose={() => setPreviewModal({ open: false })}
        />
      )}
    </div>
  );
};

export default DocumentReviewDetail;
