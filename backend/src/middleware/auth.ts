/**
 * 认证中间件 v2
 * JWT Token + API Key 双重认证 + 密码哈希 + 全局限流
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

// ============ 密码哈希工具 ============

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const ITERATIONS = 100_000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const computed = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
}

// ============ 配置 ============

function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (!envSecret || envSecret === 'aegis-secret-key-change-in-production') {
    // 在没有设置环境变量时，生成一个运行时随机密钥（每次重启会变）
    const runtimeSecret = crypto.randomBytes(32).toString('hex');
    logger.system.warn('JWT_SECRET not set in environment. Using random runtime secret. Tokens will not persist across restarts.');
    return runtimeSecret;
  }
  return envSecret;
}

const config: AuthConfig = {
  jwtSecret: getJwtSecret(),
  apiKeys: new Map<string, { name: string; role: string; rateLimit: number }>(),
  enabled: process.env.AUTH_ENABLED !== 'false', // 默认启用认证
};

// 从环境变量加载 API Key（格式: AEGIS_API_KEY_<NAME>=<key>:<role>:<rateLimit>）
function loadApiKeysFromEnv(): void {
  for (const [envKey, envVal] of Object.entries(process.env)) {
    if (envKey.startsWith('AEGIS_API_KEY_') && envVal) {
      const parts = envVal.split(':');
      if (parts.length >= 2) {
        const [apiKey, role, rateStr] = parts;
        const name = envKey.replace('AEGIS_API_KEY_', '').toLowerCase();
        config.apiKeys.set(apiKey, {
          name,
          role: role || 'readonly',
          rateLimit: parseInt(rateStr || '100', 10),
        });
        logger.system.info(`Loaded API key: ${name} (role=${role})`);
      }
    }
  }
  // 如果没有任何 API Key，加载默认的（仅开发模式）
  if (config.apiKeys.size === 0 && process.env.NODE_ENV !== 'production') {
    const devKey = `aegis-dev-${crypto.randomBytes(8).toString('hex')}`;
    config.apiKeys.set(devKey, { name: 'dev-key', role: 'admin', rateLimit: 1000 });
    logger.system.warn(`No API keys configured. Generated dev key: ${devKey}`);
  }
}

loadApiKeysFromEnv();

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
    
    // 使用 timingSafeEqual 防止时序攻击
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

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

// ============ 全局限流 ============

interface RateLimitEntry { count: number; resetTime: number }
const globalRateLimitStore = new Map<string, RateLimitEntry>();

// 定期清理过期条目
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of globalRateLimitStore) {
    if (entry.resetTime < now) globalRateLimitStore.delete(key);
  }
}, 60_000);

function checkRateLimit(identifier: string, limit: number, windowMs = 60_000): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  let entry = globalRateLimitStore.get(identifier);
  
  if (!entry || entry.resetTime < now) {
    entry = { count: 0, resetTime: now + windowMs };
    globalRateLimitStore.set(identifier, entry);
  }
  
  entry.count++;
  const allowed = entry.count <= limit;
  return { allowed, remaining: Math.max(0, limit - entry.count), resetTime: entry.resetTime };
}

/**
 * 全局限流中间件
 * 按 IP 地址限流
 * 开发环境: 1000次/分钟, 生产环境: 200次/分钟
 */
export const globalRateLimitMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown';

  // 开发环境或 localhost 放宽限流
  const isLocal = ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
  const defaultLimit = (process.env.NODE_ENV === 'production' && !isLocal) ? 200 : 1000;
  const limit = parseInt(process.env.RATE_LIMIT_PER_MINUTE || String(defaultLimit), 10);
  const { allowed, remaining, resetTime } = checkRateLimit(`global:${ip}`, limit);

  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

  if (!allowed) {
    logger.system.warn('Rate limit exceeded', { ip, limit });
    return c.json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
    }, 429);
  }

  return next();
});

// ============ 认证中间件 ============

/**
 * 认证中间件
 * 支持 Bearer Token (JWT) 和 API Key
 */
export const authMiddleware = createMiddleware(async (c: Context, next: Next) => {
  // 如果认证未启用，直接放行（但以 readonly 身份而非 admin）
  if (!config.enabled) {
    c.set('user', { sub: 'anonymous', role: 'readonly' });
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
      // 检查 API Key 级别的速率限制
      const keyInfo = config.apiKeys.get(apiKey)!;
      const rl = checkRateLimit(`apikey:${apiKey}`, keyInfo.rateLimit);
      if (!rl.allowed) {
        return c.json({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'API key rate limit exceeded' },
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
