<?php
// 版本管理模块
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'create' || $action === 'update') {
        $id = $_POST['id'] ?? null;
        $platform = $_POST['platform'] ?? '';
        $version_name = $_POST['version_name'] ?? '';
        $build_number = (int)($_POST['build_number'] ?? 0);
        $download_url = $_POST['download_url'] ?? '';
        $release_notes = $_POST['release_notes'] ?? '';
        $force_update = isset($_POST['force_update']) ? 1 : 0;
        $min_supported_build = (int)($_POST['min_supported_build'] ?? 0);
        $status = $_POST['status'] ?? 'DRAFT';
        $now = gmdate('Y-m-d H:i:s');

        if ($action === 'create') {
            $stmt = $pdo->prepare("INSERT INTO app_versions (platform, version_name, build_number, download_url, release_notes, force_update, min_supported_build, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$platform, $version_name, $build_number, $download_url, $release_notes, $force_update, $min_supported_build, $status, $now, $now]);
        } else {
            $stmt = $pdo->prepare("UPDATE app_versions SET platform=?, version_name=?, build_number=?, download_url=?, release_notes=?, force_update=?, min_supported_build=?, status=?, updated_at=? WHERE id=?");
            $stmt->execute([$platform, $version_name, $build_number, $download_url, $release_notes, $force_update, $min_supported_build, $status, $now, $id]);
        }
        header('Location: admin.php?module=versions&success=1');
        exit;
    }
    if ($action === 'delete') {
        $stmt = $pdo->prepare("DELETE FROM app_versions WHERE id=?");
        $stmt->execute([$_POST['id']]);
        header('Location: admin.php?module=versions&success=1');
        exit;
    }
}

$editItem = null;
if (isset($_GET['edit'])) {
    $stmt = $pdo->prepare("SELECT * FROM app_versions WHERE id=?");
    $stmt->execute([$_GET['edit']]);
    $editItem = $stmt->fetch();
}

$stmt = $pdo->query("SELECT * FROM app_versions ORDER BY platform, build_number DESC");
$items = $stmt->fetchAll();
?>

<div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>🔄 版本管理</h2>
        <button class="btn btn-primary" onclick="openModal('versionModal')">+ 添加版本</button>
    </div>

    <?php if (isset($_GET['success'])): ?>
        <div style="padding: 12px; background: #d4edda; color: #155724; border-radius: 4px; margin-bottom: 20px;">操作成功！</div>
    <?php endif; ?>

    <table>
        <thead>
            <tr>
                <th>平台</th>
                <th>版本号</th>
                <th>Build</th>
                <th>下载地址</th>
                <th>强制更新</th>
                <th>状态</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($items as $item): ?>
                <tr>
                    <td><?= strtoupper($item['platform']) ?></td>
                    <td><?= htmlspecialchars($item['version_name']) ?></td>
                    <td><?= $item['build_number'] ?></td>
                    <td><?= htmlspecialchars(mb_substr($item['download_url'], 0, 40)) ?>...</td>
                    <td><?= $item['force_update'] ? '是' : '否' ?></td>
                    <td>
                        <?php if ($item['status'] === 'PUBLISHED'): ?>
                            <span class="badge badge-success">已发布</span>
                        <?php else: ?>
                            <span class="badge badge-warning">草稿</span>
                        <?php endif; ?>
                    </td>
                    <td class="actions">
                        <a href="?module=versions&edit=<?= $item['id'] ?>" class="btn btn-primary btn-sm">编辑</a>
                        <form method="POST" style="display: inline;" onsubmit="return confirmDelete()">
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="id" value="<?= $item['id'] ?>">
                            <button type="submit" class="btn btn-danger btn-sm">删除</button>
                        </form>
                    </td>
                </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div id="versionModal" class="modal <?= $editItem ? 'active' : '' ?>">
    <div class="modal-content">
        <div class="modal-header">
            <h3><?= $editItem ? '编辑版本' : '添加版本' ?></h3>
            <span class="modal-close" onclick="closeModal('versionModal')">&times;</span>
        </div>
        <form method="POST">
            <input type="hidden" name="action" value="<?= $editItem ? 'update' : 'create' ?>">
            <?php if ($editItem): ?>
                <input type="hidden" name="id" value="<?= $editItem['id'] ?>">
            <?php endif; ?>

            <div class="form-group">
                <label>平台 *</label>
                <select name="platform" required>
                    <option value="android" <?= ($editItem['platform'] ?? '') === 'android' ? 'selected' : '' ?>>Android</option>
                    <option value="ios" <?= ($editItem['platform'] ?? '') === 'ios' ? 'selected' : '' ?>>iOS</option>
                </select>
            </div>

            <div class="form-group">
                <label>版本号 *</label>
                <input type="text" name="version_name" value="<?= htmlspecialchars($editItem['version_name'] ?? '') ?>" placeholder="1.0.0" required>
            </div>

            <div class="form-group">
                <label>Build Number *</label>
                <input type="number" name="build_number" value="<?= $editItem['build_number'] ?? '' ?>" required>
            </div>

            <div class="form-group">
                <label>下载地址 *</label>
                <input type="url" name="download_url" value="<?= htmlspecialchars($editItem['download_url'] ?? '') ?>" required>
            </div>

            <div class="form-group">
                <label>更新说明</label>
                <textarea name="release_notes"><?= htmlspecialchars($editItem['release_notes'] ?? '') ?></textarea>
            </div>

            <div class="form-group">
                <label>最低支持 Build</label>
                <input type="number" name="min_supported_build" value="<?= $editItem['min_supported_build'] ?? 0 ?>">
            </div>

            <div class="form-group">
                <label><input type="checkbox" name="force_update" <?= ($editItem['force_update'] ?? 0) ? 'checked' : '' ?>> 强制更新</label>
            </div>

            <div class="form-group">
                <label>状态 *</label>
                <select name="status" required>
                    <option value="DRAFT" <?= ($editItem['status'] ?? 'DRAFT') === 'DRAFT' ? 'selected' : '' ?>>草稿</option>
                    <option value="PUBLISHED" <?= ($editItem['status'] ?? '') === 'PUBLISHED' ? 'selected' : '' ?>>已发布</option>
                </select>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn" onclick="closeModal('versionModal')">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
            </div>
        </form>
    </div>
</div>
