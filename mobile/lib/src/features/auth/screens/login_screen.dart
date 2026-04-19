import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

/// 登录页面
class LoginScreen extends HookConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usernameController = useTextEditingController();
    final passwordController = useTextEditingController();
    final rememberPassword = useState(false);
    final obscurePassword = useState(true);

    final authState = ref.watch(authProvider);
    final authNotifier = ref.read(authProvider.notifier);

    // 加载记住的密码
    useEffect(() {
      final credentials = authNotifier.getRememberedCredentials();
      if (credentials != null) {
        usernameController.text = credentials['username'] ?? '';
        passwordController.text = credentials['password'] ?? '';
        rememberPassword.value = true;
      }
      return null;
    }, []);

    // 监听认证状态变化
    ref.listen<AuthState>(authProvider, (previous, next) {
      if (next.isAuthenticated) {
        context.go('/home');
      } else if (next.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.error!),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    });

    Future<void> handleLogin() async {
      if (usernameController.text.isEmpty || passwordController.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('请输入用户名和密码')),
        );
        return;
      }

      await authNotifier.login(
        username: usernameController.text,
        password: passwordController.text,
        rememberPassword: rememberPassword.value,
      );
    }

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Logo和标题
                Icon(
                  Icons.folder_outlined,
                  size: 80,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(height: 24),
                Text(
                  '文雨文档管理系统',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  '欢迎回来',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 48),

                // 用户名输入框
                TextField(
                  controller: usernameController,
                  decoration: const InputDecoration(
                    labelText: '用户名',
                    hintText: '请输入用户名',
                    prefixIcon: Icon(Icons.person_outline),
                    border: OutlineInputBorder(),
                  ),
                  textInputAction: TextInputAction.next,
                  enabled: !authState.isLoading,
                ),
                const SizedBox(height: 16),

                // 密码输入框
                TextField(
                  controller: passwordController,
                  decoration: InputDecoration(
                    labelText: '密码',
                    hintText: '请输入密码',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(
                        obscurePassword.value
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                      onPressed: () {
                        obscurePassword.value = !obscurePassword.value;
                      },
                    ),
                    border: const OutlineInputBorder(),
                  ),
                  obscureText: obscurePassword.value,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => handleLogin(),
                  enabled: !authState.isLoading,
                ),
                const SizedBox(height: 8),

                // 记住密码
                Row(
                  children: [
                    Checkbox(
                      value: rememberPassword.value,
                      onChanged: authState.isLoading
                          ? null
                          : (value) {
                              rememberPassword.value = value ?? false;
                            },
                    ),
                    Text(
                      '记住密码',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // 登录按钮
                FilledButton(
                  onPressed: authState.isLoading ? null : handleLogin,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: authState.isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                          ),
                        )
                      : const Text('登录'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
