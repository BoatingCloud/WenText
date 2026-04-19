import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../home/screens/home_screen.dart';
import '../archive/screens/archive_screen.dart';
import '../repository/screens/repository_screen.dart';
import '../profile/screens/profile_screen.dart';

/// 主框架页面（带底部导航栏）
class MainScreen extends HookConsumerWidget {
  const MainScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentIndex = useState(0);

    final pages = [
      const HomeScreen(),
      const ArchiveScreen(),
      const RepositoryScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: IndexedStack(
        index: currentIndex.value,
        children: pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex.value,
        onDestinationSelected: (index) {
          currentIndex.value = index;
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Symbols.home),
            selectedIcon: Icon(Symbols.home, fill: 1),
            label: '首页',
          ),
          NavigationDestination(
            icon: Icon(Symbols.folder),
            selectedIcon: Icon(Symbols.folder, fill: 1),
            label: '档案',
          ),
          NavigationDestination(
            icon: Icon(Symbols.storage),
            selectedIcon: Icon(Symbols.storage, fill: 1),
            label: '仓库',
          ),
          NavigationDestination(
            icon: Icon(Symbols.person),
            selectedIcon: Icon(Symbols.person, fill: 1),
            label: '我的',
          ),
        ],
      ),
    );
  }
}
