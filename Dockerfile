# 使用官方 Node.js 18 alpine 映像
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package 檔案
COPY package*.json ./

# 安裝相依套件
RUN npm ci --only=production

# 複製應用程式檔案
COPY server.js ./
COPY public/ ./public/

# 建立非 root 使用者
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 變更擁有者
RUN chown -R nodejs:nodejs /app
USER nodejs

# 暴露埠號
EXPOSE 3000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 啟動應用程式
CMD ["node", "server.js"]