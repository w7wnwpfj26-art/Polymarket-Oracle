/**
 * 认证中间件
 * JWT Token + API Key 双重认证
 */

import { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import crypto from 'node:crypto';
import logger from '../utils/logger';

// ============ 类型定义 ============

interface JWTPayload {
  sub: string;        // 用户 ID
  role: 'admin' | 'user' | 'readonly';
  exp: number;        // 过期时间
  iat: number;        // 签发时间
}

interface AuthConfig {
  jwtSecret: string;
  apiKeys: Map<string, { name: string; role: string; rateLimit: number }>;
  enabled: boolean;
}

// ============ 配置 ============

const config: AuthConfig = {
  jwtSecret: process.env.JWT_SECRET || 'aegis-secret-key-change-in-production',
  apiKeys: new Map([
    ['aegis-demo-key', { name: 'Demo', role: 'readonly', rateLimit: 100 }],
    ['aegis-admin-key', { name: 'Admin', role: 'admin', rateLimit: 1000 }],
  ]),
  enabled: process.env.AUTH_ENABLED === 'true',
};

// ============ JWT 工具函数 ============

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString();
}

function createHmacSignature(data: string, secret: string): string {
  return base64UrlEncode(
    crypto.createHmac('sha256', secret).update(data).digest('base64')
  );
}

// ============ JWT 函数 ============

export function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn = 86400): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const headerBase64 = base64UrlEncode(JSON.stringify(header));
  const payloadBase64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createHmacSignature(`${headerBase64}.${payloadBase64}`, config.jwtSecret);

  return `${headerBase64}.${payloadBase64}.${signature}`;
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerBase64, payloadBase64, signature] = parts;
    
    // 验证签名
    const expectedSignature = createHmacSignature(`${headerBase64}.${payloadBase64}`, config.jwtSecret);
    if (signature !== expectedSignature) return null;

    // 解析 payload
    const payload: JWTPayload = JSON.parse(base64UrlDecode(payloadBase64));

    // 检查过期
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ============ API Key 函数 ============

export function validateApiKey(key: string): { valid: boolean; name?: string; role?: string } {
  const keyInfo = config.apiKeys.get(key);
  if (!keyInfo) {
    return { valid: false };
  }
  return { valid: true, name: keyInfo.name, role: keyInfo.role };
}

export function addApiKey(key: string, name: string, role: string, rateLimit = 100): void {
  config.apiKeys.set(key, { name, role, rateLimit });
}

export function removeApiKey(key: string): boolean {
  return config.apiKeys.delete(key);
}

export function listApiKeys(): { key: string; name: string; role: string }[] {
  return Array.from(config.apiKeys.entries()).map(([key, info]) => ({
    key: key.substring(0, 8) + '...',
    name: info.name,
    role: info.role,
  }));
}

// ============ 速率限制 ============

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string, limit: number): boolean {
  const now = Date.now();
  const windowMs = 60000; // 1 分钟窗口
  
  let entry = rateLimitStore.get(identifier);
  
  if (!entry || entry.resetTime < now) {
    entry = { count: 0, resetTime: now + windowMs };
    rateLimitStore.set(identifier, entry);
  }
  
  entry.count++;
  
  return entry.count <= limit;
}

// ============ 中间件 ============

/**
 * 认证中间件
 * 支持 Bearer Token (JWT) 和 API Key
 */
export const authMiddleware = createMiddleware(async (c: Context, next: Next) => {
  // 如果认证未启用，直接放行
  if (!config.enabled) {
    c.set('user', { sub: 'anonymous', role: 'admin' });
    return next();
  }

  const authHeader = c.req.header('Authorization');
  const apiKey = c.req.header('X-API-Key');

  // 尝试 JWT 认证
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyJWT(token);
    
    if (payload) {
      c.set('user', payload);
      logger.system.debug('JWT auth success', { sub: payload.sub });
      return next();
    }
    
    return c.json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    }, 401);
  }

  // 尝试 API Key 认证
  if (apiKey) {
    const result = validateApiKey(apiKey);
    
    if (result.valid) {
      // 检查速率限制
      const keyInfo = config.apiKeys.get(apiKey)!;
      if (!checkRateLimit(apiKey, keyInfo.rateLimit)) {
        return c.json({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many requests' },
        }, 429);
      }
      
      c.set('user', { sub: result.name, role: result.role });
      logger.system.debug('API Key auth success', { name: result.name });
      return next();
    }
    
    return c.json({
      success: false,
      error: { code: 'INVALID_API_KEY', message: 'Invalid API key' },
    }, 401);
  }

  // 无认证信息
  return c.json({
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
  }, 401);
});

/**
 * 角色检查中间件
 */
export function requireRole(...roles: string[]) {
  return createMiddleware(async (c: Context, next: Next) => {
    const user = c.get('user');
    
    if (!user || !roles.includes(user.role)) {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      }, 403);
    }
    
    return next();
  });
}

/**
 * 可选认证中间件
 * 有认证信息就验证，没有就匿名访问
 */
export const optionalAuth = createMiddleware(async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  const apiKey = c.req.header('X-API-Key');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyJWT(token);
    if (payload) {
      c.set('user', payload);
    }
  } else if (apiKey) {
    const result = validateApiKey(apiKey);
    if (result.valid) {
      c.set('user', { sub: result.name, role: result.role });
    }
  }

  if (!c.get('user')) {
    c.set('user', { sub: 'anonymous', role: 'readonly' });
  }

  return next();
});

// ============ 配置函数 ============

export function configureAuth(options: Partial<AuthConfig>): void {
  if (options.jwtSecret) config.jwtSecret = options.jwtSecret;
  if (options.enabled !== undefined) config.enabled = options.enabled;
}

export function isAuthEnabled(): boolean {
  return config.enabled;
}
