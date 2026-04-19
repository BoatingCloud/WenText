import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

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

  if (!response.ok) {
    const raw = await response.text();
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = { raw };
    }
    throw new Error(
      `HTTP ${response.status} ${response.statusText} @ ${path}\n${JSON.stringify(body)}`
    );
  }

  return response;
}

async function login() {
  const response = await api('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    }),
  });

  const result = await response.json();
  const token = result?.data?.tokens?.accessToken;
  assert.ok(token, '登录未返回 accessToken');
  return token;
}

async function getDefaultRepositoryId(token) {
  const response = await api('/api/repositories?page=1&pageSize=100', {}, token);
  const result = await response.json();
  const repositories = result?.data || [];
  const defaultRepo = repositories.find((repo) => repo.code === 'default') || repositories[0];
  assert.ok(defaultRepo?.id, '未找到可用仓库');
  return defaultRepo.id;
}

test('download should return uploaded content without 502', async () => {
  const token = await login();
  const repositoryId = await getDefaultRepositoryId(token);

  const fileName = `tdd-download-${Date.now()}-${randomUUID().slice(0, 8)}.txt`;
  const content = `download-content-${Date.now()}`;
  let documentId = null;

  try {
    const uploadForm = new FormData();
    uploadForm.set('parentPath', '/');
    uploadForm.set('commitMessage', 'download smoke');
    uploadForm.set('file', new Blob([content], { type: 'text/plain' }), fileName);

    const uploadResponse = await api(
      `/api/documents/repo/${repositoryId}/upload`,
      {
        method: 'POST',
        body: uploadForm,
      },
      token
    );
    const uploadResult = await uploadResponse.json();
    documentId = uploadResult?.data?.id;
    assert.ok(documentId, '上传后未返回 documentId');

    const downloadResponse = await api(`/api/documents/${documentId}/download`, {}, token);
    const downloaded = await downloadResponse.text();
    assert.equal(downloaded, content, '下载内容与上传内容不一致');
  } finally {
    if (documentId) {
      await api(`/api/documents/${documentId}`, { method: 'DELETE' }, token);
    }
  }
});
