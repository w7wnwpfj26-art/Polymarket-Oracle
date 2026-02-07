/**
 * Traditional Betting Sites API
 * 管理传统博彩网站的自动化操作
 */

import { Hono } from 'hono';
import type { ApiResponse } from '../core/types';
import traditionalBettingService, { 
  BettingSiteConfig, 
  SITE_TEMPLATES 
} from '../services/traditionalBetting';
import { captchaSolver, CaptchaConfig } from '../services/captchaSolver';
import { twoFactorAuth, TwoFactorConfig } from '../services/twoFactorAuth';
import { bettingSiteRepository } from '../db/bettingSiteRepository';
import { oddsParser } from '../services/oddsParser';

export const traditionalBettingRoutes = new Hono();

// ============ 服务状态 ============

// 获取服务状态
traditionalBettingRoutes.get('/status', async (c) => {
  const start = Date.now();
  const status = traditionalBettingService.getStatus();
  
  return c.json<ApiResponse<typeof status>>({
    success: true,
    data: status,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 初始化浏览器
traditionalBettingRoutes.post('/initialize', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{
    headless?: boolean;
    proxyServer?: string;
  }>().catch(() => ({}));
  
  const success = await traditionalBettingService.initialize(body);
  
  return c.json<ApiResponse<{ initialized: boolean }>>({
    success,
    data: { initialized: success },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 关闭服务
traditionalBettingRoutes.post('/shutdown', async (c) => {
  const start = Date.now();
  await traditionalBettingService.shutdown();
  
  return c.json<ApiResponse<{ shutdown: boolean }>>({
    success: true,
    data: { shutdown: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// ============ 验证码配置 ============

// 配置验证码服务
traditionalBettingRoutes.post('/captcha/configure', async (c) => {
  const start = Date.now();
  const config = await c.req.json<CaptchaConfig>();
  
  traditionalBettingService.configureCaptcha(config);
  
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

// 获取验证码配置
traditionalBettingRoutes.get('/captcha/config', async (c) => {
  const start = Date.now();
  const config = captchaSolver.getConfig();
  
  // 隐藏 API key
  const safeConfig = {
    ...config,
    apiKey: config.apiKey ? '***masked***' : '',
  };
  
  return c.json<ApiResponse<typeof safeConfig>>({
    success: true,
    data: safeConfig,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// ============ 二次验证 ============

// 配置网站的二次验证
traditionalBettingRoutes.post('/sites/:name/2fa/configure', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  const config = await c.req.json<TwoFactorConfig>();
  
  twoFactorAuth.configureSite(name, config);
  
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

// 提交验证码（用于 SMS/Email/Manual 验证）
traditionalBettingRoutes.post('/sites/:name/2fa/submit-code', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  const body = await c.req.json<{
    type: 'sms' | 'email' | 'manual';
    code: string;
  }>();
  
  twoFactorAuth.submitCode(body.type, name, body.code);
  
  return c.json<ApiResponse<{ submitted: boolean }>>({
    success: true,
    data: { submitted: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// ============ 网站管理 ============

// 获取可用模板
traditionalBettingRoutes.get('/templates', async (c) => {
  const start = Date.now();
  
  return c.json<ApiResponse<typeof SITE_TEMPLATES>>({
    success: true,
    data: SITE_TEMPLATES,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取已保存的所有网站
traditionalBettingRoutes.get('/sites/saved', async (c) => {
  const start = Date.now();
  
  const sites = await bettingSiteRepository.getAllSites();
  
  // 隐藏密码
  const safeSites = sites.map(s => ({
    ...s,
    password: '***masked***',
    twoFactorSecret: s.twoFactorSecret ? '***masked***' : null,
  }));
  
  return c.json<ApiResponse<typeof safeSites>>({
    success: true,
    data: safeSites,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 添加网站配置
traditionalBettingRoutes.post('/sites', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{
    name: string;
    url: string;
    username: string;
    password: string;
    template?: string;
    customSelectors?: Partial<BettingSiteConfig['selectors']>;
    proxyServer?: string;
    twoFactor?: TwoFactorConfig;
  }>();
  
  // 使用模板或自定义选择器
  const baseSelectors = body.template 
    ? SITE_TEMPLATES[body.template] || SITE_TEMPLATES.sportsbook
    : SITE_TEMPLATES.sportsbook;
  
  const config: BettingSiteConfig = {
    name: body.name,
    url: body.url,
    username: body.username,
    password: body.password,
    proxyServer: body.proxyServer,
    twoFactor: body.twoFactor,
    selectors: {
      usernameInput: body.customSelectors?.usernameInput || baseSelectors.usernameInput || '',
      passwordInput: body.customSelectors?.passwordInput || baseSelectors.passwordInput || '',
      submitButton: body.customSelectors?.submitButton || baseSelectors.submitButton || '',
      loginSuccessIndicator: body.customSelectors?.loginSuccessIndicator || baseSelectors.loginSuccessIndicator || '',
      oddsContainer: body.customSelectors?.oddsContainer || baseSelectors.oddsContainer || '',
      oddsItem: body.customSelectors?.oddsItem || baseSelectors.oddsItem || '',
      oddsValue: body.customSelectors?.oddsValue || baseSelectors.oddsValue || '',
      eventName: body.customSelectors?.eventName || baseSelectors.eventName || '',
      ...body.customSelectors,
    },
  };
  
  await traditionalBettingService.addSite(config, true);
  
  return c.json<ApiResponse<{ added: boolean; name: string }>>({
    success: true,
    data: { added: true, name: body.name },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 删除网站配置
traditionalBettingRoutes.delete('/sites/:name', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  
  await traditionalBettingService.closeSite(name);
  await bettingSiteRepository.deleteSite(name);
  
  return c.json<ApiResponse<{ deleted: boolean }>>({
    success: true,
    data: { deleted: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 永久删除网站配置
traditionalBettingRoutes.delete('/sites/:name/permanent', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  
  await traditionalBettingService.closeSite(name);
  await bettingSiteRepository.hardDeleteSite(name);
  
  return c.json<ApiResponse<{ deleted: boolean }>>({
    success: true,
    data: { deleted: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// ============ 登录操作 ============

// 登录网站
traditionalBettingRoutes.post('/sites/:name/login', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  const success = await traditionalBettingService.login(name);
  
  return c.json<ApiResponse<{ loggedIn: boolean }>>({
    success,
    data: { loggedIn: success },
    error: success ? undefined : {
      code: 'LOGIN_FAILED',
      message: `Failed to login to ${name}`,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 登出网站
traditionalBettingRoutes.post('/sites/:name/logout', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  await traditionalBettingService.logout(name);
  
  return c.json<ApiResponse<{ loggedOut: boolean }>>({
    success: true,
    data: { loggedOut: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// ============ 赔率操作 ============

// 获取赔率
traditionalBettingRoutes.get('/sites/:name/odds', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  const odds = await traditionalBettingService.getOdds(name);
  
  return c.json<ApiResponse<typeof odds>>({
    success: true,
    data: odds,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取赔率历史
traditionalBettingRoutes.get('/sites/:name/odds/history', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  const eventName = c.req.query('event');
  const limit = parseInt(c.req.query('limit') || '100');
  const startTime = c.req.query('start');
  const endTime = c.req.query('end');
  
  const history = await bettingSiteRepository.getOddsHistory({
    siteName: name,
    eventName: eventName || undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
    limit,
  });
  
  return c.json<ApiResponse<typeof history>>({
    success: true,
    data: history,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取赔率统计
traditionalBettingRoutes.get('/sites/:name/odds/stats', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  const eventName = c.req.query('event');
  
  if (!eventName) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'MISSING_EVENT', message: 'Event name is required' },
      meta: { timestamp: new Date().toISOString() },
    }, 400);
  }
  
  const stats = await bettingSiteRepository.getOddsStats(name, eventName);
  
  return c.json<ApiResponse<typeof stats>>({
    success: true,
    data: stats,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 开始监控
traditionalBettingRoutes.post('/sites/:name/monitor/start', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  const body = await c.req.json<{ intervalMs?: number }>().catch(() => ({}));
  
  traditionalBettingService.startMonitoring(name, body.intervalMs || 5000);
  
  return c.json<ApiResponse<{ monitoring: boolean }>>({
    success: true,
    data: { monitoring: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 停止监控
traditionalBettingRoutes.post('/sites/:name/monitor/stop', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  
  traditionalBettingService.stopMonitoring(name);
  
  return c.json<ApiResponse<{ monitoring: boolean }>>({
    success: true,
    data: { monitoring: false },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// ============ 下注操作 ============

// 下注
traditionalBettingRoutes.post('/sites/:name/bet', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  const body = await c.req.json<{
    selection: string;
    amount: number;
    odds: number;
  }>();
  
  const result = await traditionalBettingService.placeBet(name, body);
  
  return c.json<ApiResponse<typeof result>>({
    success: result.success,
    data: result,
    error: result.success ? undefined : {
      code: 'BET_FAILED',
      message: result.errorMessage || 'Bet failed',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取余额
traditionalBettingRoutes.get('/sites/:name/balance', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  const balance = await traditionalBettingService.getBalance(name);
  
  return c.json<ApiResponse<{ balance: number | null }>>({
    success: balance !== null,
    data: { balance },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// ============ 页面操作 ============

// 截图
traditionalBettingRoutes.post('/sites/:name/screenshot', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  const path = await traditionalBettingService.takeScreenshot(name);
  
  return c.json<ApiResponse<{ path: string | null }>>({
    success: path !== null,
    data: { path },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 刷新页面
traditionalBettingRoutes.post('/sites/:name/refresh', async (c) => {
  const start = Date.now();
  const name = c.req.param('name');
  await traditionalBettingService.refresh(name);
  
  return c.json<ApiResponse<{ refreshed: boolean }>>({
    success: true,
    data: { refreshed: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// ============ 赔率解析工具 ============

// 解析赔率
traditionalBettingRoutes.post('/odds/parse', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{ odds: string | string[] }>();
  
  const odds = Array.isArray(body.odds) ? body.odds : [body.odds];
  const parsed = odds.map(o => oddsParser.parse(o));
  
  return c.json<ApiResponse<typeof parsed>>({
    success: true,
    data: parsed,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 转换赔率格式
traditionalBettingRoutes.post('/odds/convert', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{
    odds: string;
    targetFormat: 'decimal' | 'fractional' | 'american' | 'hongkong' | 'malay' | 'indonesian';
  }>();
  
  const parsed = oddsParser.parse(body.odds);
  const formatted = oddsParser.formatDisplay(parsed.decimal, body.targetFormat);
  
  return c.json<ApiResponse<{ original: string; converted: string; decimal: number }>>({
    success: true,
    data: {
      original: body.odds,
      converted: formatted,
      decimal: parsed.decimal,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 清理旧赔率数据
traditionalBettingRoutes.post('/odds/cleanup', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{ daysToKeep?: number }>().catch(() => ({}));
  
  const deleted = await bettingSiteRepository.cleanupOldOdds(body.daysToKeep || 30);
  
  return c.json<ApiResponse<{ deleted: number }>>({
    success: true,
    data: { deleted },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});
