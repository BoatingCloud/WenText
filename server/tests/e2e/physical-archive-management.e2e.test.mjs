import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

async function api(path, options = {}, token) {
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

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

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} @ ${path}\n${JSON.stringify(body)}`);
  }
  return body;
}

async function login() {
  const result = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    }),
  });
  const token = result?.data?.tokens?.accessToken;
  assert.ok(token, '登录未返回 accessToken');
  return token;
}

test('physical archive should support create/list/update/delete lifecycle', async () => {
  const token = await login();
  const suffix = Date.now();
  const archiveNo = `EA-${suffix}`;
  let archiveId = null;

  try {
    const created = await api(
      '/api/physical-archives',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `实体档案-${suffix}`,
          archiveNo,
          categoryName: '行政管理',
          year: 2026,
          shelfLocation: 'A-01-03',
          retentionPeriod: '30年',
          securityLevel: '内部',
          copies: 1,
          pages: 12,
          status: 'IN_STOCK',
          tags: ['合同', '归档'],
        }),
      },
      token
    );

    archiveId = created?.data?.id;
    assert.ok(archiveId, '创建实体档案后未返回 id');
    assert.equal(created?.data?.archiveNo, archiveNo, '创建实体档案编号不正确');

    const listed = await api(`/api/physical-archives?page=1&pageSize=20&search=${archiveNo}`, {}, token);
    const listData = listed?.data || [];
    assert.ok(Array.isArray(listData), '实体档案列表返回格式错误');
    assert.ok(listData.some((item) => item.id === archiveId), '列表中未查询到新建实体档案');

    await api(
      `/api/physical-archives/${archiveId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'BORROWED',
          borrower: '测试借阅人',
          borrowRemark: 'TDD 借阅流程',
        }),
      },
      token
    );

    const detail = await api(`/api/physical-archives/${archiveId}`, {}, token);
    assert.equal(detail?.data?.status, 'BORROWED', '更新后实体档案状态不正确');
    assert.equal(detail?.data?.borrower, '测试借阅人', '借阅人信息未保存');

    await api(`/api/physical-archives/${archiveId}`, { method: 'DELETE' }, token);

    const listedAfterDelete = await api(`/api/physical-archives?page=1&pageSize=20&search=${archiveNo}`, {}, token);
    const afterDeleteData = listedAfterDelete?.data || [];
    assert.ok(afterDeleteData.every((item) => item.id !== archiveId), '删除后列表仍存在该实体档案');
  } finally {
    if (archiveId) {
      try {
        await api(`/api/physical-archives/${archiveId}`, { method: 'DELETE' }, token);
      } catch {
        // ignore cleanup errors
      }
    }
  }
});
