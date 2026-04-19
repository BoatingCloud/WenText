import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

async function request(path, options = {}, token) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const raw = await response.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = { raw };
  }

  return { response, body };
}

async function api(path, options = {}, token) {
  const { response, body } = await request(path, options, token);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} @ ${path}\n${JSON.stringify(body)}`);
  }
  return body;
}

async function login(username, password) {
  const result = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const token = result?.data?.tokens?.accessToken;
  assert.ok(token, '登录未返回 accessToken');
  return token;
}

test('physical archive permissions should be isolated from document permissions', async () => {
  const adminToken = await login(ADMIN_USERNAME, ADMIN_PASSWORD);
  const suffix = Date.now();

  const createdRoleIds = [];
  const createdUserIds = [];
  const createdArchiveIds = [];

  try {
    const permissionsRes = await api('/api/roles/permissions', {}, adminToken);
    const permissions = permissionsRes?.data || [];

    const findPermissionId = (code) => permissions.find((p) => p.code === code)?.id;

    const docViewId = findPermissionId('doc:view');
    const archiveViewId = findPermissionId('archive:view');
    const archiveCreateId = findPermissionId('archive:create');
    const archiveUpdateId = findPermissionId('archive:update');
    const archiveDeleteId = findPermissionId('archive:delete');

    assert.ok(docViewId, '缺少 doc:view 权限定义');
    assert.ok(archiveViewId, '缺少 archive:view 权限定义');
    assert.ok(archiveCreateId, '缺少 archive:create 权限定义');
    assert.ok(archiveUpdateId, '缺少 archive:update 权限定义');
    assert.ok(archiveDeleteId, '缺少 archive:delete 权限定义');

    const docRole = await api(
      '/api/roles',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `DocOnly-${suffix}`,
          code: `doc_only_${suffix}`,
          permissionIds: [docViewId],
        }),
      },
      adminToken
    );
    createdRoleIds.push(docRole.data.id);

    const archiveRole = await api(
      '/api/roles',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `ArchiveMgr-${suffix}`,
          code: `archive_mgr_${suffix}`,
          permissionIds: [archiveViewId, archiveCreateId, archiveUpdateId, archiveDeleteId],
        }),
      },
      adminToken
    );
    createdRoleIds.push(archiveRole.data.id);

    const docUser = await api(
      '/api/users',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `docuser_${suffix}`,
          email: `docuser_${suffix}@example.com`,
          password: 'Pass123456',
          name: 'Doc User',
        }),
      },
      adminToken
    );
    createdUserIds.push(docUser.data.id);

    const archiveUser = await api(
      '/api/users',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `archiveuser_${suffix}`,
          email: `archiveuser_${suffix}@example.com`,
          password: 'Pass123456',
          name: 'Archive User',
        }),
      },
      adminToken
    );
    createdUserIds.push(archiveUser.data.id);

    await api(
      `/api/users/${docUser.data.id}/roles`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleIds: [docRole.data.id] }),
      },
      adminToken
    );

    await api(
      `/api/users/${archiveUser.data.id}/roles`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleIds: [archiveRole.data.id] }),
      },
      adminToken
    );

    const docUserToken = await login(`docuser_${suffix}`, 'Pass123456');
    const archiveUserToken = await login(`archiveuser_${suffix}`, 'Pass123456');

    const docUserCreate = await request(
      '/api/physical-archives',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `文档权限用户创建-${suffix}`,
          archiveNo: `EA-DOC-${suffix}`,
          shelfLocation: 'C-01-01',
        }),
      },
      docUserToken
    );
    assert.equal(docUserCreate.response.status, 403, '仅文档权限用户不应创建实体档案');

    const archiveUserCreate = await request(
      '/api/physical-archives',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `实体档案权限用户创建-${suffix}`,
          archiveNo: `EA-ARCH-${suffix}`,
          shelfLocation: 'C-01-02',
        }),
      },
      archiveUserToken
    );
    assert.equal(archiveUserCreate.response.status, 201, '实体档案权限用户应可创建实体档案');
    createdArchiveIds.push(archiveUserCreate.body?.data?.id);
  } finally {
    for (const id of createdArchiveIds) {
      if (!id) continue;
      try {
        await api(`/api/physical-archives/${id}`, { method: 'DELETE' }, adminToken);
      } catch {
        // ignore cleanup errors
      }
    }

    for (const id of createdUserIds) {
      try {
        await api(`/api/users/${id}`, { method: 'DELETE' }, adminToken);
      } catch {
        // ignore cleanup errors
      }
    }

    for (const id of createdRoleIds) {
      try {
        await api(`/api/roles/${id}`, { method: 'DELETE' }, adminToken);
      } catch {
        // ignore cleanup errors
      }
    }
  }
});
