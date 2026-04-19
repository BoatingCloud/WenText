-- 为普通用户角色添加基础文档审查权限
-- 普通用户应该能够：创建、查看自己的、编辑自己的、删除自己的

-- 获取普通用户角色ID和相关权限ID
DO $$
DECLARE
  user_role_id TEXT;
  perm_view_id TEXT;
  perm_create_id TEXT;
  perm_edit_own_id TEXT;
  perm_delete_own_id TEXT;
  perm_upload_id TEXT;
  perm_download_id TEXT;
  perm_add_annotation_id TEXT;
  perm_add_comment_id TEXT;
BEGIN
  -- 获取普通用户角色ID
  SELECT id INTO user_role_id FROM roles WHERE code = 'user';

  IF user_role_id IS NULL THEN
    RAISE NOTICE '普通用户角色不存在';
    RETURN;
  END IF;

  -- 获取权限ID
  SELECT id INTO perm_view_id FROM permissions WHERE code = 'doc-review:view';
  SELECT id INTO perm_create_id FROM permissions WHERE code = 'doc-review:create';
  SELECT id INTO perm_edit_own_id FROM permissions WHERE code = 'doc-review:edit-own';
  SELECT id INTO perm_delete_own_id FROM permissions WHERE code = 'doc-review:delete-own';
  SELECT id INTO perm_upload_id FROM permissions WHERE code = 'doc-review:upload-attachment';
  SELECT id INTO perm_download_id FROM permissions WHERE code = 'doc-review:download-attachment';
  SELECT id INTO perm_add_annotation_id FROM permissions WHERE code = 'doc-review:add-annotation';
  SELECT id INTO perm_add_comment_id FROM permissions WHERE code = 'doc-review:add-comment';

  -- 添加权限到普通用户角色
  INSERT INTO role_permissions (id, "roleId", "permissionId", "createdAt")
  VALUES
    (gen_random_uuid()::text, user_role_id, perm_view_id, NOW()),
    (gen_random_uuid()::text, user_role_id, perm_create_id, NOW()),
    (gen_random_uuid()::text, user_role_id, perm_edit_own_id, NOW()),
    (gen_random_uuid()::text, user_role_id, perm_delete_own_id, NOW()),
    (gen_random_uuid()::text, user_role_id, perm_upload_id, NOW()),
    (gen_random_uuid()::text, user_role_id, perm_download_id, NOW()),
    (gen_random_uuid()::text, user_role_id, perm_add_annotation_id, NOW()),
    (gen_random_uuid()::text, user_role_id, perm_add_comment_id, NOW())
  ON CONFLICT ("roleId", "permissionId") DO NOTHING;

  RAISE NOTICE '已为普通用户角色添加文档审查基础权限';
END $$;

-- 为档案员角色添加部门级文档审查权限
-- 档案员应该能够：查看本部门的、创建、编辑自己的、删除自己的

DO $$
DECLARE
  sxda_role_id TEXT;
  xada_role_id TEXT;
  perm_view_dept_id TEXT;
  perm_create_id TEXT;
  perm_edit_own_id TEXT;
  perm_delete_own_id TEXT;
  perm_upload_id TEXT;
  perm_download_id TEXT;
  perm_add_annotation_id TEXT;
  perm_add_comment_id TEXT;
BEGIN
  -- 获取档案员角色ID
  SELECT id INTO sxda_role_id FROM roles WHERE code = 'SXDA';
  SELECT id INTO xada_role_id FROM roles WHERE code = 'XADA';

  -- 获取权限ID
  SELECT id INTO perm_view_dept_id FROM permissions WHERE code = 'doc-review:view-dept';
  SELECT id INTO perm_create_id FROM permissions WHERE code = 'doc-review:create';
  SELECT id INTO perm_edit_own_id FROM permissions WHERE code = 'doc-review:edit-own';
  SELECT id INTO perm_delete_own_id FROM permissions WHERE code = 'doc-review:delete-own';
  SELECT id INTO perm_upload_id FROM permissions WHERE code = 'doc-review:upload-attachment';
  SELECT id INTO perm_download_id FROM permissions WHERE code = 'doc-review:download-attachment';
  SELECT id INTO perm_add_annotation_id FROM permissions WHERE code = 'doc-review:add-annotation';
  SELECT id INTO perm_add_comment_id FROM permissions WHERE code = 'doc-review:add-comment';

  -- 为SXDA角色添加权限
  IF sxda_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (id, "roleId", "permissionId", "createdAt")
    VALUES
      (gen_random_uuid()::text, sxda_role_id, perm_view_dept_id, NOW()),
      (gen_random_uuid()::text, sxda_role_id, perm_create_id, NOW()),
      (gen_random_uuid()::text, sxda_role_id, perm_edit_own_id, NOW()),
      (gen_random_uuid()::text, sxda_role_id, perm_delete_own_id, NOW()),
      (gen_random_uuid()::text, sxda_role_id, perm_upload_id, NOW()),
      (gen_random_uuid()::text, sxda_role_id, perm_download_id, NOW()),
      (gen_random_uuid()::text, sxda_role_id, perm_add_annotation_id, NOW()),
      (gen_random_uuid()::text, sxda_role_id, perm_add_comment_id, NOW())
    ON CONFLICT ("roleId", "permissionId") DO NOTHING;
    RAISE NOTICE '已为SXDA角色添加文档审查部门权限';
  END IF;

  -- 为XADA角色添加权限
  IF xada_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (id, "roleId", "permissionId", "createdAt")
    VALUES
      (gen_random_uuid()::text, xada_role_id, perm_view_dept_id, NOW()),
      (gen_random_uuid()::text, xada_role_id, perm_create_id, NOW()),
      (gen_random_uuid()::text, xada_role_id, perm_edit_own_id, NOW()),
      (gen_random_uuid()::text, xada_role_id, perm_delete_own_id, NOW()),
      (gen_random_uuid()::text, xada_role_id, perm_upload_id, NOW()),
      (gen_random_uuid()::text, xada_role_id, perm_download_id, NOW()),
      (gen_random_uuid()::text, xada_role_id, perm_add_annotation_id, NOW()),
      (gen_random_uuid()::text, xada_role_id, perm_add_comment_id, NOW())
    ON CONFLICT ("roleId", "permissionId") DO NOTHING;
    RAISE NOTICE '已为XADA角色添加文档审查部门权限';
  END IF;
END $$;
