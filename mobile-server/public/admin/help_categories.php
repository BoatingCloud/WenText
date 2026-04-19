<?php
// 帮助分类管理
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    $now = gmdate('Y-m-d H:i:s');

    if ($action === 'create' || $action === 'update') {
        $id = $_POST['id'] ?? null;
        $name = trim($_POST['name'] ?? '');
        $sort_order = (int)($_POST['sort_order'] ?? 0);
        $is_active = isset($_POST['is_active']) ? 1 : 0;

        if ($action === 'create') {
            $stmt = $pdo->prepare("INSERT INTO help_categories (name, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$name, $sort_order, $is_active, $now, $now]);
        } else {
            $stmt = $pdo->prepare("UPDATE help_categories SET name=?, sort_order=?, is_active=?, updated_at=? WHERE id=?");
            $stmt->execute([$name, $sort_order, $is_active, $now, $id]);
        }
        header('Location: admin.php?module=help_categories&success=1');
        exit;
    }

    if ($action === 'delete') {
        $stmt = $pdo->prepare("DELETE FROM help_categories WHERE id=?");
        $stmt->execute([$_POST['id']]);
        header('Location: admin.php?module=help_categories&success=1');
        exit;
    }
}

$editItem = null;
if (isset($_GET['edit'])) {
    $stmt = $pdo->prepare("SELECT * FROM help_categories WHERE id=?");
    $stmt->execute([$_GET['edit']]);
    $editItem = $stmt->fetch();
}

$stmt = $pdo->query("SELECT * FROM help_categories ORDER BY sort_order ASC");
$items = $stmt->fetchAll();
?>

<div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>📁 帮助分类</h2>
        <button class="btn btn-primary" onclick="openModal('categoryModal')">+ 添加分类</button>
    </div>

    <?php if (isset($_GET['success'])): ?>
        <div style="padding: 12px; background: #d4edda; color: #155724; border-radius: 4px; margin-bottom: 20px;">操作成功！</div>
    <?php endif; ?>

    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>分类名称</th>
                <th>排序</th>
                <th>状态</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($items as $item): ?>
                <tr>
                    <td><?= $item['id'] ?></td>
                    <td><?= htmlspecialchars($item['name']) ?></td>
                    <td><?= $item['sort_order'] ?></td>
                    <td>
                        <?php if ($item['is_active']): ?>
                            <span class="badge badge-success">启用</span>
                        <?php else: ?>
                            <span class="badge badge-danger">禁用</span>
                        <?php endif; ?>
                    </td>
                    <td class="actions">
                        <a href="?module=help_categories&edit=<?= $item['id'] ?>" class="btn btn-primary btn-sm">编辑</a>
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

<div id="categoryModal" class="modal <?= $editItem ? 'active' : '' ?>">
    <div class="modal-content">
        <div class="modal-header">
            <h3><?= $editItem ? '编辑分类' : '添加分类' ?></h3>
            <span class="modal-close" onclick="closeModal('categoryModal')">&times;</span>
        </div>
        <form method="POST">
            <input type="hidden" name="action" value="<?= $editItem ? 'update' : 'create' ?>">
            <?php if ($editItem): ?>
                <input type="hidden" name="id" value="<?= $editItem['id'] ?>">
            <?php endif; ?>

            <div class="form-group">
                <label>分类名称 *</label>
                <input type="text" name="name" value="<?= htmlspecialchars($editItem['name'] ?? '') ?>" required>
            </div>

            <div class="form-group">
                <label>排序</label>
                <input type="number" name="sort_order" value="<?= $editItem['sort_order'] ?? 0 ?>">
            </div>

            <div class="form-group">
                <label><input type="checkbox" name="is_active" <?= ($editItem['is_active'] ?? 1) ? 'checked' : '' ?>> 启用</label>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn" onclick="closeModal('categoryModal')">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
            </div>
        </form>
    </div>
</div>
