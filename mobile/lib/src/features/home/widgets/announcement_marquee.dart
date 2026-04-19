import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'dart:async';
import '../models/announcement.dart';

/// 自动滚动公告条
class AnnouncementMarquee extends HookWidget {
  final List<Announcement> announcements;
  final VoidCallback onTap;

  const AnnouncementMarquee({
    super.key,
    required this.announcements,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final currentIndex = useState(0);
    final controller = useAnimationController(
      duration: const Duration(milliseconds: 500),
    );

    // 自动切换公告
    useEffect(() {
      if (announcements.isEmpty) return null;

      Timer? timer;
      if (announcements.length > 1) {
        timer = Timer.periodic(const Duration(seconds: 5), (t) {
          controller.forward(from: 0);
          Future.delayed(const Duration(milliseconds: 500), () {
            currentIndex.value = (currentIndex.value + 1) % announcements.length;
          });
        });
      }

      return () => timer?.cancel();
    }, [announcements.length]);

    if (announcements.isEmpty) {
      return const SizedBox.shrink();
    }

    return Card(
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Icon(
                Icons.campaign,
                color: Theme.of(context).colorScheme.primary,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 500),
                  transitionBuilder: (child, animation) {
                    return FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: Tween<Offset>(
                          begin: const Offset(0, 0.3),
                          end: Offset.zero,
                        ).animate(animation),
                        child: child,
                      ),
                    );
                  },
                  child: Text(
                    announcements[currentIndex.value].title,
                    key: ValueKey(currentIndex.value),
                    style: Theme.of(context).textTheme.bodyMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
