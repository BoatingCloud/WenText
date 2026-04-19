import React from 'react';
import { Card, Descriptions, Tag, Alert, List, Progress, Collapse, Empty, Space, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  SafetyOutlined,
  FileTextOutlined,
  BugOutlined,
  AuditOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import type { AIReviewResult } from '../../services/api';

const { Panel } = Collapse;
const { Text, Paragraph } = Typography;

interface AIReviewResultProps {
  result: AIReviewResult;
  loading?: boolean;
}

const AIReviewResultComponent: React.FC<AIReviewResultProps> = ({ result, loading }) => {
  if (loading) {
    return (
      <Card loading={loading}>
        <Empty description="正在加载审查结果..." />
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <Empty description="暂无审查结果" />
      </Card>
    );
  }

  // 风险等级颜色映射
  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'LOW':
        return 'success';
      case 'MEDIUM':
        return 'warning';
      case 'HIGH':
        return 'error';
      case 'CRITICAL':
        return 'error';
      default:
        return 'default';
    }
  };

  // 风险等级文本映射
  const getRiskLevelText = (level: string) => {
    switch (level) {
      case 'LOW':
        return '低风险';
      case 'MEDIUM':
        return '中风险';
      case 'HIGH':
        return '高风险';
      case 'CRITICAL':
        return '严重风险';
      default:
        return level;
    }
  };

  // 严重程度中文映射
  const getSeverityText = (severity: string) => {
    const map: Record<string, string> = {
      LOW: '低',
      MEDIUM: '中',
      HIGH: '高',
      CRITICAL: '严重',
    };
    return map[severity] || severity;
  };

  // 重要性中文映射
  const getImportanceText = (importance: string) => {
    const map: Record<string, string> = {
      LOW: '低',
      MEDIUM: '中',
      HIGH: '高',
      CRITICAL: '关键',
    };
    return map[importance] || importance;
  };

  // 合规状态图标
  const getComplianceIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'FAIL':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'WARNING':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      default:
        return null;
    }
  };

  // 合规状态文本
  const getComplianceText = (status: string) => {
    switch (status) {
      case 'PASS':
        return '通过';
      case 'FAIL':
        return '不通过';
      case 'WARNING':
        return '警告';
      default:
        return status;
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 风险评估总览 */}
      <Card title={<><SafetyOutlined /> 风险评估总览</>}>
        <Descriptions column={2}>
          <Descriptions.Item label="审查时间">
            {new Date(result.reviewedAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="使用模型">
            {result.model}
          </Descriptions.Item>
          <Descriptions.Item label="风险等级">
            <Tag color={getRiskLevelColor(result.riskLevel)} icon={<WarningOutlined />}>
              {getRiskLevelText(result.riskLevel)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="风险评分">
            <Progress
              percent={result.riskScore}
              status={result.riskScore > 70 ? 'exception' : result.riskScore > 40 ? 'normal' : 'success'}
              strokeColor={result.riskScore > 70 ? '#ff4d4f' : result.riskScore > 40 ? '#faad14' : '#52c41a'}
            />
          </Descriptions.Item>
        </Descriptions>

        {result.summary && (
          <Alert
            message="总体评价"
            description={result.summary}
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* 详细审查结果 - 默认折叠 */}
      <Collapse>
        {/* 风险点 */}
        {result.risks && result.risks.length > 0 && (
          <Panel
            header={
              <Space>
                <WarningOutlined style={{ color: '#ff4d4f' }} />
                <Text strong>风险点 ({result.risks.length})</Text>
              </Space>
            }
            key="risks"
          >
            <List
              dataSource={result.risks}
              renderItem={(risk) => (
                <List.Item>
                  <Card
                    size="small"
                    style={{ width: '100%' }}
                    title={
                      <Space>
                        <Tag color="red">{getSeverityText(risk.severity)}</Tag>
                        <Text strong>{risk.category}</Text>
                      </Space>
                    }
                  >
                    <Paragraph>{risk.description}</Paragraph>
                    {risk.location && (
                      <Text type="secondary">
                        <FileTextOutlined /> 位置：{risk.location}
                      </Text>
                    )}
                    {risk.suggestion && (
                      <Alert
                        message="建议"
                        description={risk.suggestion}
                        type="warning"
                        showIcon
                        style={{ marginTop: 8 }}
                      />
                    )}
                  </Card>
                </List.Item>
              )}
            />
          </Panel>
        )}

        {/* 关键点 */}
        {result.keyPoints && result.keyPoints.length > 0 && (
          <Panel
            header={
              <Space>
                <FileTextOutlined style={{ color: '#1890ff' }} />
                <Text strong>关键点 ({result.keyPoints.length})</Text>
              </Space>
            }
            key="keyPoints"
          >
            <List
              dataSource={result.keyPoints}
              renderItem={(point) => (
                <List.Item>
                  <Card size="small" style={{ width: '100%' }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Tag color="blue">{point.type}</Tag>
                        <Tag>{getImportanceText(point.importance)}</Tag>
                      </Space>
                      <Paragraph>{point.content}</Paragraph>
                      {point.note && <Text type="secondary">备注：{point.note}</Text>}
                    </Space>
                  </Card>
                </List.Item>
              )}
            />
          </Panel>
        )}

        {/* 漏洞和缺失项 */}
        {result.gaps && result.gaps.length > 0 && (
          <Panel
            header={
              <Space>
                <BugOutlined style={{ color: '#faad14' }} />
                <Text strong>漏洞和缺失项 ({result.gaps.length})</Text>
              </Space>
            }
            key="gaps"
          >
            <List
              dataSource={result.gaps}
              renderItem={(gap) => (
                <List.Item>
                  <Card
                    size="small"
                    style={{ width: '100%' }}
                    title={<Tag color="orange">{gap.type}</Tag>}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Paragraph>{gap.description}</Paragraph>
                      {gap.impact && (
                        <Alert
                          message="影响"
                          description={gap.impact}
                          type="warning"
                          showIcon
                          style={{ marginBottom: 8 }}
                        />
                      )}
                      {gap.recommendation && (
                        <Alert
                          message="建议"
                          description={gap.recommendation}
                          type="info"
                          showIcon
                        />
                      )}
                    </Space>
                  </Card>
                </List.Item>
              )}
            />
          </Panel>
        )}

        {/* 合规性检查 */}
        {result.compliance && result.compliance.length > 0 && (
          <Panel
            header={
              <Space>
                <AuditOutlined style={{ color: '#52c41a' }} />
                <Text strong>合规性检查 ({result.compliance.length})</Text>
              </Space>
            }
            key="compliance"
          >
            <List
              dataSource={result.compliance}
              renderItem={(item) => (
                <List.Item>
                  <Space style={{ width: '100%' }} direction="vertical">
                    <Space>
                      {getComplianceIcon(item.status)}
                      <Text strong>{item.item}</Text>
                      <Tag color={item.status === 'PASS' ? 'success' : item.status === 'FAIL' ? 'error' : 'warning'}>
                        {getComplianceText(item.status)}
                      </Tag>
                    </Space>
                    <Text type="secondary">{item.detail}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Panel>
        )}

        {/* 总体建议 */}
        {result.recommendations && result.recommendations.length > 0 && (
          <Panel
            header={
              <Space>
                <BulbOutlined style={{ color: '#faad14' }} />
                <Text strong>总体建议 ({result.recommendations.length})</Text>
              </Space>
            }
            key="recommendations"
          >
            <List
              dataSource={result.recommendations}
              renderItem={(recommendation, index) => (
                <List.Item>
                  <Space>
                    <Tag color="gold">{index + 1}</Tag>
                    <Text>{recommendation}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Panel>
        )}
      </Collapse>
    </Space>
  );
};

export default AIReviewResultComponent;
