import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Spin } from 'antd';
import { useAuthStore } from './stores/authStore';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import FileExplorer from './pages/FileExplorer';
import DocumentEditor from './pages/DocumentEditor';
import DocumentOffice from './pages/DocumentOffice';
import ShareAccess from './pages/ShareAccess';
import Profile from './pages/Profile';
import UserManagement from './pages/admin/UserManagement';
import RoleManagement from './pages/admin/RoleManagement';
import RepositoryManagement from './pages/admin/RepositoryManagement';
import SystemSettings from './pages/admin/SystemSettings';
import { PhysicalArchiveList, PhysicalArchiveForm, PhysicalArchiveDetail } from './pages/admin/physical-archives';
import ArchiveCategoryPage from './pages/admin/physical-archives/ArchiveCategoryPage';
import BorrowWorkflowConfigPage from './pages/admin/physical-archives/BorrowWorkflowConfigPage';
import BorrowApprovalPage from './pages/admin/physical-archives/BorrowApprovalPage';
import { DocumentReviewList, DocumentReviewForm, DocumentReviewDetail } from './pages/admin/document-reviews';
import ArchiveReport from './pages/ArchiveReport';
import { useSiteTheme } from './theme/ThemeProvider';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/" /> : <>{children}</>;
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
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route path="/share/:code" element={<ShareAccess />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="files" element={<FileExplorer />} />
        <Route path="files/:repoId" element={<FileExplorer />} />
        <Route path="files/:repoId/editor/:documentId" element={<DocumentEditor />} />
        <Route path="files/:repoId/office/:documentId" element={<DocumentOffice />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin/users" element={<UserManagement />} />
        <Route path="admin/roles" element={<RoleManagement />} />
        <Route path="admin/repositories" element={<RepositoryManagement />} />
        <Route path="admin/settings" element={<SystemSettings />} />
        <Route path="admin/physical-archives" element={<PhysicalArchiveList />} />
        <Route path="admin/physical-archives/create" element={<PhysicalArchiveForm />} />
        <Route path="admin/physical-archives/:id" element={<PhysicalArchiveDetail />} />
        <Route path="admin/physical-archives/:id/edit" element={<PhysicalArchiveForm />} />
        <Route path="admin/archive-categories" element={<ArchiveCategoryPage />} />
        <Route path="admin/borrow-workflow-config" element={<BorrowWorkflowConfigPage />} />
        <Route path="admin/borrow-approvals" element={<BorrowApprovalPage />} />
        <Route path="admin/document-reviews" element={<DocumentReviewList />} />
        <Route path="admin/document-reviews/new" element={<DocumentReviewForm />} />
        <Route path="admin/document-reviews/:id" element={<DocumentReviewDetail />} />
        <Route path="admin/document-reviews/:id/edit" element={<DocumentReviewForm />} />
        <Route path="reports/archives" element={<ArchiveReport />} />
      </Route>
    </Routes>
  );
}

export default App;
