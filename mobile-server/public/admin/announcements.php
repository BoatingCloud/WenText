<?php
// 公告管理模块

// 处理表单提交
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'create' || $action === 'update') {
        $id = $_POST['id'] ?? null;
        $title = trim($_POST['title'] ?? '');
        $content = trim($_POST['content'] ?? '');
        $is_active = isset($_POST['is_active']) ? 1 : 0;
        $priority = (int)($_POST['priority'] ?? 0);
        $starts_at = trim($_POST['starts_at'] ?? '') ?: null;
        $ends_at = trim($_POST['ends_at'] ?? '') ?: null;
        $now = gmdate('Y-m-d H:i:s');

        if ($action === 'create') {
            $stmt = $pdo->prepare("INSERT INTO announcements (title, content, is_active, priority, starts_at, ends_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$title, $content, $is_active, $priority, $starts_at, $ends_at, $now, $now]);
        } else {
            $stmt = $pdo->prepare("UPDATE announcements SET title=?, content=?, is_active=?, priority=?, starts_at=?, ends_at=?, updated_at=? WHERE id=?");
            $stmt->execute([$title, $content, $is_active, $priority, $starts_at, $ends_at, $now, $id]);
        }

        header('Location: admin.php?module=announcements&success=1');
        exit;
    }

    if ($action === 'delete') {
        $id = $_POST['id'] ?? null;
        if ($id) {
            $stmt = $pdo->prepare("DELETE FROM announcements WHERE id=?");
            $stmt->execute([$id]);
        }
        header('Location: admin.php?module=announcements&success=1');
        exit;
    }
}

// 获取编辑数据
$editItem = null;
if (isset($_GET['edit'])) {
    $stmt = $pdo->prepare("SELECT * FROM announcements WHERE id=?");
    $stmt->execute([$_GET['edit']]);
    $editItem = $stmt->fetch();
}

// 获取列表
$stmt = $pdo->query("SELECT * FROM announcements ORDER BY priority DESC, created_at DESC");
$items = $stmt->fetchAll();
?>

<div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>📢 公告管理</h2>
        <button class="btn btn-primary" onclick="openModal('addModal')">+ 添加公告</button>
    </div>

    <?php if (isset($_GET['success'])): ?>
        <div style="padding: 12px; background: #d4edda; color: #155724; border-radius: 4px; margin-bottom: 20px;">
            操作成功！
        </div>
    <?php endif; ?>

    <?php if (empty($items)): ?>
        <div class="empty-state">
            <p>暂无公告</p>
        </div>
    <?php else: ?>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>标题</th>
                    <th>内容</th>
                    <th>优先级</th>
                    <th>状态</th>
                    <th>开始时间</th>
                    <th>结束时间</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($items as $item): ?>
                    <tr>
                        <td><?= $item['id'] ?></td>
                        <td><?= htmlspecialchars($item['title']) ?></td>
                        <td><?= htmlspecialchars(mb_substr($item['content'], 0, 50)) ?>...</td>
                        <td><?= $item['priority'] ?></td>
                        <td>
                            <?php if ($item['is_active']): ?>
                                <span class="badge badge-success">启用</span>
                            <?php else: ?>
                                <span class="badge badge-danger">禁用</span>
                            <?php endif; ?>
                        </td>
                        <td><?= $item['starts_at'] ?? '-' ?></td>
                        <td><?= $item['ends_at'] ?? '-' ?></td>
                        <td class="actions">
                            <a href="?module=announcements&edit=<?= $item['id'] ?>" class="btn btn-primary btn-sm">编辑</a>
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
    <?php endif; ?>
</div>

<!-- 添加/编辑模态框 -->
<div id="addModal" class="modal <?= $editItem ? 'active' : '' ?>">
    <div class="modal-content">
        <div class="modal-header">
            <h3><?= $editItem ? '编辑公告' : '添加公告' ?></h3>
            <span class="modal-close" onclick="closeModal('addModal')">&times;</span>
        </div>
        <form method="POST">
            <input type="hidden" name="action" value="<?= $editItem ? 'update' : 'create' ?>">
            <?php if ($editItem): ?>
                <input type="hidden" name="id" value="<?= $editItem['id'] ?>">
            <?php endif; ?>

            <div class="form-group">
                <label>标题 *</label>
                <input type="text" name="title" value="<?= htmlspecialchars($editItem['title'] ?? '') ?>" required>
            </div>

            <div class="form-group">
                <label>内容 *</label>
                <textarea name="content" required><?= htmlspecialchars($editItem['content'] ?? '') ?></textarea>
            </div>

            <div class="form-group">
                <label>优先级</label>
                <input type="number" name="priority" value="<?= $editItem['priority'] ?? 0 ?>">
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" name="is_active" <?= ($editItem['is_active'] ?? 1) ? 'checked' : '' ?>>
                    启用
                </label>
            </div>

            <div class="form-group">
                <label>开始时间（可选）</label>
                <input type="datetime-local" name="starts_at" value="<?= $editItem['starts_at'] ? str_replace(' ', 'T', $editItem['starts_at']) : '' ?>">
            </div>

            <div class="form-group">
                <label>结束时间（可选）</label>
                <input type="datetime-local" name="ends_at" value="<?= $editItem['ends_at'] ? str_replace(' ', 'T', $editItem['ends_at']) : '' ?>">
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn" onclick="closeModal('addModal')">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
            </div>
        </form>
    </div>
</div>
