import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据库...');

  // 创建权限 - 权限码需与路由中的 requirePermission 一致
  const permissions = [
    // 用户管理权限
    { code: 'user:view', name: '查看用户', module: 'USER' },
    { code: 'user:create', name: '创建用户', module: 'USER' },
    { code: 'user:update', name: '更新用户', module: 'USER' },
    { code: 'user:delete', name: '删除用户', module: 'USER' },
    // 角色管理权限
    { code: 'role:view', name: '查看角色', module: 'ROLE' },
    { code: 'role:manage', name: '管理角色', module: 'ROLE' },
    // 仓库管理权限
    { code: 'repo:view', name: '查看仓库', module: 'REPO' },
    { code: 'repo:create', name: '创建仓库', module: 'REPO' },
    { code: 'repo:manage', name: '管理仓库', module: 'REPO' },
    // 文档操作权限
    { code: 'doc:view', name: '查看文档', module: 'DOC' },
    { code: 'doc:upload', name: '上传文档', module: 'DOC' },
    { code: 'doc:edit', name: '编辑文档', module: 'DOC' },
    { code: 'doc:delete', name: '删除文档', module: 'DOC' },
    { code: 'doc:version', name: '版本管理', module: 'DOC' },
    { code: 'doc:share', name: '分享文档', module: 'DOC' },
    // 实体档案权限
    { code: 'archive:view', name: '查看实体档案', module: 'ARCHIVE' },
    { code: 'archive:create', name: '创建实体档案', module: 'ARCHIVE' },
    { code: 'archive:update', name: '更新实体档案', module: 'ARCHIVE' },
    { code: 'archive:delete', name: '删除实体档案', module: 'ARCHIVE' },
    { code: 'archive:approve', name: '审核实体档案', module: 'ARCHIVE' },
    { code: 'archive:borrow', name: '借阅实体档案', module: 'ARCHIVE' },
    { code: 'archive:return', name: '归还实体档案', module: 'ARCHIVE' },
    { code: 'archive:workflow-config', name: '配置借阅工作流', module: 'ARCHIVE' },
    { code: 'archive:category-manage', name: '管理档案分类', module: 'ARCHIVE' },
    // 搜索权限
    { code: 'search:basic', name: '基本搜索', module: 'SEARCH' },
    // 系统管理权限
    { code: 'system:config', name: '系统配置', module: 'SYSTEM' },
    { code: 'system:manage', name: '系统管理', module: 'SYSTEM' },
    { code: 'system:audit', name: '查看审计日志', module: 'SYSTEM' },
    { code: 'audit:view', name: '审计日志查看', module: 'AUDIT' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module },
      create: perm,
    });
  }
  console.log(`创建了 ${permissions.length} 个权限`);

  // 创建管理员角色
  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    update: {},
    create: {
      name: '系统管理员',
      code: 'admin',
      description: '拥有系统所有权限',
      isSystem: true,
    },
  });

  // 给管理员角色分配所有权限
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
  }
  console.log('创建了管理员角色并分配权限');

  // 创建普通用户角色
  const userRole = await prisma.role.upsert({
    where: { code: 'user' },
    update: {},
    create: {
      name: '普通用户',
      code: 'user',
      description: '普通用户角色',
      isSystem: true,
    },
  });

  // 给普通用户分配基本权限
  const userPermCodes = [
    'doc:view',
    'doc:upload',
    'doc:edit',
    'doc:share',
    'doc:version',
    'archive:view',
    'archive:create',
    'archive:update',
    'archive:borrow',
    'archive:return',
    'search:basic',
  ];
  for (const code of userPermCodes) {
    const perm = allPermissions.find(p => p.code === code);
    if (perm) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: userRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: userRole.id,
          permissionId: perm.id,
        },
      });
    }
  }
  console.log('创建了普通用户角色');

  // 创建管理员用户
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@wenyu.com',
      password: hashedPassword,
      name: '系统管理员',
      status: 'ACTIVE',
    },
  });

  // 给管理员用户分配管理员角色
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });
  console.log('创建了管理员用户: admin / admin123');

  // 创建默认本地仓库
  await prisma.repository.upsert({
    where: { code: 'default' },
    update: {},
    create: {
      name: '默认仓库',
      code: 'default',
      description: '系统默认本地存储仓库',
      storageType: 'LOCAL',
      storagePath: '/tmp/wenyu/storage/default',
      versionEnabled: true,
      maxVersions: 100,
      status: 'ACTIVE',
    },
  });
  console.log('创建了默认仓库');

  // 创建默认借阅工作流
  const existingWorkflow = await prisma.borrowWorkflowConfig.findFirst({
    where: { isDefault: true },
  });
  if (!existingWorkflow) {
    await prisma.borrowWorkflowConfig.create({
      data: {
        name: '默认借阅审批流程',
        description: '管理员审批后即可借阅',
        isDefault: true,
        isEnabled: true,
        nodes: {
          create: [
            {
              name: '管理员审批',
              nodeOrder: 1,
              approverType: 'ROLE',
              approverValue: 'admin',
              isRequired: true,
            },
          ],
        },
      },
    });
    console.log('创建了默认借阅工作流');
  }

  // 创建示例档案分类
  const existingCategory = await prisma.archiveCategory.findFirst();
  if (!existingCategory) {
    const rootCategory = await prisma.archiveCategory.create({
      data: {
        name: '全部分类',
        code: 'ROOT',
        level: 1,
        sortOrder: 0,
        description: '档案分类根节点',
      },
    });
    await prisma.archiveCategory.createMany({
      data: [
        { name: '行政档案', code: 'ADMIN', parentId: rootCategory.id, level: 2, sortOrder: 1 },
        { name: '财务档案', code: 'FINANCE', parentId: rootCategory.id, level: 2, sortOrder: 2 },
        { name: '人事档案', code: 'HR', parentId: rootCategory.id, level: 2, sortOrder: 3 },
        { name: '技术档案', code: 'TECH', parentId: rootCategory.id, level: 2, sortOrder: 4 },
        { name: '合同档案', code: 'CONTRACT', parentId: rootCategory.id, level: 2, sortOrder: 5 },
      ],
    });
    console.log('创建了示例档案分类');
  }

  console.log('数据库初始化完成！');
}

main()
  .catch((e) => {
    console.error('初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
