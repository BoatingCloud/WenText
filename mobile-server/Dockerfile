FROM php:8.1-cli

WORKDIR /app

# 复制项目文件
COPY . .

# 创建 storage 目录并设置权限
RUN mkdir -p storage && chmod 777 storage

# 初始化数据库
RUN php scripts/migrate.php && php scripts/seed.php

# 暴露端口
EXPOSE 8080

# 启动服务
CMD ["php", "-S", "0.0.0.0:8080", "-t", "public", "public/index.php"]
