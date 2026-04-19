-- 为admin用户添加文档审查公司权限
-- 复制用户现有的公司权限到文档审查权限
INSERT INTO user_document_review_scopes (id, "userId", "companyCode", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text as id,
  "userId",
  "companyCode",
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM user_company_scopes
ON CONFLICT ("userId", "companyCode") DO NOTHING;
