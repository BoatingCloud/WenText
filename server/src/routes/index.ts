import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import roleRoutes from './role.routes.js';
import departmentRoutes from './department.routes.js';
import repositoryRoutes from './repository.routes.js';
import documentRoutes from './document.routes.js';
import physicalArchiveRoutes from './physical-archive.routes.js';
import shareRoutes from './share.routes.js';
import searchRoutes from './search.routes.js';
import systemConfigRoutes from './system-config.routes.js';
import auditLogRoutes from './audit-log.routes.js';
import archiveCategoryRoutes from './archive-category.routes.js';
import borrowWorkflowRoutes from './borrow-workflow.routes.js';
import borrowRequestRoutes from './borrow-request.routes.js';
import approvalTodoRoutes from './approval-todo.routes.js';
import statisticsRoutes from './statistics.routes.js';
import unifiedBorrowRoutes from './unified-borrow.routes.js';
import documentReviewRoutes from './document-review.routes.js';
import reviewWorkflowRoutes from './review-workflow.routes.js';
import annotationRoutes from './annotation.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/departments', departmentRoutes);
router.use('/repositories', repositoryRoutes);
router.use('/documents', documentRoutes);
router.use('/physical-archives', physicalArchiveRoutes);
router.use('/shares', shareRoutes);
router.use('/search', searchRoutes);
router.use('/system-config', systemConfigRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/archive-categories', archiveCategoryRoutes);
router.use('/borrow-workflows', borrowWorkflowRoutes);
router.use('/borrow-requests', borrowRequestRoutes);
router.use('/approval-todos', approvalTodoRoutes);
router.use('/statistics', statisticsRoutes);
router.use('/unified-borrow', unifiedBorrowRoutes);
router.use('/document-reviews', documentReviewRoutes);
router.use('/review-workflows', reviewWorkflowRoutes);
router.use('/annotations', annotationRoutes);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

export default router;
