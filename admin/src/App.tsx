import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Spin } from 'antd';
import { useAuthStore } from './stores/authStore';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Repositories from './pages/Repositories';
import { PhysicalArchiveList, PhysicalArchiveForm, PhysicalArchiveDetail } from './pages/physical-archives';
import ArchiveCategoryPage from './pages/physical-archives/ArchiveCategoryPage';
import BorrowWorkflowConfigPage from './pages/physical-archives/BorrowWorkflowConfigPage';
import BorrowApprovalPage from './pages/physical-archives/BorrowApprovalPage';
import ReviewWorkflowConfig from './pages/ReviewWorkflowConfig';
import DocumentReviews from './pages/DocumentReviews';
import AuditLogs from './pages/AuditLogs';
import SystemConfig from './pages/SystemConfig';
import { useSiteTheme } from './theme/ThemeProvider';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, hasPermission } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (!hasPermission('system:manage') && !hasPermission('user:view') && !hasPermission('archive:view')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2>权限不足</h2>
          <p>您没有访问管理后台的权限</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  const { fetchUser, isLoading } = useAuthStore();
  const { isReady } = useSiteTheme();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (isLoading || !isReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="roles" element={<Roles />} />
        <Route path="repositories" element={<Repositories />} />
        <Route path="physical-archives" element={<PhysicalArchiveList />} />
        <Route path="physical-archives/create" element={<PhysicalArchiveForm />} />
        <Route path="physical-archives/:id" element={<PhysicalArchiveDetail />} />
        <Route path="physical-archives/:id/edit" element={<PhysicalArchiveForm />} />
        <Route path="archive-categories" element={<ArchiveCategoryPage />} />
        <Route path="borrow-workflow-config" element={<BorrowWorkflowConfigPage />} />
        <Route path="borrow-approvals" element={<BorrowApprovalPage />} />
        <Route path="review-workflow-config" element={<ReviewWorkflowConfig />} />
        <Route path="document-reviews" element={<DocumentReviews />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="system-config" element={<SystemConfig />} />
      </Route>
    </Routes>
  );
}

export default App;
