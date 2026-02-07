# AEGIS后端服务 Dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 创建数据目录
RUN mkdir -p /app/data /app/config

# 暴露端口
EXPOSE 7700 7701

# 启动命令
CMD ["npx", "tsx", "src/index.ts"]
