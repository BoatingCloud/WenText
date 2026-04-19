import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  DatePicker,
  Select,
  Button,
  Space,
  Tabs,
  App,
  Spin,
} from 'antd';
import {
  BarChartOutlined,
  FileTextOutlined,
  FolderOutlined,
  SwapOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import {
  statisticsApi,
  systemConfigApi,
  archiveCategoryApi,
  type StatisticsFilters,
} from '../services/api';
import { useCompanyScopeStore } from '../stores/companyScopeStore';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: '在库',
  BORROWED: '借出',
  LOST: '丢失',
  DESTROYED: '销毁',
};

const StatisticsReport: React.FC = () => {
  const { message } = App.useApp();
  const { selectedCompanyCode } = useCompanyScopeStore();

  const [activeTab, setActiveTab] = useState<'archive' | 'document' | 'borrow'>('archive');
  const [filters, setFilters] = useState<StatisticsFilters>({
    companyCode: selectedCompanyCode || undefined,
  });

  // 获取系统配置（公司和全宗列表）
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
  const fondsList: any[] = (configData?.data.data as any)?.fondsCatalog || [];
  const categories = categoriesData?.data.data || [];

  // 获取档案统计数据
  const {
    data: archiveStats,
    isLoading: archiveLoading,
    refetch: refetchArchive,
  } = useQuery({
    queryKey: ['statistics-archive', filters],
    queryFn: () => statisticsApi.getArchiveStatistics(filters),
    enabled: activeTab === 'archive',
  });

  // 获取文档统计数据
  const {
    data: documentStats,
    isLoading: documentLoading,
    refetch: refetchDocument,
  } = useQuery({
    queryKey: ['statistics-document', filters],
    queryFn: () =>
      statisticsApi.getDocumentStatistics({
        companyCode: filters.companyCode,
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
    enabled: activeTab === 'document',
  });

  // 获取借阅统计数据
  const {
    data: borrowStats,
    isLoading: borrowLoading,
    refetch: refetchBorrow,
  } = useQuery({
    queryKey: ['statistics-borrow', filters],
    queryFn: () =>
      statisticsApi.getBorrowStatistics({
        companyCode: filters.companyCode,
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
    enabled: activeTab === 'borrow',
  });

  useEffect(() => {
    setFilters((prev) => ({ ...prev, companyCode: selectedCompanyCode || undefined }));
  }, [selectedCompanyCode]);

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setFilters({
        ...filters,
        startDate: dates[0].toISOString(),
        endDate: dates[1].toISOString(),
      });
    } else {
      const { startDate, endDate, ...rest } = filters;
      setFilters(rest);
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'archive') refetchArchive();
    else if (activeTab === 'document') refetchDocument();
    else refetchBorrow();
  };

  const handleReset = () => {
    setFilters({ companyCode: selectedCompanyCode || undefined });
  };

  // 导出为Excel
  const exportToExcel = () => {
    try {
      let workbook: XLSX.WorkBook;
      let fileName = '';

      if (activeTab === 'archive' && archiveStats?.data.data) {
        const data = archiveStats.data.data;
        workbook = XLSX.utils.book_new();

        // 概览数据
        const summaryData = [
          ['档案统计报表'],
          ['生成时间', dayjs().format('YYYY-MM-DD HH:mm:ss')],
          [],
          ['档案总数', data.totalCount],
          [],
          ['按状态统计'],
          ['状态', '数量'],
          ...Object.entries(data.byStatus).map(([status, count]) => [
            STATUS_LABELS[status] || status,
            count,
          ]),
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, '概览');

        // 按公司统计
        if (data.byCompany && data.byCompany.length > 0) {
          const companyData = [
            ['公司代码', '数量'],
            ...data.byCompany.map((item: any) => [item.companyCode || '未分配', item.count]),
          ];
          const companySheet = XLSX.utils.aoa_to_sheet(companyData);
          XLSX.utils.book_append_sheet(workbook, companySheet, '按公司统计');
        }

        // 按分类统计
        if (data.byCategory && data.byCategory.length > 0) {
          const categoryData = [
            ['分类名称', '数量'],
            ...data.byCategory.map((item: any) => [item.categoryName || '未分类', item.count]),
          ];
          const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
          XLSX.utils.book_append_sheet(workbook, categorySheet, '按分类统计');
        }

        // 按全宗统计
        if (data.byFonds && data.byFonds.length > 0) {
          const fondsData = [
            ['全宗名称', '数量'],
            ...data.byFonds.map((item: any) => [item.fondsName || '未分配', item.count]),
          ];
          const fondsSheet = XLSX.utils.aoa_to_sheet(fondsData);
          XLSX.utils.book_append_sheet(workbook, fondsSheet, '按全宗统计');
        }

        // 按年度统计
        if (data.byYear && data.byYear.length > 0) {
          const yearData = [
            ['年度', '数量'],
            ...data.byYear.map((item: any) => [item.year, item.count]),
          ];
          const yearSheet = XLSX.utils.aoa_to_sheet(yearData);
          XLSX.utils.book_append_sheet(workbook, yearSheet, '按年度统计');
        }

        // 按月份统计
        if (data.byMonth && data.byMonth.length > 0) {
          const monthData = [
            ['月份', '数量'],
            ...data.byMonth.map((item: any) => [item.month, item.count]),
          ];
          const monthSheet = XLSX.utils.aoa_to_sheet(monthData);
          XLSX.utils.book_append_sheet(workbook, monthSheet, '按月份统计');
        }

        fileName = `档案统计报表_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
      } else if (activeTab === 'document' && documentStats?.data.data) {
        const data = documentStats.data.data;
        workbook = XLSX.utils.book_new();

        // 概览数据
        const summaryData = [
          ['文档统计报表'],
          ['生成时间', dayjs().format('YYYY-MM-DD HH:mm:ss')],
          [],
          ['文档总数', data.totalCount],
          ['总大小', formatSize(data.totalSize)],
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, '概览');

        // 按仓库统计
        if (data.byRepository && data.byRepository.length > 0) {
          const repoData = [
            ['仓库名称', '文档数量', '总大小'],
            ...data.byRepository.map((item: any) => [
              item.repositoryName,
              item.count,
              formatSize(item.size),
            ]),
          ];
          const repoSheet = XLSX.utils.aoa_to_sheet(repoData);
          XLSX.utils.book_append_sheet(workbook, repoSheet, '按仓库统计');
        }

        // 按文件类型统计
        if (data.byType && data.byType.length > 0) {
          const typeData = [
            ['文件类型', '文档数量', '总大小'],
            ...data.byType.map((item: any) => [
              item.extension || '无扩展名',
              item.count,
              formatSize(item.size),
            ]),
          ];
          const typeSheet = XLSX.utils.aoa_to_sheet(typeData);
          XLSX.utils.book_append_sheet(workbook, typeSheet, '按类型统计');
        }

        // 按创建人统计
        if (data.byCreator && data.byCreator.length > 0) {
          const creatorData = [
            ['创建人', '文档数量'],
            ...data.byCreator.map((item: any) => [item.creatorName, item.count]),
          ];
          const creatorSheet = XLSX.utils.aoa_to_sheet(creatorData);
          XLSX.utils.book_append_sheet(workbook, creatorSheet, '按创建人统计');
        }

        fileName = `文档统计报表_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
      } else if (activeTab === 'borrow' && borrowStats?.data.data) {
        const data = borrowStats.data.data;
        workbook = XLSX.utils.book_new();

        // 概览数据
        const summaryData = [
          ['借阅统计报表'],
          ['生成时间', dayjs().format('YYYY-MM-DD HH:mm:ss')],
          [],
          ['总借阅次数', data.totalBorrowCount],
          ['总归还次数', data.totalReturnCount],
          ['当前借出数量', data.currentBorrowedCount],
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, '概览');

        // 按用户统计
        if (data.byUser && data.byUser.length > 0) {
          const userData = [
            ['用户名', '借阅次数', '归还次数'],
            ...data.byUser.map((item: any) => [
              item.userName,
              item.borrowCount,
              item.returnCount,
            ]),
          ];
          const userSheet = XLSX.utils.aoa_to_sheet(userData);
          XLSX.utils.book_append_sheet(workbook, userSheet, '按用户统计');
        }

        // 按档案统计
        if (data.byArchive && data.byArchive.length > 0) {
          const archiveData = [
            ['档案标题', '借阅次数'],
            ...data.byArchive.map((item: any) => [item.archiveTitle, item.borrowCount]),
          ];
          const archiveSheet = XLSX.utils.aoa_to_sheet(archiveData);
          XLSX.utils.book_append_sheet(workbook, archiveSheet, '按档案统计');
        }

        fileName = `借阅统计报表_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
      } else {
        message.warning('暂无数据可导出');
        return;
      }

      // 导出Excel文件
      XLSX.writeFile(workbook, fileName);
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 渲染档案统计
  const renderArchiveStatistics = () => {
    if (archiveLoading) return <Spin />;
    if (!archiveStats?.data.data) return null;

    const data = archiveStats.data.data;

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 概览卡片 */}
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="档案总数"
                value={data.totalCount}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="在库数量"
                value={data.byStatus.IN_STOCK}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="借出数量"
                value={data.byStatus.BORROWED}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="丢失/销毁"
                value={data.byStatus.LOST + data.byStatus.DESTROYED}
                valueStyle={{ color: '#999' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 按状态统计表 */}
        <Card title="按状态统计">
          <Table
            dataSource={Object.entries(data.byStatus).map(([status, count]) => ({
              key: status,
              status: STATUS_LABELS[status] || status,
              count,
            }))}
            columns={[
              { title: '状态', dataIndex: 'status', key: 'status' },
              { title: '数量', dataIndex: 'count', key: 'count' },
            ]}
            pagination={false}
          />
        </Card>

        {/* 按公司统计表 */}
        {data.byCompany.length > 0 && (
          <Card title="按公司统计">
            <Table
              dataSource={data.byCompany}
              columns={[
                { title: '公司代码', dataIndex: 'companyCode', key: 'companyCode' },
                { title: '数量', dataIndex: 'count', key: 'count' },
              ]}
              pagination={false}
              rowKey="companyCode"
            />
          </Card>
        )}

        {/* 按分类统计表 */}
        {data.byCategory.length > 0 && (
          <Card title="按分类统计">
            <Table
              dataSource={data.byCategory}
              columns={[
                { title: '分类名称', dataIndex: 'categoryName', key: 'categoryName' },
                { title: '数量', dataIndex: 'count', key: 'count' },
              ]}
              pagination={{ pageSize: 10 }}
              rowKey="categoryId"
            />
          </Card>
        )}

        {/* 按全宗统计表 */}
        {data.byFonds.length > 0 && (
          <Card title="按全宗统计">
            <Table
              dataSource={data.byFonds}
              columns={[
                { title: '全宗名称', dataIndex: 'fondsName', key: 'fondsName' },
                { title: '数量', dataIndex: 'count', key: 'count' },
              ]}
              pagination={false}
              rowKey="fondsName"
            />
          </Card>
        )}

        {/* 按年份统计表 */}
        {data.byYear.length > 0 && (
          <Card title="按年份统计">
            <Table
              dataSource={data.byYear}
              columns={[
                { title: '年份', dataIndex: 'year', key: 'year' },
                { title: '数量', dataIndex: 'count', key: 'count' },
              ]}
              pagination={{ pageSize: 10 }}
              rowKey="year"
            />
          </Card>
        )}
      </Space>
    );
  };

  // 渲染文档统计
  const renderDocumentStatistics = () => {
    if (documentLoading) return <Spin />;
    if (!documentStats?.data.data) return null;

    const data = documentStats.data.data;

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 概览卡片 */}
        <Row gutter={16}>
          <Col span={12}>
            <Card>
              <Statistic
                title="文件总数"
                value={data.totalCount}
                prefix={<FolderOutlined />}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card>
              <Statistic
                title="总存储大小"
                value={formatSize(data.totalSize)}
              />
            </Card>
          </Col>
        </Row>

        {/* 按仓库统计表 */}
        <Card title="按仓库统计">
          <Table
            dataSource={data.byRepository}
            columns={[
              { title: '仓库名称', dataIndex: 'repositoryName', key: 'repositoryName' },
              { title: '文件数量', dataIndex: 'count', key: 'count' },
              {
                title: '总大小',
                dataIndex: 'size',
                key: 'size',
                render: (size: number) => formatSize(size),
              },
            ]}
            pagination={false}
            rowKey="repositoryId"
          />
        </Card>

        {/* 按文件类型统计表 */}
        <Card title="按文件类型统计">
          <Table
            dataSource={data.byType}
            columns={[
              { title: '文件类型', dataIndex: 'extension', key: 'extension' },
              { title: '数量', dataIndex: 'count', key: 'count' },
              {
                title: '总大小',
                dataIndex: 'size',
                key: 'size',
                render: (size: number) => formatSize(size),
              },
            ]}
            pagination={{ pageSize: 10 }}
            rowKey="extension"
          />
        </Card>

        {/* 按创建者统计表 */}
        <Card title="按创建者统计">
          <Table
            dataSource={data.byCreator}
            columns={[
              { title: '创建者', dataIndex: 'creatorName', key: 'creatorName' },
              { title: '文件数量', dataIndex: 'count', key: 'count' },
            ]}
            pagination={{ pageSize: 10 }}
            rowKey="creatorId"
          />
        </Card>
      </Space>
    );
  };

  // 渲染借阅统计
  const renderBorrowStatistics = () => {
    if (borrowLoading) return <Spin />;
    if (!borrowStats?.data.data) return null;

    const data = borrowStats.data.data;

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 概览卡片 */}
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="总借出次数"
                value={data.totalBorrowCount}
                prefix={<SwapOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="总归还次数"
                value={data.totalReturnCount}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="当前借出数量"
                value={data.currentBorrowedCount}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 按用户统计表 */}
        <Card title="按用户统计">
          <Table
            dataSource={data.byUser}
            columns={[
              { title: '用户名称', dataIndex: 'userName', key: 'userName' },
              { title: '借出次数', dataIndex: 'borrowCount', key: 'borrowCount' },
              { title: '归还次数', dataIndex: 'returnCount', key: 'returnCount' },
            ]}
            pagination={{ pageSize: 10 }}
            rowKey="userId"
          />
        </Card>

        {/* 按档案统计表 */}
        <Card title="按档案统计（借出次数最多）">
          <Table
            dataSource={data.byArchive.sort((a, b) => b.borrowCount - a.borrowCount).slice(0, 20)}
            columns={[
              { title: '档案标题', dataIndex: 'archiveTitle', key: 'archiveTitle' },
              { title: '借出次数', dataIndex: 'borrowCount', key: 'borrowCount' },
            ]}
            pagination={false}
            rowKey="archiveId"
          />
        </Card>
      </Space>
    );
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <BarChartOutlined />
            统计报表
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
            <Button icon={<DownloadOutlined />} type="primary" onClick={exportToExcel}>
              导出Excel
            </Button>
          </Space>
        }
      >
        {/* 筛选条件 */}
        <Space wrap style={{ marginBottom: 16 }}>
          {companies.length > 0 && (
            <Select
              placeholder="选择公司"
              style={{ width: 200 }}
              value={filters.companyCode}
              onChange={(value) => setFilters({ ...filters, companyCode: value })}
              allowClear
            >
              {companies.map((company: any) => (
                <Option key={company.code} value={company.code}>
                  {company.name}
                </Option>
              ))}
            </Select>
          )}

          <RangePicker
            placeholder={['开始日期', '结束日期']}
            onChange={handleDateRangeChange}
            value={
              filters.startDate && filters.endDate
                ? [dayjs(filters.startDate), dayjs(filters.endDate)]
                : null
            }
          />

          {activeTab === 'archive' && (
            <>
              {categories.length > 0 && (
                <Select
                  placeholder="选择档案分类"
                  style={{ width: 200 }}
                  value={filters.categoryId}
                  onChange={(value) => setFilters({ ...filters, categoryId: value })}
                  allowClear
                >
                  {categories.map((category) => (
                    <Option key={category.id} value={category.id}>
                      {category.name}
                    </Option>
                  ))}
                </Select>
              )}

              {fondsList.length > 0 && (
                <Select
                  placeholder="选择全宗"
                  style={{ width: 200 }}
                  value={filters.fondsName}
                  onChange={(value) => setFilters({ ...filters, fondsName: value })}
                  allowClear
                >
                  {fondsList.map((fonds: any) => (
                    <Option key={fonds.code} value={fonds.name}>
                      {fonds.name}
                    </Option>
                  ))}
                </Select>
              )}

              <Select
                placeholder="选择在库状态"
                style={{ width: 150 }}
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value })}
                allowClear
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <Option key={value} value={value}>
                    {label}
                  </Option>
                ))}
              </Select>
            </>
          )}

          <Button onClick={handleReset}>重置</Button>
        </Space>

        {/* 统计内容标签页 */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'archive' | 'document' | 'borrow')}
          items={[
            {
              key: 'archive',
              label: '档案统计',
              children: renderArchiveStatistics(),
            },
            {
              key: 'document',
              label: '文档统计',
              children: renderDocumentStatistics(),
            },
            {
              key: 'borrow',
              label: '借阅统计',
              children: renderBorrowStatistics(),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default StatisticsReport;
