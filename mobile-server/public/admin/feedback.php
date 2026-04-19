<?php
// 反馈工单管理
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'update_status') {
        $id = $_POST['id'] ?? null;
        $status = $_POST['status'] ?? 'OPEN';
        $now = gmdate('Y-m-d H:i:s');

        $stmt = $pdo->prepare("UPDATE feedback_tickets SET status=?, updated_at=? WHERE id=?");
        $stmt->execute([$status, $now, $id]);

        header('Location: admin.php?module=feedback&success=1');
        exit;
    }

    if ($action === 'delete') {
        $stmt = $pdo->prepare("DELETE FROM feedback_tickets WHERE id=?");
        $stmt->execute([$_POST['id']]);
        header('Location: admin.php?module=feedback&success=1');
        exit;
    }
}

$viewItem = null;
if (isset($_GET['view'])) {
    $stmt = $pdo->prepare("SELECT * FROM feedback_tickets WHERE id=?");
    $stmt->execute([$_GET['view']]);
    $viewItem = $stmt->fetch();
}

$stmt = $pdo->query("SELECT * FROM feedback_tickets ORDER BY id DESC LIMIT 100");
$items = $stmt->fetchAll();
?>

<div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>💬 反馈工单</h2>
    </div>

    <?php if (isset($_GET['success'])): ?>
        <div style="padding: 12px; background: #d4edda; color: #155724; border-radius: 4px; margin-bottom: 20px;">操作成功！</div>
    <?php endif; ?>

    <?php if (empty($items)): ?>
        <div class="empty-state">
            <p>暂无反馈工单</p>
        </div>
    <?php else: ?>
        <table>
            <thead>
                <tr>
                    <th>工单号</th>
                    <th>用户</th>
                    <th>类型</th>
                    <th>标题</th>
                    <th>平台</th>
                    <th>状态</th>
                    <th>创建时间</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($items as $item): ?>
                    <tr>
                        <td><?= htmlspecialchars($item['ticket_no']) ?></td>
                        <td><?= htmlspecialchars($item['user_name'] ?? $item['user_id'] ?? '-') ?></td>
                        <td><?= htmlspecialchars($item['type']) ?></td>
                        <td><?= htmlspecialchars($item['title']) ?></td>
                        <td><?= strtoupper($item['source_platform']) ?></td>
                        <td>
                            <?php
                            $statusClass = match($item['status']) {
                                'OPEN' => 'badge-warning',
                                'IN_PROGRESS' => 'badge-primary',
                                'RESOLVED' => 'badge-success',
                                'CLOSED' => 'badge-secondary',
                                default => 'badge-warning'
                            };
                            $statusText = match($item['status']) {
                                'OPEN' => '待处理',
                                'IN_PROGRESS' => '处理中',
                                'RESOLVED' => '已解决',
                                'CLOSED' => '已关闭',
                                default => $item['status']
                            };
                            ?>
                            <span class="badge <?= $statusClass ?>"><?= $statusText ?></span>
                        </td>
                        <td><?= $item['created_at'] ?></td>
                        <td class="actions">
                            <a href="?module=feedback&view=<?= $item['id'] ?>" class="btn btn-primary btn-sm">查看</a>
                            <form method="POST" style="display: inline;" onsubmit="return confirmDelete('确定要删除此工单吗？')">
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

<?php if ($viewItem): ?>
<div id="viewModal" class="modal active">
    <div class="modal-content">
        <div class="modal-header">
            <h3>工单详情 - <?= htmlspecialchars($viewItem['ticket_no']) ?></h3>
            <span class="modal-close" onclick="window.location.href='?module=feedback'">&times;</span>
        </div>

        <div style="margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px; margin-bottom: 10px;">
                <strong>工单号:</strong>
                <span><?= htmlspecialchars($viewItem['ticket_no']) ?></span>

                <strong>用户ID:</strong>
                <span><?= htmlspecialchars($viewItem['user_id'] ?? '-') ?></span>

                <strong>用户名:</strong>
                <span><?= htmlspecialchars($viewItem['user_name'] ?? '-') ?></span>

                <strong>联系方式:</strong>
                <span><?= htmlspecialchars($viewItem['contact'] ?? '-') ?></span>

                <strong>类型:</strong>
                <span><?= htmlspecialchars($viewItem['type']) ?></span>

                <strong>平台:</strong>
                <span><?= strtoupper($viewItem['source_platform']) ?></span>

                <strong>应用版本:</strong>
                <span><?= htmlspecialchars($viewItem['app_version'] ?? '-') ?></span>

                <strong>设备信息:</strong>
                <span><?= htmlspecialchars($viewItem['device_info'] ?? '-') ?></span>

                <strong>创建时间:</strong>
                <span><?= $viewItem['created_at'] ?></span>
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <strong>标题:</strong>
            <p style="margin-top: 5px;"><?= htmlspecialchars($viewItem['title']) ?></p>
        </div>

        <div style="margin-bottom: 20px;">
            <strong>内容:</strong>
            <p style="margin-top: 5px; white-space: pre-wrap;"><?= htmlspecialchars($viewItem['content']) ?></p>
        </div>

        <form method="POST" style="margin-bottom: 20px;">
            <input type="hidden" name="action" value="update_status">
            <input type="hidden" name="id" value="<?= $viewItem['id'] ?>">
            <div class="form-group">
                <label>更新状态:</label>
                <select name="status">
                    <option value="OPEN" <?= $viewItem['status'] === 'OPEN' ? 'selected' : '' ?>>待处理</option>
                    <option value="IN_PROGRESS" <?= $viewItem['status'] === 'IN_PROGRESS' ? 'selected' : '' ?>>处理中</option>
                    <option value="RESOLVED" <?= $viewItem['status'] === 'RESOLVED' ? 'selected' : '' ?>>已解决</option>
                    <option value="CLOSED" <?= $viewItem['status'] === 'CLOSED' ? 'selected' : '' ?>>已关闭</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary">更新状态</button>
        </form>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" class="btn" onclick="window.location.href='?module=feedback'">关闭</button>
        </div>
    </div>
</div>
<?php endif; ?>

<style>
.badge-primary { background: #007bff; color: white; }
.badge-secondary { background: #6c757d; color: white; }
</style>
