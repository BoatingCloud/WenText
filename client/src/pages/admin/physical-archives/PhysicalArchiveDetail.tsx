import { useState, useMemo } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  ArrowLeftOutlined,
  EditOutlined,
  HistoryOutlined,
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  physicalArchiveApi,
  systemConfigApi,
  unifiedBorrowApi,
} from '../../../services/api';
import type {
  PhysicalArchive,
  PhysicalArchiveAttachment,
  PhysicalArchiveBorrowRecord,
  ArchiveBorrowMode,
  CompanyCatalogItem,
} from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import {
  statusTagMap,
  workflowTagMap,
  statusLabelMap,
  workflowLabelMap,
} from './constants';

const fmtDate = (v?: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-');
const fmtDatetime = (v?: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-');

type BorrowFormValues = {
  borrower: string;
  borrowedAt?: dayjs.Dayjs;
  dueAt?: dayjs.Dayjs;
  remark?: string;
};

type ReturnFormValues = {
  returnedAt?: dayjs.Dayjs;
  remark?: string;
};

const PhysicalArchiveDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { hasPermission } = useAuthStore();

  const [borrowForm] = Form.useForm<BorrowFormValues>();
  const [returnForm] = Form.useForm<ReturnFormValues>();
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [recordDrawerOpen, setRecordDrawerOpen] = useState(false);
  const [recordPage, setRecordPage] = useState(1);
  const [recordPageSize, setRecordPageSize] = useState(10);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [destroyModalOpen, setDestroyModalOpen] = useState(false);
  const [destroyReason, setDestroyReason] = useState('');

  const canUpdate = hasPermission('archive:update');
  const canApprove = hasPermission('archive:approve');
  const canBorrow = hasPermission('archive:borrow');
  const canReturn = hasPermission('archive:return');
  const canDelete = hasPermission('archive:delete');

  const { data: archiveData, isLoading } = useQuery({
    queryKey: ['physical-archive', id],
    enabled: !!id,
    queryFn: () => physicalArchiveApi.get(id!),
  });

  // 获取借阅模式
  const { data: borrowModeData } = useQuery({
    queryKey: ['borrow-mode'],
    queryFn: () => unifiedBorrowApi.getBorrowMode(),
    staleTime: 5 * 60 * 1000,
  });
  const borrowMode: ArchiveBorrowMode = borrowModeData?.data?.data?.mode || 'direct';

  const { data: settingsData } = useQuery({
    queryKey: ['public-site-config'],
    queryFn: () => systemConfigApi.getPublicTheme(),
    staleTime: 5 * 60 * 1000,
  });
  const companyCatalog: CompanyCatalogItem[] = settingsData?.data?.data?.companyCatalog || [];
  const companyNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    companyCatalog.forEach((c) => { map[c.code] = c.name; });
    return map;
  }, [companyCatalog]);

  const { data: recordsData, isLoading: recordsLoading } = useQuery({
    queryKey: ['physical-archive-records', id, recordPage, recordPageSize],
    enabled: !!id && recordDrawerOpen,
    queryFn: () => physicalArchiveApi.listBorrowRecords(id!, { page: recordPage, pageSize: recordPageSize }),
  });

  const archive: PhysicalArchive | undefined = archiveData?.data?.data;
  const records: PhysicalArchiveBorrowRecord[] = recordsData?.data?.data || [];
  const recordTotal = recordsData?.data?.pagination?.total || 0;

  // 附件管理
  const { data: attachmentsData, refetch: refetchAttachments } = useQuery({
    queryKey: ['archive-attachments', id],
    enabled: !!id,
    queryFn: () => physicalArchiveApi.listAttachments(id!),
  });
  const attachments: PhysicalArchiveAttachment[] = attachmentsData?.data?.data || [];

  const uploadAttachmentMutation = useMutation({
    mutationFn: (formData: FormData) => physicalArchiveApi.uploadAttachments(id!, formData),
    onSuccess: () => {
      refetchAttachments();
      message.success('附件上传成功');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || '附件上传失败');
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => physicalArchiveApi.deleteAttachment(id!, attachmentId),
    onSuccess: () => {
      refetchAttachments();
      message.success('附件删除成功');
    },
  });

  const handleAttachmentUpload = (options: any) => {
    const { file, onSuccess } = options;
    const formData = new FormData();
    formData.append('files', file);
    uploadAttachmentMutation.mutate(formData, {
      onSuccess: () => onSuccess?.('ok'),
    });
  };

  const handleAttachmentDownload = async (attachment: PhysicalArchiveAttachment) => {
    try {
      const response = await physicalArchiveApi.downloadAttachment(id!, attachment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('下载失败');
    }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['physical-archive', id] });
    queryClient.invalidateQueries({ queryKey: ['physical-archives'] });
  };

  const actionMutation = useMutation({
    mutationFn: ({ action, payload }: { action: string; payload?: Record<string, unknown> }) => {
      const actions: Record<string, () => any> = {
        'submit-review': () => physicalArchiveApi.submitReview(id!, payload?.comment as string | undefined),
        'approve-archive': () => physicalArchiveApi.approveArchive(id!, payload?.reviewComment as string | undefined),
        'reject-review': () => physicalArchiveApi.rejectReview(id!, payload?.reviewComment as string),
        'mark-modified': () => physicalArchiveApi.markModified(id!, payload?.reason as string | undefined),
        'destroy': () => physicalArchiveApi.destroy(id!, payload?.destroyReason as string),
      };
      return actions[action]();
    },
    onSuccess: invalidate,
  });

  // 统一借阅 mutation（自动根据配置路由）
  const borrowMutation = useMutation({
    mutationFn: (values: BorrowFormValues) =>
      unifiedBorrowApi.borrow(id!, {
        borrower: values.borrower,
        borrowedAt: values.borrowedAt?.toISOString(),
        dueAt: values.dueAt?.toISOString(),
        remark: values.remark,
      }),
    onSuccess: (response) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['physical-archive-records'] });
      setBorrowModalOpen(false);
      borrowForm.resetFields();
      message.success(response.data.message || '操作成功');
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || '操作失败');
    },
  });

  // 统一归还 mutation
  const returnMutation = useMutation({
    mutationFn: (values: ReturnFormValues) =>
      unifiedBorrowApi.return(id!, {
        returnedAt: values.returnedAt?.toISOString(),
        remark: values.remark,
      }),
    onSuccess: (response) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['physical-archive-records'] });
      setReturnModalOpen(false);
      returnForm.resetFields();
      message.success(response.data.message || '归还成功');
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || '归还失败');
    },
  });

  const borrowRecordColumns: ColumnsType<PhysicalArchiveBorrowRecord> = [
    {
      title: '动作', dataIndex: 'action', key: 'action', width: 90,
      render: (v: string) => v === 'BORROW' ? <Tag color="orange">借阅</Tag> : <Tag color="green">归还</Tag>,
    },
    { title: '借阅人', dataIndex: 'borrower', key: 'borrower', width: 130 },
    { title: '借出时间', dataIndex: 'borrowedAt', key: 'borrowedAt', width: 160, render: fmtDatetime },
    { title: '归还时间', dataIndex: 'returnedAt', key: 'returnedAt', width: 160, render: fmtDatetime },
    {
      title: '经办人', dataIndex: ['operator', 'name'], key: 'operator', width: 120,
      render: (_: unknown, record) => record.operator?.name || '-',
    },
    { title: '备注', dataIndex: 'remark', key: 'remark' },
  ];

  if (isLoading) {
    return <Card loading />;
  }

  if (!archive) {
    return (
      <Card>
        <Typography.Text type="danger">档案不存在或已被删除</Typography.Text>
        <Button type="link" onClick={() => navigate('/admin/physical-archives')}>返回列表</Button>
      </Card>
    );
  }

  const ws = archive.workflowStatus;
  const st = archive.status;

  return (
    <>
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/admin/physical-archives')} />
            <span>档案详情</span>
            <Tag color={workflowTagMap[ws || ''] || 'default'}>{workflowLabelMap[ws || ''] || ws}</Tag>
            <Tag color={statusTagMap[st] || 'default'}>{statusLabelMap[st] || st}</Tag>
          </Space>
        }
        extra={
          <Space wrap>
            {/* 工作流操作按钮 */}
            {canUpdate && ws === 'DRAFT' && (
              <Popconfirm title="确定提交审核？" onConfirm={async () => {
                await actionMutation.mutateAsync({ action: 'submit-review' });
                message.success('已提交审核');
              }}>
                <Button>提交审核</Button>
              </Popconfirm>
            )}
            {canApprove && ws === 'PENDING_REVIEW' && (
              <Popconfirm title="确定审核通过并归档？" onConfirm={async () => {
                await actionMutation.mutateAsync({ action: 'approve-archive' });
                message.success('审核通过，已归档');
              }}>
                <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }}>通过</Button>
              </Popconfirm>
            )}
            {canApprove && ws === 'PENDING_REVIEW' && (
              <Button danger onClick={() => { setRejectComment(''); setRejectModalOpen(true); }}>驳回</Button>
            )}
            {canUpdate && ws === 'ARCHIVED' && (
              <Popconfirm title="确定标记为修改状态？" onConfirm={async () => {
                await actionMutation.mutateAsync({ action: 'mark-modified' });
                message.success('已标记为修改状态');
              }}>
                <Button>标记修改</Button>
              </Popconfirm>
            )}
            {canBorrow && st === 'IN_STOCK' && (ws === 'ARCHIVED' || ws === 'RETURNED') && borrowMode === 'direct' && (
              <Button onClick={() => {
                borrowForm.setFieldsValue({ borrower: '', borrowedAt: dayjs() });
                setBorrowModalOpen(true);
              }}>借阅</Button>
            )}
            {canBorrow && st === 'IN_STOCK' && (ws === 'ARCHIVED' || ws === 'RETURNED') && borrowMode === 'workflow' && (
              <Button type="primary" onClick={() => {
                borrowForm.setFieldsValue({ borrower: '', borrowedAt: dayjs() });
                setBorrowModalOpen(true);
              }}>申请借阅</Button>
            )}
            {canReturn && st === 'BORROWED' && (
              <Button onClick={() => {
                returnForm.setFieldsValue({ returnedAt: dayjs(), remark: '' });
                setReturnModalOpen(true);
              }}>归还</Button>
            )}
            {canDelete && ws !== 'DESTROYED' && (
              <Button danger onClick={() => { setDestroyReason(''); setDestroyModalOpen(true); }}>销毁</Button>
            )}
            <Button
              icon={<HistoryOutlined />}
              onClick={() => { setRecordPage(1); setRecordDrawerOpen(true); }}
            >
              借阅记录
            </Button>
            {canUpdate && (
              <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/admin/physical-archives/${id}/edit`)}>
                编辑
              </Button>
            )}
          </Space>
        }
      >
        {/* 基础信息 */}
        <Descriptions title="基础信息" column={3} bordered size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="档案编号">{archive.archiveNo}</Descriptions.Item>
          <Descriptions.Item label="档案代码">{archive.archiveCode || '-'}</Descriptions.Item>
          <Descriptions.Item label="题名">{archive.title}</Descriptions.Item>
          <Descriptions.Item label="副题名">{archive.subtitle || '-'}</Descriptions.Item>
          <Descriptions.Item label="分类名称">{archive.categoryName || '-'}</Descriptions.Item>
          <Descriptions.Item label="分类路径">{archive.categoryPath || '-'}</Descriptions.Item>
          <Descriptions.Item label="全宗名称">{archive.fondsName || '-'}</Descriptions.Item>
          <Descriptions.Item label="全宗代码">{archive.fondsCode || '-'}</Descriptions.Item>
          <Descriptions.Item label="年度">{archive.year || '-'}</Descriptions.Item>
          <Descriptions.Item label="语种">{archive.language || '-'}</Descriptions.Item>
          <Descriptions.Item label="载体类型">{archive.carrierType || '-'}</Descriptions.Item>
          <Descriptions.Item label="档案形态">{archive.archiveForm || '-'}</Descriptions.Item>
          <Descriptions.Item label="所属公司">{archive.companyCode ? (companyNameMap[archive.companyCode] || archive.companyCode) : '-'}</Descriptions.Item>
        </Descriptions>

        {/* 业务信息 */}
        <Descriptions title="业务信息" column={3} bordered size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="文件编号">{archive.fileNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="文件类型">{archive.fileType || '-'}</Descriptions.Item>
          <Descriptions.Item label="责任者">{archive.responsibleParty || '-'}</Descriptions.Item>
          <Descriptions.Item label="责任者代码">{archive.responsibleCode || '-'}</Descriptions.Item>
          <Descriptions.Item label="形成日期">{fmtDate(archive.formedAt)}</Descriptions.Item>
          <Descriptions.Item label="归档日期">{fmtDate(archive.filingDate)}</Descriptions.Item>
          <Descriptions.Item label="生效日期">{fmtDate(archive.effectiveDate)}</Descriptions.Item>
          <Descriptions.Item label="失效日期">{fmtDate(archive.invalidDate)}</Descriptions.Item>
          <Descriptions.Item label="份数">{archive.copies}</Descriptions.Item>
          <Descriptions.Item label="页数">{archive.pages ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="附件数">{archive.attachmentCount ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="文种">{archive.documentGenre || '-'}</Descriptions.Item>
          <Descriptions.Item label="紧急程度">{archive.urgencyLevel || '-'}</Descriptions.Item>
          <Descriptions.Item label="主题词">{archive.subjectTerms || '-'}</Descriptions.Item>
          <Descriptions.Item label="内容摘要" span={3}>{archive.summary || '-'}</Descriptions.Item>
          <Descriptions.Item label="关键词" span={3}>
            {archive.keywords?.length ? archive.keywords.map((k) => <Tag key={k}>{k}</Tag>) : '-'}
          </Descriptions.Item>
        </Descriptions>

        {/* 管理信息 */}
        <Descriptions title="管理信息" column={3} bordered size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="保管期限">{archive.retentionPeriod || '-'}</Descriptions.Item>
          <Descriptions.Item label="密级">{archive.securityLevel || '-'}</Descriptions.Item>
          <Descriptions.Item label="到期日期">{fmtDate(archive.expiresAt)}</Descriptions.Item>
          <Descriptions.Item label="库位">{archive.shelfLocation}</Descriptions.Item>
          <Descriptions.Item label="存放位置">{archive.storageLocation || '-'}</Descriptions.Item>
          <Descriptions.Item label="排架号">{archive.shelfNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="盒号">{archive.boxNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="卷号">{archive.volumeNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="件号">{archive.itemNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="归档单位">{archive.filingDepartment || '-'}</Descriptions.Item>
          <Descriptions.Item label="责任单位">{archive.responsibleUnit || '-'}</Descriptions.Item>
          <Descriptions.Item label="所属类别">{archive.belongCategory || '-'}</Descriptions.Item>
          <Descriptions.Item label="移交部门">{archive.transferDepartment || '-'}</Descriptions.Item>
          <Descriptions.Item label="移交人">{archive.transferPerson || '-'}</Descriptions.Item>
          <Descriptions.Item label="移交日期">{fmtDate(archive.transferDate)}</Descriptions.Item>
          <Descriptions.Item label="接收人">{archive.receiver || '-'}</Descriptions.Item>
          <Descriptions.Item label="接收日期">{fmtDate(archive.receiveDate)}</Descriptions.Item>
          <Descriptions.Item label="控制标识">{archive.controlMark || '-'}</Descriptions.Item>
          <Descriptions.Item label="鉴定状态">{archive.appraisalStatus || '-'}</Descriptions.Item>
          <Descriptions.Item label="鉴定人">{archive.appraiser || '-'}</Descriptions.Item>
          <Descriptions.Item label="鉴定日期">{fmtDate(archive.appraisalDate)}</Descriptions.Item>
        </Descriptions>

        {/* 借阅信息 */}
        <Descriptions title="借阅信息" column={3} bordered size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="借阅人">{archive.borrower || '-'}</Descriptions.Item>
          <Descriptions.Item label="借出时间">{fmtDatetime(archive.borrowedAt)}</Descriptions.Item>
          <Descriptions.Item label="借阅备注">{archive.borrowRemark || '-'}</Descriptions.Item>
        </Descriptions>

        {/* 电子文件 */}
        <Descriptions title="电子文件信息" column={3} bordered size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="电子文件ID">{archive.electronicFileId || '-'}</Descriptions.Item>
          <Descriptions.Item label="原始文件名">{archive.originalFileName || '-'}</Descriptions.Item>
          <Descriptions.Item label="文件格式">{archive.fileExtension || '-'}</Descriptions.Item>
          <Descriptions.Item label="文件大小">{archive.fileSizeBytes ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="存储路径">{archive.fileStoragePath || '-'}</Descriptions.Item>
          <Descriptions.Item label="存储方式">{archive.storageMethod || '-'}</Descriptions.Item>
          <Descriptions.Item label="MD5">{archive.fileMd5 || '-'}</Descriptions.Item>
          <Descriptions.Item label="转存状态">{archive.transferStatus || '-'}</Descriptions.Item>
          <Descriptions.Item label="数字化状态">{archive.digitizationStatus || '-'}</Descriptions.Item>
        </Descriptions>

        {/* 附件列表 */}
        <Card
          type="inner"
          title={`附件管理 (${attachments.length})`}
          size="small"
          style={{ marginBottom: 24 }}
          extra={
            canUpdate ? (
              <Upload customRequest={handleAttachmentUpload} showUploadList={false} multiple>
                <Button size="small" icon={<UploadOutlined />} loading={uploadAttachmentMutation.isPending}>
                  上传附件
                </Button>
              </Upload>
            ) : null
          }
        >
          {attachments.length > 0 ? (
            <Table
              rowKey="id"
              dataSource={attachments}
              size="small"
              pagination={false}
              columns={[
                { title: '文件名', dataIndex: 'fileName', key: 'fileName', ellipsis: true },
                {
                  title: '大小', dataIndex: 'fileSize', key: 'fileSize', width: 100,
                  render: (v: string) => {
                    const bytes = Number(v);
                    if (bytes < 1024) return `${bytes} B`;
                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
                  },
                },
                {
                  title: '上传人', dataIndex: ['uploader', 'name'], key: 'uploader', width: 100,
                },
                {
                  title: '上传时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
                  render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
                },
                {
                  title: '操作', key: 'actions', width: 140,
                  render: (_: unknown, record: PhysicalArchiveAttachment) => (
                    <Space>
                      <Button size="small" icon={<DownloadOutlined />} onClick={() => handleAttachmentDownload(record)}>
                        下载
                      </Button>
                      {canUpdate && (
                        <Popconfirm title="确定删除此附件？" onConfirm={() => deleteAttachmentMutation.mutate(record.id)}>
                          <Button size="small" icon={<DeleteOutlined />} danger>删除</Button>
                        </Popconfirm>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          ) : (
            <div style={{ color: '#999', textAlign: 'center', padding: '16px 0' }}>暂无附件</div>
          )}
        </Card>

        {/* 版本信息 */}
        <Descriptions title="版本信息" column={3} bordered size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="版本号">{archive.versionNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="版次">{archive.revisionNo ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="版本状态">{archive.versionStatus || '-'}</Descriptions.Item>
          <Descriptions.Item label="生效版本">{archive.isCurrentVersion ? '是' : '否'}</Descriptions.Item>
          <Descriptions.Item label="版本说明">{archive.versionRemark || '-'}</Descriptions.Item>
          <Descriptions.Item label="原版本号">{archive.previousVersionNo || '-'}</Descriptions.Item>
        </Descriptions>

        {/* 关联信息 */}
        <Descriptions title="关联信息" column={3} bordered size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="父档案ID">{archive.parentArchiveId || '-'}</Descriptions.Item>
          <Descriptions.Item label="根档案ID">{archive.rootArchiveId || '-'}</Descriptions.Item>
          <Descriptions.Item label="前置档案">{archive.predecessorArchiveId || '-'}</Descriptions.Item>
          <Descriptions.Item label="后置档案">{archive.successorArchiveId || '-'}</Descriptions.Item>
          <Descriptions.Item label="替代档案">{archive.replacedArchiveId || '-'}</Descriptions.Item>
          <Descriptions.Item label="复制来源">{archive.copiedFromArchiveId || '-'}</Descriptions.Item>
          <Descriptions.Item label="关联档案" span={3}>
            {archive.relatedArchiveIds?.length ? archive.relatedArchiveIds.join(', ') : '-'}
          </Descriptions.Item>
        </Descriptions>

        {/* 权限安全 */}
        <Descriptions title="权限安全" column={3} bordered size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="所有者">{archive.ownerName || '-'}</Descriptions.Item>
          <Descriptions.Item label="所有者部门">{archive.ownerDepartment || '-'}</Descriptions.Item>
          <Descriptions.Item label="权限级别">{archive.accessLevel || '-'}</Descriptions.Item>
          <Descriptions.Item label="加密状态">{archive.encryptionStatus || '-'}</Descriptions.Item>
          <Descriptions.Item label="加密算法">{archive.encryptionAlgorithm || '-'}</Descriptions.Item>
          <Descriptions.Item label="访问策略">{archive.accessPolicy || '-'}</Descriptions.Item>
        </Descriptions>

        {/* 审计信息 */}
        <Descriptions title="审计信息" column={3} bordered size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="创建人">{archive.creator?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{fmtDatetime(archive.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{fmtDatetime(archive.updatedAt)}</Descriptions.Item>
          <Descriptions.Item label="创建人部门">{archive.creatorDepartment || '-'}</Descriptions.Item>
          <Descriptions.Item label="审核人">{archive.reviewer || '-'}</Descriptions.Item>
          <Descriptions.Item label="审核时间">{fmtDatetime(archive.reviewedAt)}</Descriptions.Item>
          <Descriptions.Item label="审核意见" span={3}>{archive.reviewComment || '-'}</Descriptions.Item>
          <Descriptions.Item label="归档人">{archive.filer || '-'}</Descriptions.Item>
          <Descriptions.Item label="归档时间">{fmtDatetime(archive.filedAt)}</Descriptions.Item>
          <Descriptions.Item label="最后访问人">{archive.lastAccessedBy || '-'}</Descriptions.Item>
          <Descriptions.Item label="销毁人">{archive.destroyer || '-'}</Descriptions.Item>
          <Descriptions.Item label="销毁时间">{fmtDatetime(archive.destroyedAt)}</Descriptions.Item>
          <Descriptions.Item label="销毁原因">{archive.destroyReason || '-'}</Descriptions.Item>
        </Descriptions>

        {/* 扩展信息 */}
        <Descriptions title="扩展信息" column={3} bordered size="small">
          <Descriptions.Item label="标签" span={3}>
            {archive.tags?.length ? archive.tags.map((t) => <Tag key={t}>{t}</Tag>) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="自定义文本1">{archive.customText1 || '-'}</Descriptions.Item>
          <Descriptions.Item label="自定义文本2">{archive.customText2 || '-'}</Descriptions.Item>
          <Descriptions.Item label="自定义文本3">{archive.customText3 || '-'}</Descriptions.Item>
          <Descriptions.Item label="自定义数值">{archive.customNumber ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="自定义日期">{fmtDate(archive.customDate)}</Descriptions.Item>
          <Descriptions.Item label="备注">{archive.remark || '-'}</Descriptions.Item>
          <Descriptions.Item label="扩展JSON" span={3}>
            {archive.extraJson ? <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(archive.extraJson, null, 2)}</pre> : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 驳回 Modal */}
      <Modal
        title="驳回审核"
        open={rejectModalOpen}
        onCancel={() => setRejectModalOpen(false)}
        onOk={async () => {
          if (!rejectComment.trim()) { message.warning('请输入驳回原因'); return; }
          await actionMutation.mutateAsync({ action: 'reject-review', payload: { reviewComment: rejectComment } });
          message.success('已驳回至草稿');
          setRejectModalOpen(false);
        }}
        confirmLoading={actionMutation.isPending}
      >
        <Input.TextArea
          rows={3}
          placeholder="请输入驳回原因"
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
        />
      </Modal>

      {/* 销毁 Modal */}
      <Modal
        title="销毁档案"
        open={destroyModalOpen}
        onCancel={() => setDestroyModalOpen(false)}
        onOk={async () => {
          if (!destroyReason.trim()) { message.warning('请输入销毁原因'); return; }
          await actionMutation.mutateAsync({ action: 'destroy', payload: { destroyReason } });
          message.success('档案已销毁');
          setDestroyModalOpen(false);
        }}
        confirmLoading={actionMutation.isPending}
      >
        <Input.TextArea
          rows={3}
          placeholder="请输入销毁原因"
          value={destroyReason}
          onChange={(e) => setDestroyReason(e.target.value)}
        />
      </Modal>

      {/* 借阅 Modal */}
      <Modal
        title={`${borrowMode === 'workflow' ? '申请借阅' : '借阅登记'} - ${archive.archiveNo}`}
        open={borrowModalOpen}
        onCancel={() => { setBorrowModalOpen(false); borrowForm.resetFields(); }}
        onOk={async () => {
          const values = await borrowForm.validateFields();
          await borrowMutation.mutateAsync(values);
        }}
        confirmLoading={borrowMutation.isPending}
      >
        <Form form={borrowForm} layout="vertical">
          <Form.Item label="借阅人" name="borrower" rules={[{ required: true, message: '请输入借阅人' }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="借出时间" name="borrowedAt">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="应还时间" name="dueAt">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="借阅说明" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 归还 Modal */}
      <Modal
        title={`归还登记 - ${archive.archiveNo}`}
        open={returnModalOpen}
        onCancel={() => { setReturnModalOpen(false); returnForm.resetFields(); }}
        onOk={async () => {
          const values = await returnForm.validateFields();
          await returnMutation.mutateAsync(values);
        }}
        confirmLoading={returnMutation.isPending}
      >
        <Form form={returnForm} layout="vertical">
          <Form.Item label="归还时间" name="returnedAt">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="归还备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 借阅记录 Drawer */}
      <Drawer
        title={`借阅记录 - ${archive.archiveNo}`}
        placement="right"
        width={760}
        open={recordDrawerOpen}
        onClose={() => { setRecordDrawerOpen(false); setRecordPage(1); }}
      >
        <Table
          rowKey="id"
          columns={borrowRecordColumns}
          dataSource={records}
          loading={recordsLoading}
          pagination={{
            current: recordPage,
            pageSize: recordPageSize,
            total: recordTotal,
            onChange: (p, ps) => { setRecordPage(p); setRecordPageSize(ps); },
          }}
        />
      </Drawer>
    </>
  );
};

export default PhysicalArchiveDetail;
