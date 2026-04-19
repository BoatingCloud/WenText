import { useEffect, useMemo, useState } from 'react';
import {
  App,
  AutoComplete,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Upload,
} from 'antd';
import dayjs from 'dayjs';
import {
  SaveOutlined,
  ArrowLeftOutlined,
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  physicalArchiveApi,
  systemConfigApi,
  userApi,
  archiveCategoryApi,
} from '../../../services/api';
import type { PhysicalArchive, PhysicalArchiveAttachment, CompanyCatalogItem, ArchiveCategory } from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import {
  type ArchiveFormValues,
  statusOptions,
  workflowOptions,
  versionStatusOptions,
  retentionOptions,
  securityOptions,
  fileTypeOptions,
  archiveFormOptions,
  carrierTypeOptions,
  accessLevelOptions,
  appraisalStatusOptions,
  digitizationStatusOptions,
  transferStatusOptions,
  DEFAULT_FONDS_OPTIONS,
  toFormValues,
  formValuesToPayload,
  extractRetentionYears,
  pickFields,
} from './constants';

const PhysicalArchiveForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { user } = useAuthStore();

  const [form] = Form.useForm<ArchiveFormValues>();
  const [continuousEntry, setContinuousEntry] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 获取档案数据（编辑模式）
  const { data: archiveData, isLoading } = useQuery({
    queryKey: ['physical-archive', id],
    enabled: isEdit,
    queryFn: () => physicalArchiveApi.get(id!),
  });

  const { data: publicSiteConfig } = useQuery({
    queryKey: ['public-site-config-fonds'],
    queryFn: () => systemConfigApi.getPublicTheme(),
    staleTime: 5 * 60 * 1000,
  });

  const fondsOptions = useMemo(() => {
    const configured = publicSiteConfig?.data?.data?.fondsCatalog;
    if (Array.isArray(configured) && configured.length > 0) {
      return configured;
    }
    return DEFAULT_FONDS_OPTIONS;
  }, [publicSiteConfig]);

  const companyCatalog: CompanyCatalogItem[] = useMemo(() => {
    return publicSiteConfig?.data?.data?.companyCatalog || [];
  }, [publicSiteConfig]);

  const { data: categoryTreeData } = useQuery({
    queryKey: ['archive-category-tree'],
    queryFn: () => archiveCategoryApi.getTree(),
    staleTime: 5 * 60 * 1000,
  });
  const categoryTree = categoryTreeData?.data?.data || [];
  const categoryOptions = useMemo(() => {
    const result: Array<{ value: string; label: string; name: string; path: string; isEnabled: boolean }> = [];

    const walk = (nodes: ArchiveCategory[], ancestors: string[] = []) => {
      nodes.forEach((node) => {
        const names = [...ancestors, node.name];
        const fullName = names.join(' / ');
        result.push({
          value: node.id,
          label: `${fullName} (${node.code})`,
          name: node.name,
          path: names.join('/'),
          isEnabled: node.isEnabled,
        });
        if (Array.isArray(node.children) && node.children.length > 0) {
          walk(node.children, names);
        }
      });
    };

    walk(categoryTree);
    return result;
  }, [categoryTree]);
  const categoryOptionMap = useMemo(
    () => Object.fromEntries(categoryOptions.map((item) => [item.value, item])),
    [categoryOptions]
  );

  // 获取当前用户的公司数据权限
  const { data: companyScopesData } = useQuery({
    queryKey: ['my-company-scopes', user?.id],
    enabled: !!user?.id,
    queryFn: () => userApi.getCompanyScopes(user!.id),
  });
  const isAllCompanies = companyScopesData?.data.data?.isAllCompanies ?? false;
  const myCompanyCodes = companyScopesData?.data.data?.companyCodes ?? [];

  // 根据用户权限过滤可选的公司列表
  const visibleCompanyCatalog = useMemo(() => {
    if (isAllCompanies) return companyCatalog;
    return companyCatalog.filter((c) => myCompanyCodes.includes(c.code));
  }, [companyCatalog, isAllCompanies, myCompanyCodes]);

  const editing = archiveData?.data?.data;

  // 编辑模式填充表单
  useEffect(() => {
    if (editing) {
      form.setFieldsValue(toFormValues(editing));
    }
  }, [editing, form]);

  // 自动计算到期日期
  const watchedFormedAt = Form.useWatch('formedAt', form);
  const watchedRetention = Form.useWatch('retentionPeriod', form);
  const watchedCategoryName = Form.useWatch('categoryName', form);
  const watchedCategoryId = Form.useWatch('categoryId', form);

  useEffect(() => {
    const years = extractRetentionYears(watchedRetention);
    if (!watchedFormedAt || !years) return;
    const currentExpires = form.getFieldValue('expiresAt');
    const nextExpires = watchedFormedAt.add(years, 'year');
    if (!currentExpires || !dayjs(currentExpires).isSame(nextExpires, 'day')) {
      form.setFieldValue('expiresAt', nextExpires);
    }
  }, [form, watchedFormedAt, watchedRetention]);

  // 自动推断文件类型
  useEffect(() => {
    const currentType = form.getFieldValue('fileType');
    if (currentType || !watchedCategoryName) return;
    if (watchedCategoryName.includes('合同')) {
      form.setFieldValue('fileType', '合同');
    } else if (watchedCategoryName.includes('收发文') || watchedCategoryName.includes('行政')) {
      form.setFieldValue('fileType', '通知');
    }
  }, [form, watchedCategoryName]);

  const createMutation = useMutation({
    mutationFn: (values: Partial<PhysicalArchive>) => physicalArchiveApi.create(values),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<PhysicalArchive> }) =>
      physicalArchiveApi.update(id, values),
  });

  // 附件管理（编辑模式）
  const { data: attachmentsData, refetch: refetchAttachments } = useQuery({
    queryKey: ['archive-attachments', id],
    enabled: isEdit,
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

  const handleSubmit = async () => {
    let values: ArchiveFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 验证错误由 antd 表单自行显示
    }

    setSubmitting(true);
    try {
      const payload = formValuesToPayload(values);

      if (isEdit && editing) {
        await updateMutation.mutateAsync({ id: editing.id, values: payload });
        message.success('档案更新成功');
        queryClient.invalidateQueries({ queryKey: ['physical-archives'] });
        queryClient.invalidateQueries({ queryKey: ['physical-archive', editing.id] });
        navigate(`/admin/physical-archives/${editing.id}`);
        return;
      }

      // 新建模式 - 保留连续录入字段
      const preserve = pickFields(values, [
        'categoryId', 'categoryName', 'categoryPath', 'fondsName', 'fondsCode',
        'year', 'fileType', 'retentionPeriod', 'securityLevel',
        'responsibleUnit', 'belongCategory', 'transferDepartment',
        'tags', 'controlMark', 'filingDepartment', 'creatorDepartment',
        'ownerDepartment', 'accessLevel', 'workflowStatus', 'companyCode',
      ]);

      await createMutation.mutateAsync(payload);
      message.success('档案创建成功');
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
      } else {
        navigate('/admin/physical-archives');
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || '操作失败';
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── 基础信息 ── */
  const basicSection = (
    <>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item label="档案名称" name="title" rules={[{ required: true, message: '请输入档案名称' }]}>
            <Input placeholder="例如：2024年度行政收发文登记表" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="档案编号" name="archiveNo" rules={[{ required: true, message: '请输入档案编号' }]}>
            <Input disabled={isEdit} placeholder="唯一编号" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="档案代码" name="archiveCode">
            <Input placeholder="如：XZ-SW-2024-001" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item label="副题名" name="subtitle">
            <Input placeholder="例如：含附件3份" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="档案分类"
            name="categoryId"
            rules={[{ required: !isEdit, message: '请选择档案分类' }]}
          >
            <Select
              showSearch
              allowClear={isEdit}
              placeholder="请选择档案分类"
              optionFilterProp="label"
              options={categoryOptions.map((item) => ({
                label: item.isEnabled ? item.label : `${item.label}（已禁用）`,
                value: item.value,
                disabled: !item.isEnabled && item.value !== watchedCategoryId,
              }))}
              onChange={(value) => {
                const selected = value ? categoryOptionMap[value] : undefined;
                form.setFieldsValue({
                  categoryName: selected?.name,
                  categoryPath: selected?.path,
                });
              }}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="所属公司" name="companyCode">
            <Select
              allowClear
              placeholder="选择所属公司"
              options={visibleCompanyCatalog.map((c) => ({ label: c.name, value: c.code }))}
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="分类路径" name="categoryPath">
            <Input readOnly placeholder="选择档案分类后自动填充" />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label="分类名称" name="categoryName">
            <Input readOnly placeholder="选择档案分类后自动填充" />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label="年度" name="year" rules={[{ required: true, message: '请输入年度' }]}>
            <InputNumber min={1900} max={2100} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={6}>
          <Form.Item label="全宗名称" name="fondsName" rules={[{ required: true, message: '请输入全宗名称' }]}>
            <AutoComplete
              options={fondsOptions.map((item) => ({ value: item.name }))}
              onSelect={(value) => {
                const matched = fondsOptions.find((item) => item.name === value);
                if (matched) form.setFieldValue('fondsCode', matched.code);
              }}
            >
              <Input placeholder="输入或选择全宗" />
            </AutoComplete>
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label="全宗代码" name="fondsCode" rules={[{ required: true, message: '请输入全宗代码' }]}>
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
            <Select allowClear options={carrierTypeOptions.map((v) => ({ label: v, value: v }))} />
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item label="档案形态" name="archiveForm">
            <Select allowClear options={archiveFormOptions.map((v) => ({ label: v, value: v }))} />
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  /* ── 业务信息 ── */
  const businessSection = (
    <>
      <Row gutter={16}>
        <Col span={6}><Form.Item label="文件编号" name="fileNo"><Input /></Form.Item></Col>
        <Col span={6}>
          <Form.Item label="文件类型" name="fileType">
            <Select allowClear options={fileTypeOptions.map((v) => ({ label: v, value: v }))} />
          </Form.Item>
        </Col>
        <Col span={6}><Form.Item label="责任者" name="responsibleParty"><Input placeholder="例如：行政部" /></Form.Item></Col>
        <Col span={6}><Form.Item label="责任者代码" name="responsibleCode"><Input placeholder="例如：XZB" /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={6}><Form.Item label="形成日期" name="formedAt"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={6}><Form.Item label="归档日期" name="filingDate"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={6}><Form.Item label="生效日期" name="effectiveDate"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={6}><Form.Item label="失效日期" name="invalidDate"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={4}><Form.Item label="份数" name="copies"><InputNumber min={1} max={999} style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={4}><Form.Item label="页数" name="pages"><InputNumber min={0} max={100000} style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={4}><Form.Item label="附件数" name="attachmentCount"><InputNumber min={0} max={9999} style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={4}><Form.Item label="文种" name="documentGenre"><Input placeholder="通知/报告等" /></Form.Item></Col>
        <Col span={4}><Form.Item label="紧急程度" name="urgencyLevel"><Input placeholder="特急/加急/普通" /></Form.Item></Col>
        <Col span={4}><Form.Item label="主题词" name="subjectTerms"><Input placeholder="行政管理-公文处理" /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}><Form.Item label="内容摘要" name="summary"><Input.TextArea rows={2} /></Form.Item></Col>
        <Col span={12}><Form.Item label="关键词" name="keywords"><Select mode="tags" placeholder="多个关键词回车分隔" /></Form.Item></Col>
      </Row>
    </>
  );

  /* ── 管理信息 ── */
  const managementSection = (
    <>
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
            <Select allowClear options={retentionOptions.map((v) => ({ label: v, value: v }))} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label="密级" name="securityLevel">
            <Select allowClear options={securityOptions.map((v) => ({ label: v, value: v }))} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={6}>
          <Form.Item label="库位" name="shelfLocation" rules={[{ required: true, message: '请输入库位' }]}>
            <Input placeholder="例如：A-01-03" />
          </Form.Item>
        </Col>
        <Col span={6}><Form.Item label="存放位置" name="storageLocation"><Input placeholder="A区-3排-2列-5层" /></Form.Item></Col>
        <Col span={4}><Form.Item label="排架号" name="shelfNo"><Input /></Form.Item></Col>
        <Col span={4}><Form.Item label="盒号" name="boxNo"><Input /></Form.Item></Col>
        <Col span={4}><Form.Item label="卷号" name="volumeNo"><Input /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item label="归档单位" name="filingDepartment"><Input placeholder="例如：档案室" /></Form.Item></Col>
        <Col span={8}><Form.Item label="责任单位" name="responsibleUnit"><Input placeholder="例如：行政部" /></Form.Item></Col>
        <Col span={8}><Form.Item label="所属类别" name="belongCategory"><Input placeholder="行政/人事/财务" /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item label="移交部门" name="transferDepartment"><Input /></Form.Item></Col>
        <Col span={8}><Form.Item label="移交人" name="transferPerson"><Input /></Form.Item></Col>
        <Col span={8}><Form.Item label="移交日期" name="transferDate"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item label="接收人" name="receiver"><Input /></Form.Item></Col>
        <Col span={8}><Form.Item label="接收日期" name="receiveDate"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={8}><Form.Item label="控制标识" name="controlMark"><Input placeholder="例如：待鉴定" /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={6}><Form.Item label="件号" name="itemNo"><Input /></Form.Item></Col>
        <Col span={6}>
          <Form.Item label="鉴定状态" name="appraisalStatus">
            <Select allowClear options={appraisalStatusOptions.map((v) => ({ label: v, value: v }))} />
          </Form.Item>
        </Col>
        <Col span={6}><Form.Item label="鉴定人" name="appraiser"><Input /></Form.Item></Col>
        <Col span={6}><Form.Item label="鉴定日期" name="appraisalDate"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
      </Row>
    </>
  );

  /* ── 电子文件信息 ── */
  const digitalSection = (
    <>
      <Row gutter={16}>
        <Col span={6}><Form.Item label="电子文件ID" name="electronicFileId"><Input /></Form.Item></Col>
        <Col span={10}><Form.Item label="原始文件名" name="originalFileName"><Input /></Form.Item></Col>
        <Col span={4}><Form.Item label="文件格式" name="fileExtension"><Input placeholder="docx/pdf" /></Form.Item></Col>
        <Col span={4}><Form.Item label="文件大小(字节)" name="fileSizeBytes"><Input placeholder="文件大小" /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}><Form.Item label="存储路径" name="fileStoragePath"><Input /></Form.Item></Col>
        <Col span={4}><Form.Item label="存储方式" name="storageMethod"><Input placeholder="本地/FTP" /></Form.Item></Col>
        <Col span={4}><Form.Item label="MD5" name="fileMd5"><Input /></Form.Item></Col>
        <Col span={4}><Form.Item label="缩略图路径" name="thumbnailPath"><Input /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item label="转存状态" name="transferStatus">
            <Select allowClear options={transferStatusOptions.map((v) => ({ label: v, value: v }))} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="数字化状态" name="digitizationStatus">
            <Select allowClear options={digitizationStatusOptions.map((v) => ({ label: v, value: v }))} />
          </Form.Item>
        </Col>
        <Col span={8}><Form.Item label="OCR文本" name="ocrText"><Input /></Form.Item></Col>
      </Row>
    </>
  );

  /* ── 版本信息 ── */
  const versionSection = (
    <>
      <Row gutter={16}>
        <Col span={4}><Form.Item label="版本号" name="versionNo"><Input /></Form.Item></Col>
        <Col span={4}><Form.Item label="版次" name="revisionNo"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={4}><Form.Item label="原版本号" name="previousVersionNo"><Input /></Form.Item></Col>
        <Col span={6}>
          <Form.Item label="版本状态" name="versionStatus">
            <Select options={versionStatusOptions.map((item) => ({ label: item.label, value: item.value }))} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label="生效版本" name="isCurrentVersion">
            <Select options={[{ label: '是', value: true }, { label: '否', value: false }]} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}><Form.Item label="版本说明" name="versionRemark"><Input /></Form.Item></Col>
        <Col span={12}><Form.Item label="历史版本" name="versionHistory"><Select mode="tags" placeholder="V1.1(2024-08-01)" /></Form.Item></Col>
      </Row>
    </>
  );

  /* ── 关联信息 ── */
  const relationSection = (
    <>
      <Row gutter={16}>
        <Col span={6}><Form.Item label="父档案ID" name="parentArchiveId"><Input /></Form.Item></Col>
        <Col span={6}><Form.Item label="根档案ID" name="rootArchiveId"><Input /></Form.Item></Col>
        <Col span={6}><Form.Item label="前置档案ID" name="predecessorArchiveId"><Input /></Form.Item></Col>
        <Col span={6}><Form.Item label="后置档案ID" name="successorArchiveId"><Input /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item label="替代档案ID" name="replacedArchiveId"><Input /></Form.Item></Col>
        <Col span={8}><Form.Item label="复制来源ID" name="copiedFromArchiveId"><Input /></Form.Item></Col>
        <Col span={8}><Form.Item label="关联档案ID列表" name="relatedArchiveIds"><Select mode="tags" placeholder="输入多个档案ID" /></Form.Item></Col>
      </Row>
    </>
  );

  /* ── 权限安全 ── */
  const securitySection = (
    <>
      <Row gutter={16}>
        <Col span={6}><Form.Item label="所有者" name="ownerName"><Input /></Form.Item></Col>
        <Col span={6}><Form.Item label="所有者部门" name="ownerDepartment"><Input /></Form.Item></Col>
        <Col span={6}>
          <Form.Item label="权限级别" name="accessLevel">
            <Select allowClear options={accessLevelOptions.map((v) => ({ label: v, value: v }))} />
          </Form.Item>
        </Col>
        <Col span={6}><Form.Item label="加密状态" name="encryptionStatus"><Input placeholder="已加密/未加密" /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item label="访问权限策略" name="accessPolicy"><Input placeholder="仅管理员和行政部" /></Form.Item></Col>
        <Col span={8}><Form.Item label="水印配置" name="watermarkConfig"><Input placeholder="机密-仅限内部" /></Form.Item></Col>
        <Col span={8}><Form.Item label="加密算法" name="encryptionAlgorithm"><Input placeholder="AES-256" /></Form.Item></Col>
      </Row>
      <Form.Item label="防篡改标识" name="tamperProofHash"><Input /></Form.Item>
    </>
  );

  /* ── 审计信息 ── */
  const auditSection = (
    <>
      <Row gutter={16}>
        <Col span={6}><Form.Item label="创建人部门" name="creatorDepartment"><Input /></Form.Item></Col>
        <Col span={6}><Form.Item label="最后修改人ID" name="updatedById"><Input /></Form.Item></Col>
        <Col span={6}><Form.Item label="审核人" name="reviewer"><Input /></Form.Item></Col>
        <Col span={6}><Form.Item label="审核时间" name="reviewedAt"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item label="归档人" name="filer"><Input /></Form.Item></Col>
        <Col span={8}><Form.Item label="归档时间" name="filedAt"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={8}><Form.Item label="最后访问人" name="lastAccessedBy"><Input /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item label="最后访问时间" name="lastAccessedAt"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={8}><Form.Item label="销毁人" name="destroyer"><Input /></Form.Item></Col>
        <Col span={8}><Form.Item label="销毁时间" name="destroyedAt"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}><Form.Item label="审核意见" name="reviewComment"><Input.TextArea rows={2} /></Form.Item></Col>
        <Col span={12}><Form.Item label="销毁原因" name="destroyReason"><Input.TextArea rows={2} /></Form.Item></Col>
      </Row>
    </>
  );

  /* ── 扩展信息 ── */
  const extensionSection = (
    <>
      <Row gutter={16}>
        <Col span={8}><Form.Item label="自定义文本1" name="customText1"><Input /></Form.Item></Col>
        <Col span={8}><Form.Item label="自定义文本2" name="customText2"><Input /></Form.Item></Col>
        <Col span={8}><Form.Item label="自定义文本3" name="customText3"><Input /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item label="自定义数值" name="customNumber"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={8}><Form.Item label="自定义日期" name="customDate"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={8}><Form.Item label="知识标签" name="tags"><Select mode="tags" placeholder="输入后回车" /></Form.Item></Col>
      </Row>
      <Form.Item label="扩展JSON" name="extraJsonText">
        <Input.TextArea rows={3} placeholder='{"projectNo":"P-2024-001"}' />
      </Form.Item>
      <Form.Item label="备注" name="remark">
        <Input.TextArea rows={2} />
      </Form.Item>
    </>
  );

  /* ── 附件管理（仅编辑模式） ── */
  const attachmentSection = isEdit ? (
    <>
      <Upload
        customRequest={handleAttachmentUpload}
        showUploadList={false}
        multiple
      >
        <Button icon={<UploadOutlined />} loading={uploadAttachmentMutation.isPending}>
          上传附件
        </Button>
      </Upload>
      <Table
        rowKey="id"
        dataSource={attachments}
        size="small"
        pagination={false}
        style={{ marginTop: 12 }}
        columns={[
          { title: '文件名', dataIndex: 'fileName', key: 'fileName', ellipsis: true },
          {
            title: '大小',
            dataIndex: 'fileSize',
            key: 'fileSize',
            width: 100,
            render: (v: string) => {
              const bytes = Number(v);
              if (bytes < 1024) return `${bytes} B`;
              if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
              return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
            },
          },
          {
            title: '上传人',
            dataIndex: ['uploader', 'name'],
            key: 'uploader',
            width: 100,
          },
          {
            title: '上传时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 160,
            render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
          },
          {
            title: '操作',
            key: 'actions',
            width: 140,
            render: (_: unknown, record: PhysicalArchiveAttachment) => (
              <Space>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => handleAttachmentDownload(record)}
                >
                  下载
                </Button>
                <Popconfirm
                  title="确定删除此附件？"
                  onConfirm={() => deleteAttachmentMutation.mutate(record.id)}
                >
                  <Button size="small" icon={<DeleteOutlined />} danger>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </>
  ) : (
    <div style={{ color: '#999', textAlign: 'center', padding: '16px 0' }}>
      请先保存档案，再上传附件
    </div>
  );

  const collapseItems = [
    { key: 'basic', label: '基础信息（必填）', children: basicSection, forceRender: true },
    { key: 'business', label: '业务信息', children: businessSection, forceRender: true },
    { key: 'management', label: '管理信息（含库位必填）', children: managementSection, forceRender: true },
    { key: 'digital', label: '电子文件信息', children: digitalSection, forceRender: true },
    { key: 'attachments', label: `附件管理${isEdit ? ` (${attachments.length})` : ''}`, children: attachmentSection },
    { key: 'version', label: '版本信息', children: versionSection, forceRender: true },
    { key: 'relation', label: '关联信息', children: relationSection, forceRender: true },
    { key: 'security', label: '权限安全', children: securitySection, forceRender: true },
    { key: 'audit', label: '审计信息', children: auditSection, forceRender: true },
    { key: 'extension', label: '扩展信息', children: extensionSection, forceRender: true },
  ];

  return (
    <Card
      title={
        <Space>
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(-1)} />
          <span>{isEdit ? '编辑档案信息' : '新增档案信息'}</span>
        </Space>
      }
      extra={
        <Space>
          {!isEdit && (
            <Checkbox checked={continuousEntry} onChange={(e) => setContinuousEntry(e.target.checked)}>
              连续录入
            </Checkbox>
          )}
          <Button onClick={() => navigate(-1)}>取消</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            onClick={handleSubmit}
          >
            保存
          </Button>
        </Space>
      }
      loading={isEdit && isLoading}
    >
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
        <Collapse
          defaultActiveKey={['basic', 'business', 'management']}
          items={collapseItems}
          style={{ marginBottom: 16 }}
        />

        <Descriptions size="small" column={2} style={{ marginTop: 16 }}>
          <Descriptions.Item label="创建人">{editing?.creator?.name || user?.name || '系统自动'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {editing?.createdAt ? dayjs(editing.createdAt).format('YYYY-MM-DD HH:mm:ss') : '保存后自动生成'}
          </Descriptions.Item>
        </Descriptions>
      </Form>
    </Card>
  );
};

export default PhysicalArchiveForm;
