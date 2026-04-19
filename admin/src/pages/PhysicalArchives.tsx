import { useEffect, useMemo, useState } from 'react';
import {
  App,
  AutoComplete,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, HistoryOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  physicalArchiveApi,
  PhysicalArchive,
  PhysicalArchiveStatus,
  PhysicalArchiveBorrowRecord,
  ArchiveWorkflowStatus,
  ArchiveVersionStatus,
  FondsCatalogItem,
  systemConfigApi,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';

const statusOptions: { label: string; value: PhysicalArchiveStatus; color: string }[] = [
  { label: '在库', value: 'IN_STOCK', color: 'green' },
  { label: '借阅中', value: 'BORROWED', color: 'orange' },
  { label: '遗失', value: 'LOST', color: 'red' },
  { label: '销毁', value: 'DESTROYED', color: 'default' },
];

const workflowOptions: { label: string; value: ArchiveWorkflowStatus; color: string }[] = [
  { label: '草稿', value: 'DRAFT', color: 'default' },
  { label: '待审核', value: 'PENDING_REVIEW', color: 'gold' },
  { label: '已归档', value: 'ARCHIVED', color: 'green' },
  { label: '已修改', value: 'MODIFIED', color: 'blue' },
  { label: '已借出', value: 'BORROWED', color: 'orange' },
  { label: '已归还', value: 'RETURNED', color: 'cyan' },
  { label: '已销毁', value: 'DESTROYED', color: 'red' },
];

const versionStatusOptions: { label: string; value: ArchiveVersionStatus }[] = [
  { label: '草稿', value: 'DRAFT' },
  { label: '定稿', value: 'FINAL' },
  { label: '废止', value: 'ABOLISHED' },
];

const retentionOptions = ['永久', '30年', '10年', '5年'];
const securityOptions = ['绝密', '机密', '秘密', '内部公开'];
const fileTypeOptions = ['通知', '报告', '合同', '会议纪要', '往来函件', '台账'];
const archiveFormOptions = ['原件', '副本', '复印件'];
const carrierTypeOptions = ['纸质', '电子文件', '胶片', '照片', '音视频'];
const accessLevelOptions = ['公开', '内部', '保密'];
const appraisalStatusOptions = ['已鉴定', '待鉴定'];
const digitizationStatusOptions = ['已扫描', '待扫描'];
const transferStatusOptions = ['已转存', '待转存'];

const DEFAULT_FONDS_OPTIONS: FondsCatalogItem[] = [
  { name: '深圳文雨', code: 'SZ' },
  { name: '文雨集团', code: 'WY' },
  { name: '总部综合档案', code: 'HQ' },
];

type ArchiveFormValues = Omit<
  Partial<PhysicalArchive>,
  | 'title'
  | 'archiveNo'
  | 'categoryName'
  | 'fondsName'
  | 'fondsCode'
  | 'year'
  | 'shelfLocation'
  | 'formedAt'
  | 'expiresAt'
  | 'borrowedAt'
  | 'filingDate'
  | 'effectiveDate'
  | 'invalidDate'
  | 'transferDate'
  | 'receiveDate'
  | 'appraisalDate'
  | 'reviewedAt'
  | 'filedAt'
  | 'destroyedAt'
  | 'lastAccessedAt'
  | 'customDate'
  | 'extraJson'
> & {
  title?: string;
  archiveNo?: string;
  categoryName?: string;
  fondsName?: string;
  fondsCode?: string;
  year?: number;
  shelfLocation?: string;
  formedAt?: dayjs.Dayjs;
  expiresAt?: dayjs.Dayjs;
  borrowedAt?: dayjs.Dayjs;
  filingDate?: dayjs.Dayjs;
  effectiveDate?: dayjs.Dayjs;
  invalidDate?: dayjs.Dayjs;
  transferDate?: dayjs.Dayjs;
  receiveDate?: dayjs.Dayjs;
  appraisalDate?: dayjs.Dayjs;
  reviewedAt?: dayjs.Dayjs;
  filedAt?: dayjs.Dayjs;
  destroyedAt?: dayjs.Dayjs;
  lastAccessedAt?: dayjs.Dayjs;
  customDate?: dayjs.Dayjs;
  extraJson?: Record<string, any>;
  extraJsonText?: string;
};

type BorrowFormValues = {
  borrower: string;
  borrowedAt?: dayjs.Dayjs;
  dueAt?: dayjs.Dayjs;
  borrowRemark?: string;
};

type ReturnFormValues = {
  returnedAt?: dayjs.Dayjs;
  returnRemark?: string;
};

const extractRetentionYears = (value?: string): number | null => {
  if (!value) return null;
  if (value.includes('永久')) return null;
  const matched = value.match(/(\d+)/);
  if (!matched) return null;
  return Number(matched[1]);
};

const pickFields = <T extends object>(source: T, keys: Array<keyof T>): Partial<T> => {
  const result: Partial<T> = {};
  keys.forEach((key) => {
    if (source[key] !== undefined) {
      result[key] = source[key];
    }
  });
  return result;
};

const toFormDate = (value?: string) => (value ? dayjs(value) : undefined);
const toIso = (value?: dayjs.Dayjs | null) => (value ? value.toISOString() : undefined);

const toFormValues = (record: PhysicalArchive): ArchiveFormValues => ({
  ...record,
  formedAt: toFormDate(record.formedAt),
  expiresAt: toFormDate(record.expiresAt),
  borrowedAt: toFormDate(record.borrowedAt),
  filingDate: toFormDate(record.filingDate),
  effectiveDate: toFormDate(record.effectiveDate),
  invalidDate: toFormDate(record.invalidDate),
  transferDate: toFormDate(record.transferDate),
  receiveDate: toFormDate(record.receiveDate),
  appraisalDate: toFormDate(record.appraisalDate),
  reviewedAt: toFormDate(record.reviewedAt),
  filedAt: toFormDate(record.filedAt),
  destroyedAt: toFormDate(record.destroyedAt),
  lastAccessedAt: toFormDate(record.lastAccessedAt),
  customDate: toFormDate(record.customDate),
  extraJsonText: record.extraJson ? JSON.stringify(record.extraJson, null, 2) : undefined,
});

const PhysicalArchives: React.FC = () => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { user, hasPermission } = useAuthStore();

  const [form] = Form.useForm<ArchiveFormValues>();
  const [borrowForm] = Form.useForm<BorrowFormValues>();
  const [returnForm] = Form.useForm<ReturnFormValues>();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PhysicalArchiveStatus | undefined>(undefined);
  const [workflowStatus, setWorkflowStatus] = useState<ArchiveWorkflowStatus | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PhysicalArchive | null>(null);
  const [continuousEntry, setContinuousEntry] = useState(true);

  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [recordDrawerOpen, setRecordDrawerOpen] = useState(false);
  const [activeArchive, setActiveArchive] = useState<PhysicalArchive | null>(null);
  const [recordPage, setRecordPage] = useState(1);
  const [recordPageSize, setRecordPageSize] = useState(10);

  const watchedFormedAt = Form.useWatch('formedAt', form);
  const watchedRetention = Form.useWatch('retentionPeriod', form);
  const watchedCategoryName = Form.useWatch('categoryName', form);

  useEffect(() => {
    const years = extractRetentionYears(watchedRetention);
    if (!watchedFormedAt || !years) {
      return;
    }

    const currentExpires = form.getFieldValue('expiresAt');
    const nextExpires = watchedFormedAt.add(years, 'year');
    if (!currentExpires || !dayjs(currentExpires).isSame(nextExpires, 'day')) {
      form.setFieldValue('expiresAt', nextExpires);
    }
  }, [form, watchedFormedAt, watchedRetention]);

  useEffect(() => {
    const currentType = form.getFieldValue('fileType');
    if (currentType || !watchedCategoryName) {
      return;
    }

    if (watchedCategoryName.includes('合同')) {
      form.setFieldValue('fileType', '合同');
    } else if (watchedCategoryName.includes('收发文') || watchedCategoryName.includes('行政')) {
      form.setFieldValue('fileType', '通知');
    }
  }, [form, watchedCategoryName]);

  const canCreate = hasPermission('archive:create');
  const canUpdate = hasPermission('archive:update');
  const canDelete = hasPermission('archive:delete');
  const canApprove = hasPermission('archive:approve');
  const canBorrow = hasPermission('archive:borrow');
  const canReturn = hasPermission('archive:return');

  const { data, isLoading } = useQuery({
    queryKey: ['physical-archives', page, pageSize, search, status, workflowStatus],
    queryFn: () =>
      physicalArchiveApi.list({
        page,
        pageSize,
        search: search.trim() || undefined,
        status,
        workflowStatus,
      }),
  });

  const { data: publicSiteConfig } = useQuery({
    queryKey: ['public-site-config-fonds'],
    queryFn: () => systemConfigApi.getPublicTheme(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: recordsData,
    isLoading: recordsLoading,
  } = useQuery({
    queryKey: ['physical-archive-records', activeArchive?.id, recordPage, recordPageSize],
    enabled: !!activeArchive?.id && recordDrawerOpen,
    queryFn: () =>
      physicalArchiveApi.listBorrowRecords(activeArchive!.id, {
        page: recordPage,
        pageSize: recordPageSize,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (values: Partial<PhysicalArchive>) => physicalArchiveApi.create(values),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<PhysicalArchive> }) =>
      physicalArchiveApi.update(id, values),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => physicalArchiveApi.delete(id),
  });

  const borrowMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: BorrowFormValues }) =>
      physicalArchiveApi.borrow(id, {
        borrower: values.borrower,
        borrowedAt: values.borrowedAt?.toISOString(),
        dueAt: values.dueAt?.toISOString(),
        borrowRemark: values.borrowRemark,
      }),
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ReturnFormValues }) =>
      physicalArchiveApi.returnArchive(id, {
        returnedAt: values.returnedAt?.toISOString(),
        returnRemark: values.returnRemark,
      }),
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, id, payload }: { action: string; id: string; payload?: Record<string, unknown> }) => {
      const actions: Record<string, (id: string, ...args: any[]) => any> = {
        'submit-review': (id: string) => physicalArchiveApi.submitReview(id, payload?.comment as string | undefined),
        'approve-archive': (id: string) => physicalArchiveApi.approveArchive(id, payload?.reviewComment as string | undefined),
        'reject-review': (id: string) => physicalArchiveApi.rejectReview(id, payload?.reviewComment as string),
        'mark-modified': (id: string) => physicalArchiveApi.markModified(id, payload?.reason as string | undefined),
        'destroy': (id: string) => physicalArchiveApi.destroy(id, payload?.destroyReason as string),
      };
      return actions[action](id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physical-archives'] });
    },
  });

  const archives = data?.data.data || [];
  const total = data?.data.pagination?.total || 0;
  const records: PhysicalArchiveBorrowRecord[] = recordsData?.data.data || [];
  const recordTotal = recordsData?.data.pagination?.total || 0;
  const fondsOptions = useMemo(() => {
    const configured = publicSiteConfig?.data?.data?.fondsCatalog;
    if (Array.isArray(configured) && configured.length > 0) {
      return configured;
    }
    return DEFAULT_FONDS_OPTIONS;
  }, [publicSiteConfig]);

  const statusTag = useMemo(
    () =>
      Object.fromEntries(statusOptions.map((item) => [item.value, <Tag key={item.value} color={item.color}>{item.label}</Tag>])),
    []
  );

  const workflowTag = useMemo(
    () =>
      Object.fromEntries(workflowOptions.map((item) => [item.value, <Tag key={item.value} color={item.color}>{item.label}</Tag>])),
    []
  );

  const columns: ColumnsType<PhysicalArchive> = [
    { title: '档案编号', dataIndex: 'archiveNo', key: 'archiveNo', width: 170 },
    { title: '档案代码', dataIndex: 'archiveCode', key: 'archiveCode', width: 170 },
    { title: '题名', dataIndex: 'title', key: 'title', width: 220 },
    { title: '分类路径', dataIndex: 'categoryPath', key: 'categoryPath', width: 220 },
    { title: '全宗', dataIndex: 'fondsName', key: 'fondsName', width: 120 },
    { title: '年度', dataIndex: 'year', key: 'year', width: 90 },
    { title: '文件编号', dataIndex: 'fileNo', key: 'fileNo', width: 170 },
    { title: '保管位置', dataIndex: 'shelfLocation', key: 'shelfLocation', width: 140 },
    {
      title: '工作流状态',
      dataIndex: 'workflowStatus',
      key: 'workflowStatus',
      width: 130,
      render: (value: ArchiveWorkflowStatus) => workflowTag[value] || <Tag>{value}</Tag>,
    },
    {
      title: '库存状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value: PhysicalArchiveStatus) => statusTag[value] || <Tag>{value}</Tag>,
    },
    { title: '借阅人', dataIndex: 'borrower', key: 'borrower', width: 120 },
    {
      title: '操作',
      key: 'actions',
      width: 400,
      fixed: 'right',
      render: (_value, record) => (
        <Space wrap>
          {canUpdate && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(record);
                form.setFieldsValue(toFormValues(record));
                setModalOpen(true);
              }}
            >
              编辑
            </Button>
          )}
          {canUpdate && record.workflowStatus === 'DRAFT' && (
            <Popconfirm
              title="确定提交审核？"
              onConfirm={async () => {
                await actionMutation.mutateAsync({ action: 'submit-review', id: record.id });
                message.success('已提交审核');
              }}
            >
              <Button size="small" type="link">提交审核</Button>
            </Popconfirm>
          )}
          {canApprove && record.workflowStatus === 'PENDING_REVIEW' && (
            <Popconfirm
              title="确定审核通过并归档？"
              onConfirm={async () => {
                await actionMutation.mutateAsync({ action: 'approve-archive', id: record.id });
                message.success('审核通过，已归档');
              }}
            >
              <Button size="small" type="link" style={{ color: '#52c41a' }}>通过</Button>
            </Popconfirm>
          )}
          {canApprove && record.workflowStatus === 'PENDING_REVIEW' && (
            <Popconfirm
              title="确定驳回？"
              description="将驳回至草稿状态"
              onConfirm={async () => {
                await actionMutation.mutateAsync({ action: 'reject-review', id: record.id, payload: { reviewComment: '驳回' } });
                message.success('已驳回至草稿');
              }}
            >
              <Button size="small" type="link" danger>驳回</Button>
            </Popconfirm>
          )}
          {canUpdate && record.workflowStatus === 'ARCHIVED' && (
            <Popconfirm
              title="确定标记为修改状态？"
              onConfirm={async () => {
                await actionMutation.mutateAsync({ action: 'mark-modified', id: record.id });
                message.success('已标记为修改状态');
              }}
            >
              <Button size="small" type="link">标记修改</Button>
            </Popconfirm>
          )}
          {canBorrow && record.status === 'IN_STOCK' && record.workflowStatus === 'ARCHIVED' && (
            <Button
              size="small"
              onClick={() => {
                setActiveArchive(record);
                borrowForm.setFieldsValue({
                  borrower: '',
                  borrowedAt: dayjs(),
                });
                setBorrowModalOpen(true);
              }}
            >
              借阅
            </Button>
          )}
          {canReturn && record.status === 'BORROWED' && (
            <Button
              size="small"
              onClick={() => {
                setActiveArchive(record);
                returnForm.setFieldsValue({
                  returnedAt: dayjs(),
                  returnRemark: '',
                });
                setReturnModalOpen(true);
              }}
            >
              归还
            </Button>
          )}
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => {
              setActiveArchive(record);
              setRecordPage(1);
              setRecordDrawerOpen(true);
            }}
          >
            记录
          </Button>
          {canDelete && (
            <Popconfirm
              title="确定删除该实体档案？"
              onConfirm={async () => {
                await deleteMutation.mutateAsync(record.id);
                message.success('实体档案删除成功');
                queryClient.invalidateQueries({ queryKey: ['physical-archives'] });
              }}
            >
              <Button size="small" icon={<DeleteOutlined />} danger loading={deleteMutation.isPending}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const borrowRecordColumns: ColumnsType<PhysicalArchiveBorrowRecord> = [
    {
      title: '动作',
      dataIndex: 'action',
      key: 'action',
      width: 90,
      render: (value: PhysicalArchiveBorrowRecord['action']) =>
        value === 'BORROW' ? <Tag color="orange">借阅</Tag> : <Tag color="green">归还</Tag>,
    },
    { title: '借阅人', dataIndex: 'borrower', key: 'borrower', width: 130 },
    {
      title: '借出时间',
      dataIndex: 'borrowedAt',
      key: 'borrowedAt',
      width: 170,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '归还时间',
      dataIndex: 'returnedAt',
      key: 'returnedAt',
      width: 170,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '经办人',
      dataIndex: ['operator', 'name'],
      key: 'operator',
      width: 120,
      render: (_: unknown, record) => record.operator?.name || '-',
    },
    { title: '备注', dataIndex: 'remark', key: 'remark' },
  ];

  const closeMainModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    let extraJson: Record<string, unknown> | undefined;
    if (values.extraJsonText && values.extraJsonText.trim()) {
      try {
        extraJson = JSON.parse(values.extraJsonText);
      } catch {
        message.error('扩展JSON格式不正确');
        return;
      }
    }

    const payload: Partial<PhysicalArchive> = {
      ...values,
      formedAt: toIso(values.formedAt),
      expiresAt: toIso(values.expiresAt),
      borrowedAt: toIso(values.borrowedAt),
      filingDate: toIso(values.filingDate),
      effectiveDate: toIso(values.effectiveDate),
      invalidDate: toIso(values.invalidDate),
      transferDate: toIso(values.transferDate),
      receiveDate: toIso(values.receiveDate),
      appraisalDate: toIso(values.appraisalDate),
      reviewedAt: toIso(values.reviewedAt),
      filedAt: toIso(values.filedAt),
      destroyedAt: toIso(values.destroyedAt),
      lastAccessedAt: toIso(values.lastAccessedAt),
      customDate: toIso(values.customDate),
      extraJson,
      copies: values.copies || 1,
      tags: values.tags || [],
      keywords: values.keywords || [],
      versionHistory: values.versionHistory || [],
      relatedArchiveIds: values.relatedArchiveIds || [],
      revisionNo: values.revisionNo || 1,
      versionNo: values.versionNo || 'V1.0',
      workflowStatus: values.workflowStatus || 'DRAFT',
      status: values.status || 'IN_STOCK',
    };

    delete (payload as Record<string, unknown>).extraJsonText;

    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, values: payload });
      message.success('实体档案更新成功');
      queryClient.invalidateQueries({ queryKey: ['physical-archives'] });
      closeMainModal();
      return;
    }

    const preserve = pickFields(values, [
      'categoryName',
      'categoryPath',
      'fondsName',
      'fondsCode',
      'year',
      'fileType',
      'retentionPeriod',
      'securityLevel',
      'responsibleUnit',
      'belongCategory',
      'transferDepartment',
      'tags',
      'controlMark',
      'filingDepartment',
      'creatorDepartment',
      'ownerDepartment',
      'accessLevel',
      'workflowStatus',
    ]);

    await createMutation.mutateAsync(payload);
    message.success('实体档案创建成功');
    queryClient.invalidateQueries({ queryKey: ['physical-archives'] });

    if (continuousEntry) {
      form.resetFields();
      form.setFieldsValue({
        ...preserve,
        copies: 1,
        status: 'IN_STOCK',
        workflowStatus: 'DRAFT',
        formedAt: dayjs(),
        filingDate: dayjs(),
      });
      return;
    }

    closeMainModal();
  };

  return (
    <Card
      title="档案管理 / 档案信息录入"
      extra={(
        <Space wrap>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<SearchOutlined />}
            placeholder="搜索档案编号/档案代码/题名/分类/责任者"
            style={{ width: 320 }}
            allowClear
          />
          <Select
            allowClear
            placeholder="库存状态"
            value={status}
            style={{ width: 130 }}
            options={statusOptions.map(({ label, value }) => ({ label, value }))}
            onChange={(value) => setStatus(value)}
          />
          <Select
            allowClear
            placeholder="工作流状态"
            value={workflowStatus}
            style={{ width: 140 }}
            options={workflowOptions.map(({ label, value }) => ({ label, value }))}
            onChange={(value) => setWorkflowStatus(value)}
          />
          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                form.resetFields();
                form.setFieldsValue({
                  copies: 1,
                  status: 'IN_STOCK',
                  workflowStatus: 'DRAFT',
                  tags: [],
                  keywords: [],
                  versionHistory: [],
                  relatedArchiveIds: [],
                  year: dayjs().year(),
                  formedAt: dayjs(),
                  filingDate: dayjs(),
                  versionNo: 'V1.0',
                  revisionNo: 1,
                  versionStatus: 'FINAL',
                  isCurrentVersion: true,
                });
                setModalOpen(true);
              }}
            >
              新增档案
            </Button>
          )}
        </Space>
      )}
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={archives}
        loading={isLoading}
        scroll={{ x: 2600 }}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />

      <Modal
        title={editing ? '编辑档案信息' : '新增档案信息'}
        open={modalOpen}
        width={1280}
        onCancel={closeMainModal}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText="保存"
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          按九大类模型录入。带 * 为必填项；创建人和创建时间自动生成；电子文件字段与文件模块解耦，仅记录元数据。
        </Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            copies: 1,
            status: 'IN_STOCK',
            workflowStatus: 'DRAFT',
            tags: [],
            keywords: [],
            versionHistory: [],
            relatedArchiveIds: [],
            year: dayjs().year(),
            formedAt: dayjs(),
            filingDate: dayjs(),
            versionNo: 'V1.0',
            revisionNo: 1,
            versionStatus: 'FINAL',
            isCurrentVersion: true,
          }}
        >
          <Typography.Title level={5}>基础信息类</Typography.Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="档案名称 *" name="title" rules={[{ required: true, message: '请输入档案名称' }]}>
                <Input placeholder="例如：2024年度行政收发文登记表" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="档案编号 *" name="archiveNo" rules={[{ required: true, message: '请输入档案编号' }]}>
                <Input disabled={!!editing} placeholder="唯一编号" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="档案代码" name="archiveCode">
                <Input placeholder="如：XZ-SW-2024-001" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="副题名" name="subtitle">
                <Input placeholder="例如：含附件3份" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="分类名称 *"
                name="categoryName"
                rules={[{ required: true, message: '请选择或输入分类名称' }]}
              >
                <Input placeholder="如：文雨集团-A管理类-01行政工作" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="分类路径" name="categoryPath">
                <Input placeholder="如：文雨集团/A管理类/01行政工作/01收发文管理" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="分类ID" name="categoryId">
                <Input placeholder="如：CAT20240001" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="年度 *" name="year" rules={[{ required: true, message: '请输入年度' }]}>
                <InputNumber min={1900} max={2100} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="全宗名称 *" name="fondsName" rules={[{ required: true, message: '请输入全宗名称' }]}>
                <AutoComplete
                  options={fondsOptions.map((item) => ({ value: item.name }))}
                  onSelect={(value) => {
                    const matched = fondsOptions.find((item) => item.name === value);
                    if (matched) {
                      form.setFieldValue('fondsCode', matched.code);
                    }
                  }}
                >
                  <Input placeholder="输入或选择全宗" />
                </AutoComplete>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="全宗代码 *" name="fondsCode" rules={[{ required: true, message: '请输入全宗代码' }]}>
                <Input placeholder="如：SZ" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="语种" name="language">
                <Input placeholder="中文" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="载体类型" name="carrierType">
                <Select allowClear options={carrierTypeOptions.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="档案形态" name="archiveForm">
                <Select allowClear options={archiveFormOptions.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Typography.Title level={5}>业务信息类</Typography.Title>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="文件编号" name="fileNo">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="文件类型" name="fileType">
                <Select allowClear options={fileTypeOptions.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="责任者" name="responsibleParty">
                <Input placeholder="例如：行政部" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="责任者代码" name="responsibleCode">
                <Input placeholder="例如：XZB" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="形成日期" name="formedAt">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="归档日期" name="filingDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="生效日期" name="effectiveDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="失效日期" name="invalidDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={4}>
              <Form.Item label="份数" name="copies">
                <InputNumber min={1} max={999} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="页数" name="pages">
                <InputNumber min={0} max={100000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="附件数" name="attachmentCount">
                <InputNumber min={0} max={9999} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="文种" name="documentGenre">
                <Input placeholder="通知/报告等" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="紧急程度" name="urgencyLevel">
                <Input placeholder="特急/加急/普通" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="主题词" name="subjectTerms">
                <Input placeholder="如：行政管理-公文处理" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="内容摘要" name="summary">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="关键词" name="keywords">
                <Select mode="tags" placeholder="多个关键词回车分隔" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Typography.Title level={5}>管理信息类</Typography.Title>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="工作流状态" name="workflowStatus">
                <Select options={workflowOptions.map(({ label, value }) => ({ label, value }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="库存状态" name="status">
                <Select options={statusOptions.map(({ label, value }) => ({ label, value }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="保管期限" name="retentionPeriod">
                <Select allowClear options={retentionOptions.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="密级" name="securityLevel">
                <Select allowClear options={securityOptions.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="归档单位" name="filingDepartment">
                <Input placeholder="例如：档案室" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="责任单位" name="responsibleUnit">
                <Input placeholder="例如：行政部" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="所属类别" name="belongCategory">
                <Input placeholder="例如：行政/人事/财务" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="移交部门" name="transferDepartment">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="移交人" name="transferPerson">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="移交日期" name="transferDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="接收人" name="receiver">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="接收日期" name="receiveDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="控制标识" name="controlMark">
                <Input placeholder="例如：待鉴定" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="库位 *" name="shelfLocation" rules={[{ required: true, message: '请输入库位' }]}> 
                <Input placeholder="例如：A-01-03" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="存放位置" name="storageLocation">
                <Input placeholder="例如：A区-3排-2列-5层" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="排架号" name="shelfNo">
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="盒号" name="boxNo">
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="卷号" name="volumeNo">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="件号" name="itemNo">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="鉴定状态" name="appraisalStatus">
                <Select allowClear options={appraisalStatusOptions.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="鉴定人" name="appraiser">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="鉴定日期" name="appraisalDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Typography.Title level={5}>电子文件信息类</Typography.Title>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="电子文件ID" name="electronicFileId">
                <Input />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="原始文件名" name="originalFileName">
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="文件格式" name="fileExtension">
                <Input placeholder="docx/pdf" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="文件大小(字节)" name="fileSizeBytes">
                <Input placeholder="文件大小" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="存储路径" name="fileStoragePath">
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="存储方式" name="storageMethod">
                <Input placeholder="本地/对象存储/FTP" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="MD5" name="fileMd5">
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="缩略图路径" name="thumbnailPath">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="转存状态" name="transferStatus">
                <Select allowClear options={transferStatusOptions.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="数字化状态" name="digitizationStatus">
                <Select allowClear options={digitizationStatusOptions.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="OCR文本" name="ocrText">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Typography.Title level={5}>版本信息类</Typography.Title>
          <Row gutter={16}>
            <Col span={4}>
              <Form.Item label="版本号" name="versionNo">
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="版次" name="revisionNo">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="原版本号" name="previousVersionNo">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="版本状态" name="versionStatus">
                <Select options={versionStatusOptions.map((item) => ({ label: item.label, value: item.value }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="生效版本" name="isCurrentVersion">
                <Select
                  options={[
                    { label: '是', value: true },
                    { label: '否', value: false },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="版本说明" name="versionRemark">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="历史版本" name="versionHistory">
                <Select mode="tags" placeholder="例如：V1.1(2024-08-01)" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Typography.Title level={5}>关联信息类</Typography.Title>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="父档案ID" name="parentArchiveId">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="根档案ID" name="rootArchiveId">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="前置档案ID" name="predecessorArchiveId">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="后置档案ID" name="successorArchiveId">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="替代档案ID" name="replacedArchiveId">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="复制来源ID" name="copiedFromArchiveId">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="关联档案ID列表" name="relatedArchiveIds">
                <Select mode="tags" placeholder="输入多个档案ID" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Typography.Title level={5}>权限安全类</Typography.Title>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="所有者" name="ownerName">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="所有者部门" name="ownerDepartment">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="权限级别" name="accessLevel">
                <Select allowClear options={accessLevelOptions.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="加密状态" name="encryptionStatus">
                <Input placeholder="已加密/未加密" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="访问权限策略" name="accessPolicy">
                <Input placeholder="例如：仅管理员和行政部" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="水印配置" name="watermarkConfig">
                <Input placeholder="例如：机密-仅限内部" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="加密算法" name="encryptionAlgorithm">
                <Input placeholder="例如：AES-256" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="防篡改标识" name="tamperProofHash">
            <Input />
          </Form.Item>

          <Divider />
          <Typography.Title level={5}>审计信息类</Typography.Title>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="创建人部门" name="creatorDepartment">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="最后修改人ID" name="updatedById">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="审核人" name="reviewer">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="审核时间" name="reviewedAt">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="归档人" name="filer">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="归档时间" name="filedAt">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="最后访问人" name="lastAccessedBy">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="最后访问时间" name="lastAccessedAt">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="销毁人" name="destroyer">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="销毁时间" name="destroyedAt">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="审核意见" name="reviewComment">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="销毁原因" name="destroyReason">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Typography.Title level={5}>扩展信息类</Typography.Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="自定义文本1" name="customText1">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="自定义文本2" name="customText2">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="自定义文本3" name="customText3">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="自定义数值" name="customNumber">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="自定义日期" name="customDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="知识标签" name="tags">
                <Select mode="tags" placeholder="输入后回车" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="扩展JSON" name="extraJsonText">
            <Input.TextArea rows={4} placeholder='例如：{"projectNo":"P-2024-001"}' />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="创建人">{editing?.creator?.name || user?.name || '系统自动'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {editing?.createdAt ? dayjs(editing.createdAt).format('YYYY-MM-DD HH:mm:ss') : '保存后自动生成'}
            </Descriptions.Item>
          </Descriptions>

          {!editing && (
            <Form.Item style={{ marginTop: 12, marginBottom: 0 }}>
              <Checkbox checked={continuousEntry} onChange={(e) => setContinuousEntry(e.target.checked)}>
                连续录入：保留分类、全宗、年度、期限、密级、责任单位、权限级别、工作流状态等字段
              </Checkbox>
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={`借阅登记 - ${activeArchive?.archiveNo || ''}`}
        open={borrowModalOpen}
        onCancel={() => {
          setBorrowModalOpen(false);
          setActiveArchive(null);
          borrowForm.resetFields();
        }}
        onOk={async () => {
          if (!activeArchive) return;
          const values = await borrowForm.validateFields();
          await borrowMutation.mutateAsync({ id: activeArchive.id, values });
          message.success('借阅登记成功');
          setBorrowModalOpen(false);
          setActiveArchive(null);
          borrowForm.resetFields();
          queryClient.invalidateQueries({ queryKey: ['physical-archives'] });
          queryClient.invalidateQueries({ queryKey: ['physical-archive-records'] });
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
          <Form.Item label="借阅说明" name="borrowRemark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`归还登记 - ${activeArchive?.archiveNo || ''}`}
        open={returnModalOpen}
        onCancel={() => {
          setReturnModalOpen(false);
          setActiveArchive(null);
          returnForm.resetFields();
        }}
        onOk={async () => {
          if (!activeArchive) return;
          const values = await returnForm.validateFields();
          await returnMutation.mutateAsync({ id: activeArchive.id, values });
          message.success('归还登记成功');
          setReturnModalOpen(false);
          setActiveArchive(null);
          returnForm.resetFields();
          queryClient.invalidateQueries({ queryKey: ['physical-archives'] });
          queryClient.invalidateQueries({ queryKey: ['physical-archive-records'] });
        }}
        confirmLoading={returnMutation.isPending}
      >
        <Form form={returnForm} layout="vertical">
          <Form.Item label="归还时间" name="returnedAt">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="归还备注" name="returnRemark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`借阅记录 - ${activeArchive?.archiveNo || ''}`}
        placement="right"
        width={760}
        open={recordDrawerOpen}
        onClose={() => {
          setRecordDrawerOpen(false);
          setActiveArchive(null);
          setRecordPage(1);
        }}
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
            onChange: (nextPage, nextPageSize) => {
              setRecordPage(nextPage);
              setRecordPageSize(nextPageSize);
            },
          }}
        />
      </Drawer>
    </Card>
  );
};

export default PhysicalArchives;
