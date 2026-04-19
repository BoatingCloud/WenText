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

  const raw = await response.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = { raw };
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} @ ${path}\n${JSON.stringify(body)}`
    );
  }

  return body;
}

async function login() {
  const result = await api('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    }),
  });

  const token = result?.data?.tokens?.accessToken;
  assert.ok(token, '登录未返回 accessToken');
  return token;
}

async function getDefaultRepositoryId(token) {
  const result = await api('/api/repositories?page=1&pageSize=100', {}, token);
  const repositories = result?.data || [];
  const defaultRepo = repositories.find((repo) => repo.code === 'default') || repositories[0];
  assert.ok(defaultRepo?.id, '未找到可用仓库');
  return defaultRepo.id;
}

test('restore should rollback content and create a new version record', async () => {
  const token = await login();
  const repositoryId = await getDefaultRepositoryId(token);

  const fileName = `tdd-version-${Date.now()}-${randomUUID().slice(0, 8)}.txt`;
  const v1Content = `version-1-${Date.now()}`;
  const v2Content = `version-2-${Date.now()}`;
  let documentId = null;

  try {
    const uploadForm = new FormData();
    uploadForm.set('parentPath', '/');
    uploadForm.set('commitMessage', 'v1');
    uploadForm.set('file', new Blob([v1Content], { type: 'text/plain' }), fileName);

    const uploadResult = await api(
      `/api/documents/repo/${repositoryId}/upload`,
      {
        method: 'POST',
        body: uploadForm,
      },
      token
    );

    documentId = uploadResult?.data?.id;
    assert.ok(documentId, '上传后未返回 documentId');

    await api(
      `/api/documents/${documentId}/content`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: v2Content,
          commitMessage: 'v2',
        }),
      },
      token
    );

    const versionsBeforeRestore = await api(`/api/documents/${documentId}/versions`, {}, token);
    const beforeList = versionsBeforeRestore?.data || [];
    assert.ok(beforeList.length >= 2, '更新后应至少有两个版本');
    const maxVersionBefore = Math.max(...beforeList.map((v) => v.version));
    const version1 = beforeList.find((v) => v.version === 1);
    assert.ok(version1?.id, '未找到版本 1');

    await api(
      `/api/documents/${documentId}/versions/${version1.id}/restore`,
      { method: 'POST' },
      token
    );

    const restored = await api(`/api/documents/${documentId}/content`, {}, token);
    const restoredContent = restored?.data?.content;
    assert.equal(restoredContent, v1Content, '恢复版本后内容未回退到 v1');

    const versionsAfterRestore = await api(`/api/documents/${documentId}/versions`, {}, token);
    const afterList = versionsAfterRestore?.data || [];
    const maxVersionAfter = Math.max(...afterList.map((v) => v.version));

    assert.equal(
      afterList.length,
      beforeList.length + 1,
      '恢复版本后应新增一条版本历史'
    );
    assert.equal(
      maxVersionAfter,
      maxVersionBefore + 1,
      '恢复版本后应生成新的最新版本号'
    );

    const latestVersion = afterList.find((v) => v.version === maxVersionAfter);
    assert.ok(
      latestVersion?.commitMessage?.includes('恢复'),
      '恢复版本后新版本的提交信息应标记为恢复操作'
    );
  } finally {
    if (documentId) {
      await api(`/api/documents/${documentId}`, { method: 'DELETE' }, token);
    }
  }
});
