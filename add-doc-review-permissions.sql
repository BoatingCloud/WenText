-- 添加文档审查权限
INSERT INTO permissions (id, code, name, description, module, "createdAt")
VALUES
  (gen_random_uuid()::text, 'doc-review:view', '查看文档审查', '查看自己发起的文档审查', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:view-dept', '查看部门文档审查', '查看本部门的文档审查', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:view-all', '查看所有文档审查', '查看所有文档审查记录', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:create', '创建文档审查', '创建新的文档审查', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:edit-own', '编辑自己的文档审查', '编辑自己发起的文档审查', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:edit', '编辑所有文档审查', '编辑所有文档审查记录', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:delete-own', '删除自己的文档审查', '删除自己发起的文档审查', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:delete', '删除所有文档审查', '删除所有文档审查记录', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:submit', '提交审查', '提交文档审查到工作流', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:approve', '审批文档', '审批文档审查', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:reject', '驳回文档', '驳回文档审查', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:cancel', '取消审查', '取消文档审查', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:upload-attachment', '上传附件', '上传文档审查附件', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:delete-attachment', '删除附件', '删除文档审查附件', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:download-attachment', '下载附件', '下载文档审查附件', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:add-annotation', '添加标注', '添加人工标注', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:edit-annotation', '编辑标注', '编辑人工标注', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:delete-annotation', '删除标注', '删除人工标注', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:add-comment', '添加评论', '添加标注评论', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:delete-comment', '删除评论', '删除标注评论', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:trigger-ai', '触发AI审查', '触发AI自动审查', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:view-ai-result', '查看AI结果', '查看AI审查结果', 'doc-review', NOW()),
  (gen_random_uuid()::text, 'doc-review:export', '导出审查报告', '导出文档审查报告', 'doc-review', NOW())
ON CONFLICT (code) DO NOTHING;

-- 为admin角色添加所有文档审查权限
INSERT INTO role_permissions (id, "roleId", "permissionId", "createdAt")
SELECT
  gen_random_uuid()::text as id,
  r.id as "roleId",
  p.id as "permissionId",
  NOW() as "createdAt"
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'admin'
  AND p.module = 'doc-review'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );
