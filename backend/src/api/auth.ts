/**
 * 认证 API 路由
 */

import { Hono } from 'hono';
import type { ApiResponse } from '../core/types';
import { 
  signJWT, 
  validateApiKey, 
  addApiKey, 
  removeApiKey, 
  listApiKeys,
  configureAuth,
  isAuthEnabled,
  authMiddleware,
  requireRole,
} from '../middleware/auth';

export const authRoutes = new Hono();

// 用户数据库（演示用，生产环境应使用真实数据库）
const users = new Map<string, { password: string; role: 'admin' | 'user' | 'readonly' }>([
  ['admin', { password: 'admin123', role: 'admin' }],
  ['user', { password: 'user123', role: 'user' }],
]);

// 登录获取 JWT
authRoutes.post('/login', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{ username: string; password: string }>();
  
  const user = users.get(body.username);
  
  if (!user || user.password !== body.password) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' },
      meta: { timestamp: new Date().toISOString() },
    }, 401);
  }
  
  const token = signJWT({ sub: body.username, role: user.role });
  
  return c.json<ApiResponse<{ token: string; expiresIn: number }>>({
    success: true,
    data: { token, expiresIn: 86400 },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 刷新 Token
authRoutes.post('/refresh', authMiddleware, async (c) => {
  const start = Date.now();
  const user = c.get('user');
  
  if (!user) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '未登录' },
      meta: { timestamp: new Date().toISOString() },
    }, 401);
  }
  
  const token = signJWT({ sub: user.sub, role: user.role });
  
  return c.json<ApiResponse<{ token: string; expiresIn: number }>>({
    success: true,
    data: { token, expiresIn: 86400 },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取当前用户信息
authRoutes.get('/me', authMiddleware, async (c) => {
  const start = Date.now();
  const user = c.get('user');
  
  return c.json<ApiResponse<{ sub: string; role: string }>>({
    success: true,
    data: { sub: user?.sub || 'anonymous', role: user?.role || 'readonly' },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取认证状态
authRoutes.get('/status', async (c) => {
  const start = Date.now();
  
  return c.json<ApiResponse<{ enabled: boolean }>>({
    success: true,
    data: { enabled: isAuthEnabled() },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 配置认证
authRoutes.post('/configure', authMiddleware, requireRole('admin'), async (c) => {
  const start = Date.now();
  const body = await c.req.json<{ enabled?: boolean; jwtSecret?: string }>();
  
  configureAuth(body);
  
  return c.json<ApiResponse<{ configured: boolean }>>({
    success: true,
    data: { configured: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// ============ API Key 管理 ============

// 列出 API Keys
authRoutes.get('/api-keys', authMiddleware, requireRole('admin'), async (c) => {
  const start = Date.now();
  const keys = listApiKeys();
  
  return c.json<ApiResponse<typeof keys>>({
    success: true,
    data: keys,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 创建 API Key
authRoutes.post('/api-keys', authMiddleware, requireRole('admin'), async (c) => {
  const start = Date.now();
  const body = await c.req.json<{ name: string; role: string; rateLimit?: number }>();
  
  // 生成随机 Key
  const key = `aegis-${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
  
  addApiKey(key, body.name, body.role, body.rateLimit || 100);
  
  return c.json<ApiResponse<{ key: string; name: string; role: string }>>({
    success: true,
    data: { key, name: body.name, role: body.role },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 删除 API Key
authRoutes.delete('/api-keys/:key', authMiddleware, requireRole('admin'), async (c) => {
  const start = Date.now();
  const key = c.req.param('key');
  
  const deleted = removeApiKey(key);
  
  return c.json<ApiResponse<{ deleted: boolean }>>({
    success: deleted,
    data: { deleted },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 验证 API Key
authRoutes.post('/api-keys/validate', authMiddleware, requireRole('admin'), async (c) => {
  const start = Date.now();
  const body = await c.req.json<{ key: string }>();
  
  const result = validateApiKey(body.key);
  
  return c.json<ApiResponse<typeof result>>({
    success: result.valid,
    data: result,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});
