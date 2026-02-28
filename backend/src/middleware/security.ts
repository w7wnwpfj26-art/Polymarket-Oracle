/**
 * Security Headers Middleware
 * Implements security best practices for HTTP headers
 */

import { Context, Next } from 'hono';

export interface SecurityHeadersOptions {
  contentSecurityPolicy?: boolean | object;
  hsts?: boolean | { maxAge?: number; includeSubDomains?: boolean; preload?: boolean };
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  xContentTypeOptions?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: string;
}

const DEFAULT_OPTIONS: SecurityHeadersOptions = {
  contentSecurityPolicy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  xFrameOptions: 'DENY',
  xContentTypeOptions: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: 'geolocation=(), microphone=(), camera=()'
};

export function securityHeaders(options: SecurityHeadersOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return async (c: Context, next: Next) => {
    // Content Security Policy
    if (opts.contentSecurityPolicy) {
      const csp = typeof opts.contentSecurityPolicy === 'object'
        ? buildCSP(opts.contentSecurityPolicy as Record<string, string | string[]>)
        : [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // For Vue/Vite
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' ws: wss:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
          ].join('; ');
      
      c.header('Content-Security-Policy', csp);
    }
    
    // HTTP Strict Transport Security
    if (opts.hsts) {
      const hstsValue = typeof opts.hsts === 'object'
        ? `max-age=${opts.hsts.maxAge || 31536000}${opts.hsts.includeSubDomains ? '; includeSubDomains' : ''}${opts.hsts.preload ? '; preload' : ''}`
        : 'max-age=31536000; includeSubDomains; preload';
      
      c.header('Strict-Transport-Security', hstsValue);
    }
    
    // X-Frame-Options
    if (opts.xFrameOptions) {
      c.header('X-Frame-Options', opts.xFrameOptions);
    }
    
    // X-Content-Type-Options
    if (opts.xContentTypeOptions) {
      c.header('X-Content-Type-Options', 'nosniff');
    }
    
    // Referrer-Policy
    if (opts.referrerPolicy) {
      c.header('Referrer-Policy', opts.referrerPolicy);
    }
    
    // Permissions-Policy
    if (opts.permissionsPolicy) {
      c.header('Permissions-Policy', opts.permissionsPolicy);
    }
    
    // Additional security headers
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('X-DNS-Prefetch-Control', 'off');
    c.header('X-Download-Options', 'noopen');
    c.header('X-Permitted-Cross-Domain-Policies', 'none');
    
    // Remove server identification
    c.header('X-Powered-By', ''); // Hide tech stack
    
    await next();
  };
}

function buildCSP(policy: Record<string, string | string[]>): string {
  return Object.entries(policy)
    .map(([key, value]) => {
      const values = Array.isArray(value) ? value : [value];
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * CORS Enhanced Middleware
 * Provides strict CORS configuration with credential support
 */
export interface CORSOptions {
  origins: string[];
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
}

export function enhancedCORS(options: CORSOptions) {
  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin');
    
    // Check if origin is allowed
    if (origin && options.origins.includes(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      
      if (options.credentials) {
        c.header('Access-Control-Allow-Credentials', 'true');
      }
    } else if (options.origins.includes('*')) {
      c.header('Access-Control-Allow-Origin', '*');
    }
    
    // Handle preflight
    if (c.req.method === 'OPTIONS') {
      if (options.allowMethods) {
        c.header('Access-Control-Allow-Methods', options.allowMethods.join(', '));
      }
      
      if (options.allowHeaders) {
        c.header('Access-Control-Allow-Headers', options.allowHeaders.join(', '));
      }
      
      if (options.maxAge) {
        c.header('Access-Control-Max-Age', options.maxAge.toString());
      }
      
      return c.text('', 204 as any);
    }
    
    // Expose headers
    if (options.exposeHeaders) {
      c.header('Access-Control-Expose-Headers', options.exposeHeaders.join(', '));
    }
    
    await next();
  };
}

/**
 * Rate Limiting by IP with sliding window
 */
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for') || 
               c.req.header('x-real-ip') || 
               'unknown';
    
    const now = Date.now();
    const record = requestCounts.get(ip);
    
    if (!record || now > record.resetTime) {
      // New window
      requestCounts.set(ip, {
        count: 1,
        resetTime: now + config.windowMs
      });
    } else {
      // Existing window
      record.count++;
      
      if (record.count > config.maxRequests) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        c.header('Retry-After', retryAfter.toString());
        c.header('X-RateLimit-Limit', config.maxRequests.toString());
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', record.resetTime.toString());
        
        return c.json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: config.message || 'Too many requests, please try again later'
          }
        }, 429);
      }
    }
    
    // Add rate limit headers
    const remaining = config.maxRequests - (record?.count || 0);
    c.header('X-RateLimit-Limit', config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, remaining).toString());
    c.header('X-RateLimit-Reset', (record?.resetTime || now + config.windowMs).toString());
    
    await next();
  };
}

// Cleanup old rate limit records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetTime + 60000) { // 1 minute grace period
      requestCounts.delete(ip);
    }
  }
}, 600000);
