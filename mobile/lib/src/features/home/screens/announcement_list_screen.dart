import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../models/announcement.dart';
import '../services/announcement_service.dart';
import 'announcement_detail_screen.dart';

/// 公告列表页
class AnnouncementListScreen extends HookWidget {
  const AnnouncementListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final announcements = useState<List<Announcement>>([]);
    final isLoading = useState(false);
    final isLoadingMore = useState(false);
    final currentPage = useState(1);
    final hasMore = useState(true);
    final scrollController = useScrollController();

    // 加载公告列表
    Future<void> loadAnnouncements({bool refresh = false}) async {
      if (refresh) {
        currentPage.value = 1;
        hasMore.value = true;
        isLoading.value = true;
      } else {
        isLoadingMore.value = true;
      }

      try {
        final service = AnnouncementService();
        final result = await service.getAnnouncements(
          page: currentPage.value,
          pageSize: 10,
        );

        if (refresh) {
          announcements.value = result.items;
        } else {
          announcements.value = [...announcements.value, ...result.items];
        }

        // 如果返回的数据少于 pageSize，说明没有更多了
        if (result.items.length < 10) {
          hasMore.value = false;
        }

        currentPage.value++;
      } catch (e) {
        print('加载公告失败: $e');
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('加载失败: $e')),
          );
        }
      } finally {
        isLoading.value = false;
        isLoadingMore.value = false;
      }
    }

    // 监听滚动，实现分页加载
    useEffect(() {
      void onScroll() {
        if (scrollController.position.pixels >=
                scrollController.position.maxScrollExtent - 200 &&
            !isLoadingMore.value &&
            hasMore.value) {
          loadAnnouncements();
        }
      }

      scrollController.addListener(onScroll);
      return () => scrollController.removeListener(onScroll);
    }, [isLoadingMore.value, hasMore.value]);

    // 初始化加载
    useEffect(() {
      loadAnnouncements(refresh: true);
      return null;
    }, []);

    return Scaffold(
      appBar: AppBar(
        title: const Text('系统公告'),
      ),
      body: RefreshIndicator(
        onRefresh: () => loadAnnouncements(refresh: true),
        child: isLoading.value
            ? const Center(child: CircularProgressIndicator())
            : announcements.value.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Symbols.campaign,
                          size: 64,
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '暂无公告',
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                color: Theme.of(context).colorScheme.onSurfaceVariant,
                              ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    controller: scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: announcements.value.length + (hasMore.value ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == announcements.value.length) {
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: isLoadingMore.value
                                ? const CircularProgressIndicator()
                                : const Text('没有更多了'),
                          ),
                        );
                      }

                      final announcement = announcements.value[index];
                      return _buildAnnouncementItem(context, announcement);
                    },
                  ),
      ),
    );
  }

  Widget _buildAnnouncementItem(BuildContext context, Announcement announcement) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => AnnouncementDetailScreen(announcement: announcement),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (announcement.isHighPriority)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        '重要',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  if (announcement.isHighPriority) const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      announcement.title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    Icons.access_time,
                    size: 14,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    announcement.createdAt,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
