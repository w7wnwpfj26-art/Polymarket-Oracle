#!/bin/bash

# AEGIS GitLab 初始化脚本
# 自动配置GitLab仓库和首次推送

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印带颜色的消息
info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# GitLab配置
GITLAB_URL="http://121.41.231.194:10886"
GITLAB_USER="wangqi"
PROJECT_NAME="aegis-arbitrage"
REMOTE_URL="${GITLAB_URL}/${GITLAB_USER}/${PROJECT_NAME}.git"

echo "========================================="
echo "   AEGIS GitLab 初始化脚本"
echo "========================================="
echo ""

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    error "请在项目根目录运行此脚本"
fi

# 检查Git是否已初始化
if [ ! -d ".git" ]; then
    info "初始化Git仓库..."
    git init
    success "Git仓库已初始化"
else
    info "Git仓库已存在"
fi

# 检查是否已有remote
if git remote get-url origin &> /dev/null; then
    CURRENT_REMOTE=$(git remote get-url origin)
    warning "已存在remote origin: $CURRENT_REMOTE"
    read -p "是否要替换为GitLab remote? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git remote remove origin
        info "已删除旧的remote"
    else
        info "保持现有remote"
        exit 0
    fi
fi

# 添加GitLab remote
info "添加GitLab remote..."
git remote add origin "$REMOTE_URL"
success "GitLab remote已添加: $REMOTE_URL"

# 检查是否有未提交的更改
if [[ -n $(git status -s) ]]; then
    info "检测到未提交的更改"
    read -p "是否要提交所有更改? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "chore: 初始化AEGIS套利系统"
        success "更改已提交"
    else
        warning "存在未提交的更改，跳过提交"
    fi
else
    info "工作目录干净"
fi

# 检查是否有commits
if ! git log &> /dev/null; then
    error "没有commits可推送，请先创建初始提交"
fi

# 推送到GitLab
info "推送到GitLab..."
echo ""
warning "即将推送到: $REMOTE_URL"
warning "请确保已在GitLab创建项目: ${PROJECT_NAME}"
echo ""
read -p "继续推送? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 尝试推送
    if git push -u origin main 2>/dev/null; then
        success "代码已推送到GitLab"
    elif git push -u origin master 2>/dev/null; then
        success "代码已推送到GitLab (master分支)"
    else
        error "推送失败，请检查：
1. GitLab项目是否已创建
2. 用户名密码是否正确
3. 网络连接是否正常

手动推送命令：
git push -u origin main"
    fi
else
    info "已取消推送"
    exit 0
fi

echo ""
echo "========================================="
success "GitLab初始化完成！"
echo "========================================="
echo ""
info "下一步："
echo "1. 访问项目: ${GITLAB_URL}/${GITLAB_USER}/${PROJECT_NAME}"
echo "2. 配置GitLab Runner（Settings → CI/CD → Runners）"
echo "3. 设置CI/CD环境变量（Settings → CI/CD → Variables）："
echo "   - GITLAB_TOKEN"
echo "   - ENCRYPTION_KEY"
echo "4. 推送tag触发首次构建："
echo "   npm run version:patch"
echo "   git push origin --tags"
echo ""
info "详细文档: ./DEPLOYMENT_GUIDE.md"
echo ""
