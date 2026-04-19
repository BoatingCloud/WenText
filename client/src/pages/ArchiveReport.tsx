import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  DatePicker,
  Select,
  Button,
  Space,
  Form,
  Row,
  Col,
  App,
  Dropdown,
  type MenuProps,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import {
  physicalArchiveApi,
  systemConfigApi,
  archiveCategoryApi,
  type PhysicalArchive,
  type PhysicalArchiveStatus,
  type ArchiveWorkflowStatus,
} from '../services/api';
import { useCompanyScopeStore } from '../stores/companyScopeStore';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 状态标签映射
const STATUS_LABELS: Record<PhysicalArchiveStatus, string> = {
  IN_STOCK: '在库',
  BORROWED: '借出',
  LOST: '丢失',
  DESTROYED: '销毁',
};

const WORKFLOW_STATUS_LABELS: Record<ArchiveWorkflowStatus, string> = {
  DRAFT: '草稿',
  PENDING_REVIEW: '待审核',
  ARCHIVED: '已归档',
  MODIFIED: '已修改',
  BORROWED: '已借出',
  RETURNED: '已归还',
  DESTROYED: '已销毁',
};

interface ReportFilters {
  companyCode?: string;
  categoryId?: string;
  status?: PhysicalArchiveStatus;
  workflowStatus?: ArchiveWorkflowStatus;
  year?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
}

const ArchiveReport: React.FC = () => {
  const { message } = App.useApp();
  const { selectedCompanyCode } = useCompanyScopeStore();
  const [form] = Form.useForm();

  const [filters, setFilters] = useState<ReportFilters>({
    companyCode: selectedCompanyCode || undefined,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 获取系统配置（公司列表）
  const { data: configData } = useQuery({
    queryKey: ['system-config-public'],
    queryFn: () => systemConfigApi.getPublicTheme(),
  });

  // 获取档案分类列表
  const { data: categoriesData } = useQuery({
    queryKey: ['archive-categories'],
    queryFn: () => archiveCategoryApi.list(),
  });

  const companies: any[] = (configData?.data.data as any)?.companyCatalog || [];
  const categories = categoriesData?.data.data || [];

  // 获取档案列表
  const { data: archivesData, isLoading } = useQuery({
    queryKey: ['archives-report', filters, page, pageSize],
    queryFn: () =>
      physicalArchiveApi.list({
        ...filters,
        page,
        pageSize,
      }),
  });

  const archives = archivesData?.data?.data || [];
  const pagination = archivesData?.data?.pagination;

  useEffect(() => {
    setFilters((prev) => ({ ...prev, companyCode: selectedCompanyCode || undefined }));
  }, [selectedCompanyCode]);

  // 处理查询
  const handleSearch = () => {
    const values = form.getFieldsValue();
    const newFilters: ReportFilters = {
      companyCode: values.companyCode,
      categoryId: values.categoryId,
      status: values.status,
      workflowStatus: values.workflowStatus,
      year: values.year,
      search: values.search,
    };

    // 处理日期范围
    if (values.dateRange && values.dateRange[0] && values.dateRange[1]) {
      newFilters.startDate = values.dateRange[0].format('YYYY-MM-DD');
      newFilters.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }

    setFilters(newFilters);
    setPage(1);
  };

  // 重置筛选
  const handleReset = () => {
    form.resetFields();
    setFilters({ companyCode: selectedCompanyCode || undefined });
    setPage(1);
  };

  // 导出为Excel
  const exportToExcel = () => {
    try {
      if (archives.length === 0) {
        message.warning('暂无数据可导出');
        return;
      }

      const workbook = XLSX.utils.book_new();

      // 准备导出数据
      const exportData = archives.map((archive: PhysicalArchive) => ({
        档案编号: archive.archiveNo,
        档案代码: archive.archiveCode || '',
        题名: archive.title,
        副题名: archive.subtitle || '',
        分类名称: archive.categoryName || '',
        全宗名称: archive.fondsName || '',
        全宗代码: archive.fondsCode || '',
        年度: archive.year || '',
        语种: archive.language || '',
        载体类型: archive.carrierType || '',
        档案形态: archive.archiveForm || '',
        所属公司: archive.companyCode || '',
        文件编号: archive.fileNo || '',
        文件类型: archive.fileType || '',
        责任者: archive.responsibleParty || '',
        形成日期: archive.formedAt ? dayjs(archive.formedAt).format('YYYY-MM-DD') : '',
        归档日期: archive.filingDate ? dayjs(archive.filingDate).format('YYYY-MM-DD') : '',
        份数: archive.copies,
        页数: archive.pages || '',
        保管期限: archive.retentionPeriod || '',
        密级: archive.securityLevel || '',
        库位: archive.shelfLocation,
        存放位置: archive.storageLocation || '',
        排架号: archive.shelfNo || '',
        盒号: archive.boxNo || '',
        卷号: archive.volumeNo || '',
        件号: archive.itemNo || '',
        工作流状态: WORKFLOW_STATUS_LABELS[archive.workflowStatus || 'DRAFT'],
        在库状态: STATUS_LABELS[archive.status],
        借阅人: archive.borrower || '',
        借出时间: archive.borrowedAt ? dayjs(archive.borrowedAt).format('YYYY-MM-DD HH:mm') : '',
        内容摘要: archive.summary || '',
        关键词: archive.keywords?.join(', ') || '',
        创建人: archive.creator?.name || '',
        创建时间: dayjs(archive.createdAt).format('YYYY-MM-DD HH:mm'),
        更新时间: dayjs(archive.updatedAt).format('YYYY-MM-DD HH:mm'),
      }));

      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // 设置列宽
      const colWidths = [
        { wch: 15 }, // 档案编号
        { wch: 15 }, // 档案代码
        { wch: 30 }, // 题名
        { wch: 20 }, // 副题名
        { wch: 15 }, // 分类名称
        { wch: 15 }, // 全宗名称
        { wch: 12 }, // 全宗代码
        { wch: 8 },  // 年度
        { wch: 10 }, // 语种
        { wch: 12 }, // 载体类型
        { wch: 12 }, // 档案形态
        { wch: 12 }, // 所属公司
        { wch: 15 }, // 文件编号
        { wch: 12 }, // 文件类型
        { wch: 15 }, // 责任者
        { wch: 12 }, // 形成日期
        { wch: 12 }, // 归档日期
        { wch: 8 },  // 份数
        { wch: 8 },  // 页数
        { wch: 12 }, // 保管期限
        { wch: 10 }, // 密级
        { wch: 15 }, // 库位
        { wch: 15 }, // 存放位置
        { wch: 12 }, // 排架号
        { wch: 10 }, // 盒号
        { wch: 10 }, // 卷号
        { wch: 10 }, // 件号
        { wch: 12 }, // 工作流状态
        { wch: 10 }, // 在库状态
        { wch: 12 }, // 借阅人
        { wch: 18 }, // 借出时间
        { wch: 40 }, // 内容摘要
        { wch: 30 }, // 关键词
        { wch: 12 }, // 创建人
        { wch: 18 }, // 创建时间
        { wch: 18 }, // 更新时间
      ];
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, '档案明细');

      // 导出文件
      const fileName = `档案明细报表_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  // 导出为TXT
  const exportToTxt = () => {
    try {
      if (archives.length === 0) {
        message.warning('暂无数据可导出');
        return;
      }

      let txtContent = '档案明细报表\n';
      txtContent += `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n`;
      txtContent += `总记录数: ${pagination?.total || 0}\n`;
      txtContent += '='.repeat(100) + '\n\n';

      archives.forEach((archive: PhysicalArchive, index: number) => {
        txtContent += `【记录 ${index + 1}】\n`;
        txtContent += `档案编号: ${archive.archiveNo}\n`;
        txtContent += `档案代码: ${archive.archiveCode || '-'}\n`;
        txtContent += `题名: ${archive.title}\n`;
        txtContent += `副题名: ${archive.subtitle || '-'}\n`;
        txtContent += `分类名称: ${archive.categoryName || '-'}\n`;
        txtContent += `全宗名称: ${archive.fondsName || '-'}\n`;
        txtContent += `全宗代码: ${archive.fondsCode || '-'}\n`;
        txtContent += `年度: ${archive.year || '-'}\n`;
        txtContent += `语种: ${archive.language || '-'}\n`;
        txtContent += `载体类型: ${archive.carrierType || '-'}\n`;
        txtContent += `档案形态: ${archive.archiveForm || '-'}\n`;
        txtContent += `所属公司: ${archive.companyCode || '-'}\n`;
        txtContent += `文件编号: ${archive.fileNo || '-'}\n`;
        txtContent += `文件类型: ${archive.fileType || '-'}\n`;
        txtContent += `责任者: ${archive.responsibleParty || '-'}\n`;
        txtContent += `形成日期: ${archive.formedAt ? dayjs(archive.formedAt).format('YYYY-MM-DD') : '-'}\n`;
        txtContent += `归档日期: ${archive.filingDate ? dayjs(archive.filingDate).format('YYYY-MM-DD') : '-'}\n`;
        txtContent += `份数: ${archive.copies}\n`;
        txtContent += `页数: ${archive.pages || '-'}\n`;
        txtContent += `保管期限: ${archive.retentionPeriod || '-'}\n`;
        txtContent += `密级: ${archive.securityLevel || '-'}\n`;
        txtContent += `库位: ${archive.shelfLocation}\n`;
        txtContent += `存放位置: ${archive.storageLocation || '-'}\n`;
        txtContent += `排架号: ${archive.shelfNo || '-'}\n`;
        txtContent += `盒号: ${archive.boxNo || '-'}\n`;
        txtContent += `卷号: ${archive.volumeNo || '-'}\n`;
        txtContent += `件号: ${archive.itemNo || '-'}\n`;
        txtContent += `工作流状态: ${WORKFLOW_STATUS_LABELS[archive.workflowStatus || 'DRAFT']}\n`;
        txtContent += `在库状态: ${STATUS_LABELS[archive.status]}\n`;
        txtContent += `借阅人: ${archive.borrower || '-'}\n`;
        txtContent += `借出时间: ${archive.borrowedAt ? dayjs(archive.borrowedAt).format('YYYY-MM-DD HH:mm') : '-'}\n`;
        txtContent += `内容摘要: ${archive.summary || '-'}\n`;
        txtContent += `关键词: ${archive.keywords?.join(', ') || '-'}\n`;
        txtContent += `创建人: ${archive.creator?.name || '-'}\n`;
        txtContent += `创建时间: ${dayjs(archive.createdAt).format('YYYY-MM-DD HH:mm')}\n`;
        txtContent += `更新时间: ${dayjs(archive.updatedAt).format('YYYY-MM-DD HH:mm')}\n`;
        txtContent += '-'.repeat(100) + '\n\n';
      });

      // 创建Blob并下载
      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `档案明细报表_${dayjs().format('YYYYMMDD_HHmmss')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  // 导出菜单
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'excel',
      label: '导出为Excel',
      icon: <FileExcelOutlined />,
      onClick: exportToExcel,
    },
    {
      key: 'txt',
      label: '导出为TXT',
      icon: <FileTextOutlined />,
      onClick: exportToTxt,
    },
  ];

  // 表格列定义
  const columns: ColumnsType<PhysicalArchive> = [
    {
      title: '档案编号',
      dataIndex: 'archiveNo',
      key: 'archiveNo',
      width: 150,
      fixed: 'left',
    },
    {
      title: '题名',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: 120,
    },
    {
      title: '全宗',
      dataIndex: 'fondsName',
      key: 'fondsName',
      width: 120,
    },
    {
      title: '年度',
      dataIndex: 'year',
      key: 'year',
      width: 80,
    },
    {
      title: '公司',
      dataIndex: 'companyCode',
      key: 'companyCode',
      width: 100,
    },
    {
      title: '库位',
      dataIndex: 'shelfLocation',
      key: 'shelfLocation',
      width: 120,
    },
    {
      title: '工作流状态',
      dataIndex: 'workflowStatus',
      key: 'workflowStatus',
      width: 110,
      render: (status: ArchiveWorkflowStatus) => WORKFLOW_STATUS_LABELS[status] || status,
    },
    {
      title: '在库状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: PhysicalArchiveStatus) => STATUS_LABELS[status],
    },
    {
      title: '借阅人',
      dataIndex: 'borrower',
      key: 'borrower',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="档案明细报表">
        {/* 筛选条件 */}
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="所属公司" name="companyCode">
                <Select placeholder="请选择公司" allowClear>
                  {companies.map((company) => (
                    <Option key={company.code} value={company.code}>
                      {company.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="档案分类" name="categoryId">
                <Select placeholder="请选择分类" allowClear>
                  {categories.map((category) => (
                    <Option key={category.id} value={category.id}>
                      {category.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="在库状态" name="status">
                <Select placeholder="请选择状态" allowClear>
                  <Option value="IN_STOCK">在库</Option>
                  <Option value="BORROWED">借出</Option>
                  <Option value="LOST">丢失</Option>
                  <Option value="DESTROYED">销毁</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="工作流状态" name="workflowStatus">
                <Select placeholder="请选择状态" allowClear>
                  <Option value="DRAFT">草稿</Option>
                  <Option value="PENDING_REVIEW">待审核</Option>
                  <Option value="ARCHIVED">已归档</Option>
                  <Option value="MODIFIED">已修改</Option>
                  <Option value="BORROWED">已借出</Option>
                  <Option value="RETURNED">已归还</Option>
                  <Option value="DESTROYED">已销毁</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="年度" name="year">
                <Select placeholder="请选择年度" allowClear>
                  {Array.from({ length: 30 }, (_, i) => dayjs().year() - i).map((year) => (
                    <Option key={year} value={year}>
                      {year}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="日期范围" name="dateRange">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="关键词搜索" name="search">
                <input
                  type="text"
                  placeholder="档案编号、题名"
                  style={{
                    width: '100%',
                    height: 32,
                    padding: '4px 11px',
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label=" ">
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                    查询
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {/* 操作按钮 */}
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Dropdown menu={{ items: exportMenuItems }} placement="bottomLeft">
              <Button type="primary" icon={<DownloadOutlined />}>
                导出数据
              </Button>
            </Dropdown>
            <span style={{ color: '#999' }}>
              共 {pagination?.total || 0} 条记录
            </span>
          </Space>
        </div>

        {/* 数据表格 */}
        <Table
          columns={columns}
          dataSource={archives}
          loading={isLoading}
          rowKey="id"
          scroll={{ x: 1800 }}
          pagination={{
            current: page,
            pageSize,
            total: pagination?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>
    </div>
  );
};

export default ArchiveReport;
