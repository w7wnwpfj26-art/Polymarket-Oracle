/**
 * 认证 API 路由 v2
 * 支持密码哈希、用户注册、登录
 */

import { Hono } from 'hono';
import { z } from 'zod';
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
  hashPassword,
  verifyPassword,
} from '../middleware/auth';

export const authRoutes = new Hono();

// ============ Zod 校验 ============

const loginSchema = z.object({
  username: z.string().min(2).max(64),
  password: z.string().min(6).max(128),
});

const registerSchema = z.object({
  username: z.string().min(2).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Username must be alphanumeric'),
  password: z.string().min(8).max(128),
  role: z.enum(['admin', 'user', 'readonly']).default('user'),
});

const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(64),
  role: z.enum(['admin', 'user', 'readonly']),
  rateLimit: z.number().int().min(1).max(10000).optional().default(100),
});

const configureAuthSchema = z.object({
  enabled: z.boolean().optional(),
  jwtSecret: z.string().min(16).optional(),
});

// ============ 用户存储（内存 + 密码哈希） ============
// 生产环境应迁移至数据库

interface UserRecord {
  passwordHash: string;
  role: 'admin' | 'user' | 'readonly';
  createdAt: string;
}

const users = new Map<string, UserRecord>();

// 初始化默认管理员（密码从环境变量读取）
function initDefaultUsers() {
  const adminPassword = process.env.AEGIS_ADMIN_PASSWORD || 'AegisAdmin@2026';
  users.set('admin', {
    passwordHash: hashPassword(adminPassword),
    role: 'admin',
    createdAt: new Date().toISOString(),
  });
}
initDefaultUsers();

// ============ 路由 ============

// 登录获取 JWT
authRoutes.post('/login', async (c) => {
  const start = Date.now();
  
  let body: z.infer<typeof loginSchema>;
  try {
    body = loginSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Invalid request body' },
    }, 400);
  }
  
  const user = users.get(body.username);
  
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
      meta: { timestamp: new Date().toISOString(), requestId: crypto.randomUUID(), processingTimeMs: Date.now() - start },
    }, 401);
  }
  
  const token = signJWT({ sub: body.username, role: user.role });
  
  return c.json<ApiResponse<{ token: string; expiresIn: number; role: string }>>({
    success: true,
    data: { token, expiresIn: 86400, role: user.role },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 注册新用户（仅管理员）
authRoutes.post('/register', authMiddleware, requireRole('admin'), async (c) => {
  const start = Date.now();
  
  let body: z.infer<typeof registerSchema>;
  try {
    body = registerSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Invalid request body' },
    }, 400);
  }
  
  if (users.has(body.username)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'USER_EXISTS', message: 'Username already taken' },
    }, 409);
  }
  
  users.set(body.username, {
    passwordHash: hashPassword(body.password),
    role: body.role,
    createdAt: new Date().toISOString(),
  });
  
  return c.json<ApiResponse<{ username: string; role: string }>>({
    success: true,
    data: { username: body.username, role: body.role },
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
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
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
  
  let body: z.infer<typeof configureAuthSchema>;
  try {
    body = configureAuthSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Invalid request body' },
    }, 400);
  }
  
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
  
  let body: z.infer<typeof apiKeyCreateSchema>;
  try {
    body = apiKeyCreateSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Invalid request body' },
    }, 400);
  }
  
  // 生成随机 Key
  const key = `aegis-${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
  
  addApiKey(key, body.name, body.role, body.rateLimit);
  
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
