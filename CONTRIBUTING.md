# Contributing to AEGIS Arbitrage System

感谢你对 AEGIS 套利系统的关注！欢迎贡献代码、报告问题或提出建议。

## 行为准则

请阅读 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)，参与本项目即表示同意遵守该准则。

## 如何贡献

### 报告 Bug

1. 在 [Issues](https://github.com/YOUR_USERNAME/aegis-arbitrage/issues) 中搜索是否已有类似问题
2. 若无，新建 Issue，描述：
   - 复现步骤
   - 预期行为
   - 实际行为
   - 环境（OS、Node 版本等）

### 提交代码

1. Fork 本仓库
2. 创建分支：`git checkout -b feature/your-feature` 或 `fix/your-fix`
3. 遵循项目代码风格，运行测试：`cd backend && npm run test`
4. 提交：`git commit -m "feat: 简短描述"`
5. 推送：`git push origin feature/your-feature`
6. 创建 Pull Request

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `chore:` 构建/工具
- `refactor:` 重构
- `test:` 测试

### 代码风格

- TypeScript：遵循项目现有风格
- 新增 API 需在 `backend/src/api/openapi.ts` 中补充文档
- 敏感信息禁止硬编码，使用环境变量或配置

## 开发环境

```bash
# 克隆
git clone https://github.com/YOUR_USERNAME/aegis-arbitrage.git
cd aegis-arbitrage

# 配置
cp .env.example .env
cp backend/data/config.json.example backend/data/config.json
# 编辑 .env 和 config.json 填入必要配置（勿提交真实密钥）

# 安装与运行
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

## 安全

- 请勿在 PR 或 Issue 中暴露 API 密钥、私钥等敏感信息
- 发现安全漏洞请通过私密渠道联系维护者，而非公开 Issue
