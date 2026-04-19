import { useState } from 'react';
import { Card, Tabs } from 'antd';
import AIConfigForm from '../../components/admin/AIConfigForm';

const SystemSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ai');

  return (
    <Card title="系统设置">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'ai',
            label: 'AI配置',
            children: <AIConfigForm />,
          },
          {
            key: 'basic',
            label: '基本设置',
            children: <div>基本设置（待实现）</div>,
          },
        ]}
      />
    </Card>
  );
};

export default SystemSettings;
