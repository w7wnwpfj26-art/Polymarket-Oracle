# AEGIS前端服务 - 使用预构建文件
FROM nginx:alpine

# 复制已构建好的前端文件
COPY dist /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
