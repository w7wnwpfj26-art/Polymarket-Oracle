# 🔐 API密钥配置指南

## Polymarket API配置

### 1. 获取API凭据
访问 [Polymarket Developer Portal](https://docs.polymarket.com/#authentication) 获取API密钥：

**需要的凭据：**
- `API Key`
- `API Secret` 
- `API Passphrase`

### 2. 配置方式

#### 方式一：通过配置页面（推荐）
1. 访问 http://localhost:3008/config（或你的前端地址）
2. 找到 "🔮 Polymarket 对接" 部分
3. 填入以下信息：
   - Wallet Address: 你的以太坊钱包地址
   - API Key: 从Polymarket获取
   - API Secret: 从Polymarket获取  
   - API Passphrase: 从Polymarket获取
4. 点击 "💾 保存配置"

#### 方式二：直接编辑配置文件
```bash
nano backend/data/config.json
```

修改 `dataSources.polymarket` 部分：
```json
{
  "dataSources": {
    "polymarket": {
      "enabled": true,
      "apiBase": "https://gamma-api.polymarket.com",
      "clobApi": "https://clob.polymarket.com",
      "rateLimitPerMinute": 60,
      "walletAddress": "YOUR_WALLET_ADDRESS_HERE",
      "privateKey": "",  // 不建议在此处填写私钥
      "apiKey": "YOUR_API_KEY_HERE",
      "apiSecret": "YOUR_API_SECRET_HERE", 
      "apiPassphrase": "YOUR_API_PASSPHRASE_HERE"
    }
  }
}
```

### 3. 验证配置
重启后端服务后，系统将自动使用真实API而非模拟数据：

```bash
pm2 restart aegis-backend
```

访问仪表板查看市场数据是否来自真实API。

---

## The Odds API配置

### 1. 获取免费API密钥
访问 https://the-odds-api.com 注册获取免费密钥

### 2. 配置
在配置页面或config.json中填入：
```json
{
  "dataSources": {
    "oddsApi": {
      "enabled": true,
      "apiKey": "YOUR_ODDS_API_KEY_HERE",
      "apiBase": "https://api.the-odds-api.com/v4"
    }
  }
}
```

---

## 安全注意事项

⚠️ **重要提醒：**
- 不要在代码中硬编码API密钥
- 使用配置管理系统存储敏感信息
- 定期轮换API密钥
- 启用IP白名单（如果API提供商支持）
- 监控API使用量防止滥用

✅ **最佳实践：**
- 将密钥存储在环境变量中
- 使用加密存储敏感配置
- 实施API调用频率限制
- 记录所有API调用日志