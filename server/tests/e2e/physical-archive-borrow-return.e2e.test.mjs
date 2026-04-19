import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

async function api(path, options = {}, token) {
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

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} @ ${path}\n${JSON.stringify(body)}`);
  }

  return body;
}

async function login() {
  const result = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  const token = result?.data?.tokens?.accessToken;
  assert.ok(token, '登录未返回 accessToken');
  return token;
}

test('physical archive should support borrow/return workflow and records', async () => {
  const token = await login();
  const suffix = Date.now();
  let archiveId = null;

  try {
    const created = await api(
      '/api/physical-archives',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `借阅测试档案-${suffix}`,
          archiveNo: `EA-BORROW-${suffix}`,
          shelfLocation: 'B-02-01',
          status: 'IN_STOCK',
          copies: 1,
        }),
      },
      token
    );
    archiveId = created?.data?.id;
    assert.ok(archiveId, '创建实体档案失败');

    const borrowedAt = new Date().toISOString();
    await api(
      `/api/physical-archives/${archiveId}/borrow`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrower: '张三',
          borrowedAt,
          borrowRemark: '外借审批单#A001',
        }),
      },
      token
    );

    const borrowedDetail = await api(`/api/physical-archives/${archiveId}`, {}, token);
    assert.equal(borrowedDetail?.data?.status, 'BORROWED', '借阅后状态应为 BORROWED');
    assert.equal(borrowedDetail?.data?.borrower, '张三', '借阅人未正确保存');

    await api(
      `/api/physical-archives/${archiveId}/return`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnRemark: '归还验收完成',
        }),
      },
      token
    );

    const returnedDetail = await api(`/api/physical-archives/${archiveId}`, {}, token);
    assert.equal(returnedDetail?.data?.status, 'IN_STOCK', '归还后状态应为 IN_STOCK');
    assert.equal(returnedDetail?.data?.borrower, null, '归还后借阅人应清空');

    const recordsRes = await api(`/api/physical-archives/${archiveId}/borrow-records?page=1&pageSize=20`, {}, token);
    const records = recordsRes?.data || [];
    assert.ok(records.length >= 2, '借阅记录至少应包含借出和归还两条');
    assert.ok(records.some((r) => r.action === 'BORROW'), '借阅记录缺少 BORROW');
    assert.ok(records.some((r) => r.action === 'RETURN'), '借阅记录缺少 RETURN');
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
