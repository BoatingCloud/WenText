<?php
/**
 * Mobile Server 管理后台
 * 访问: http://你的域名/public/admin.php
 * 默认密码: admin123 (请修改)
 */

declare(strict_types=1);

session_start();

// 配置
define('ADMIN_PASSWORD', 'admin123'); // 请修改此密码
define('DB_PATH', dirname(__DIR__) . '/storage/mobile.sqlite');

// 简单的登录验证
if (!isset($_SESSION['admin_logged_in'])) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
        if ($_POST['password'] === ADMIN_PASSWORD) {
            $_SESSION['admin_logged_in'] = true;
            header('Location: admin.php');
            exit;
        } else {
            $error = '密码错误';
        }
    }

    // 显示登录页面
    ?>
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>管理后台登录</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; }
            .login-container { max-width: 400px; margin: 100px auto; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { margin-bottom: 30px; text-align: center; color: #333; }
            input { width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
            button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
            button:hover { background: #0056b3; }
            .error { color: #dc3545; margin-bottom: 15px; text-align: center; }
        </style>
    </head>
    <body>
        <div class="login-container">
            <h1>🔐 管理后台</h1>
            <?php if (isset($error)): ?>
                <div class="error"><?= htmlspecialchars($error) ?></div>
            <?php endif; ?>
            <form method="POST">
                <input type="password" name="password" placeholder="请输入管理密码" required autofocus>
                <button type="submit">登录</button>
            </form>
        </div>
    </body>
    </html>
    <?php
    exit;
}

// 处理登出
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: admin.php');
    exit;
}

// 数据库连接
try {
    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (Exception $e) {
    die('数据库连接失败: ' . $e->getMessage());
}

// 获取当前模块
$module = $_GET['module'] ?? 'announcements';

?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mobile Server 管理后台</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; }

        .header { background: #2c3e50; color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { font-size: 20px; }
        .header a { color: white; text-decoration: none; padding: 8px 15px; background: rgba(255,255,255,0.1); border-radius: 4px; }
        .header a:hover { background: rgba(255,255,255,0.2); }

        .container { display: flex; min-height: calc(100vh - 60px); }

        .sidebar { width: 250px; background: white; padding: 20px 0; box-shadow: 2px 0 5px rgba(0,0,0,0.05); }
        .sidebar a { display: block; padding: 12px 30px; color: #333; text-decoration: none; transition: all 0.2s; }
        .sidebar a:hover { background: #f8f9fa; }
        .sidebar a.active { background: #007bff; color: white; }

        .content { flex: 1; padding: 30px; }

        .card { background: white; border-radius: 8px; padding: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .card h2 { margin-bottom: 20px; color: #333; font-size: 24px; }

        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; color: #555; }
        tr:hover { background: #f8f9fa; }

        .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; font-size: 14px; }
        .btn-primary { background: #007bff; color: white; }
        .btn-primary:hover { background: #0056b3; }
        .btn-success { background: #28a745; color: white; }
        .btn-success:hover { background: #218838; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-danger:hover { background: #c82333; }
        .btn-sm { padding: 5px 10px; font-size: 12px; }

        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
        .form-group textarea { min-height: 100px; resize: vertical; }

        .badge { padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: 500; }
        .badge-success { background: #d4edda; color: #155724; }
        .badge-warning { background: #fff3cd; color: #856404; }
        .badge-danger { background: #f8d7da; color: #721c24; }

        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }
        .modal.active { display: flex; align-items: center; justify-content: center; }
        .modal-content { background: white; border-radius: 8px; padding: 30px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .modal-header h3 { font-size: 20px; color: #333; }
        .modal-close { cursor: pointer; font-size: 24px; color: #999; }
        .modal-close:hover { color: #333; }

        .actions { display: flex; gap: 5px; }

        .empty-state { text-align: center; padding: 60px 20px; color: #999; }
        .empty-state svg { width: 64px; height: 64px; margin-bottom: 20px; opacity: 0.3; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📱 Mobile Server 管理后台</h1>
        <a href="?logout=1">退出登录</a>
    </div>

    <div class="container">
        <div class="sidebar">
            <a href="?module=announcements" class="<?= $module === 'announcements' ? 'active' : '' ?>">📢 公告管理</a>
            <a href="?module=versions" class="<?= $module === 'versions' ? 'active' : '' ?>">🔄 版本管理</a>
            <a href="?module=help_categories" class="<?= $module === 'help_categories' ? 'active' : '' ?>">📁 帮助分类</a>
            <a href="?module=help_articles" class="<?= $module === 'help_articles' ? 'active' : '' ?>">📝 帮助文章</a>
            <a href="?module=feedback" class="<?= $module === 'feedback' ? 'active' : '' ?>">💬 反馈工单</a>
        </div>

        <div class="content">
            <?php
            // 根据模块显示不同内容
            switch ($module) {
                case 'announcements':
                    include __DIR__ . '/admin/announcements.php';
                    break;
                case 'versions':
                    include __DIR__ . '/admin/versions.php';
                    break;
                case 'help_categories':
                    include __DIR__ . '/admin/help_categories.php';
                    break;
                case 'help_articles':
                    include __DIR__ . '/admin/help_articles.php';
                    break;
                case 'feedback':
                    include __DIR__ . '/admin/feedback.php';
                    break;
                default:
                    echo '<div class="card"><h2>欢迎使用管理后台</h2><p>请从左侧菜单选择要管理的模块</p></div>';
            }
            ?>
        </div>
    </div>

    <script>
        // 通用模态框控制
        function openModal(modalId) {
            document.getElementById(modalId).classList.add('active');
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
        }

        // 点击模态框外部关闭
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('active');
            }
        });

        // 删除确认
        function confirmDelete(message) {
            return confirm(message || '确定要删除吗？此操作不可恢复。');
        }
    </script>
</body>
</html>
