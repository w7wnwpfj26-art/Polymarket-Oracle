/**
 * Traditional Betting Site Automation Service
 * Uses Playwright for browser automation
 * 
 * 支持的功能：
 * - 自动登录（含验证码处理）
 * - 二次验证处理
 * - 赔率监控
 * - 自动下注
 * - 余额查询
 * - 断线重连
 * - 代理支持
 * - 多账户管理
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import logger from '../utils/logger';
import wsService from './websocket';
import { captchaSolver, CaptchaConfig } from './captchaSolver';
import { twoFactorAuth, TwoFactorConfig } from './twoFactorAuth';
import { bettingSiteRepository, OddsHistoryRecord } from '../db/bettingSiteRepository';
import { oddsParser, OddsFormat } from './oddsParser';

// ============ 类型定义 ============

export interface BettingSiteConfig {
  name: string;
  url: string;
  username: string;
  password: string;
  selectors: BettingSiteSelectors;
  proxyServer?: string;
  twoFactor?: TwoFactorConfig;
  accounts?: AccountConfig[]; // 多账户
}

export interface AccountConfig {
  username: string;
  password: string;
  twoFactorSecret?: string;
  isActive: boolean;
  lastUsed?: Date;
}

export interface BettingSiteSelectors {
  // 登录相关
  loginButton?: string;
  usernameInput: string;
  passwordInput: string;
  submitButton: string;
  loginSuccessIndicator: string;
  
  // 验证码相关
  captchaImage?: string;
  captchaInput?: string;
  sliderButton?: string;
  sliderTrack?: string;
  
  // 二次验证相关
  twoFactorInput?: string;
  twoFactorSubmit?: string;
  
  // 赔率相关
  oddsContainer: string;
  oddsItem: string;
  oddsValue: string;
  eventName: string;
  
  // 下注相关
  betInput?: string;
  confirmBetButton?: string;
  
  // 余额
  balanceDisplay?: string;
}

export interface OddsData {
  eventName: string;
  market: string;
  selection: string;
  odds: number;
  originalOdds: string; // 原始赔率字符串
  format: OddsFormat;
  impliedProbability: number;
  timestamp: Date;
}

export interface BetResult {
  success: boolean;
  betId?: string;
  amount?: number;
  odds?: number;
  errorMessage?: string;
}

// ============ 主服务类 ============

class TraditionalBettingService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Map<string, Page> = new Map();
  private configs: Map<string, BettingSiteConfig> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private isRunning = false;
  private captchaConfig: CaptchaConfig | null = null;

  // ============ 初始化 ============

  /**
   * 初始化浏览器
   */
  async initialize(options?: {
    headless?: boolean;
    proxyServer?: string;
  }): Promise<boolean> {
    if (this.browser) {
      return true;
    }

    try {
      logger.system.info('Initializing Playwright browser...');
      
      const launchOptions: any = {
        headless: options?.headless ?? true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      };

      // 全局代理
      if (options?.proxyServer) {
        launchOptions.proxy = { server: options.proxyServer };
      }

      this.browser = await chromium.launch(launchOptions);

      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
        // 防反爬
        bypassCSP: true,
        ignoreHTTPSErrors: true,
      });

      // 注入反检测脚本
      await this.context.addInitScript(() => {
        // 隐藏 webdriver
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        // 修改 plugins
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        // 修改 languages
        Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
      });

      // 初始化数据库表
      await bettingSiteRepository.initTables();

      // 加载已保存的网站配置
      await this.loadSavedConfigs();

      this.isRunning = true;
      logger.system.info('Playwright browser initialized successfully');
      return true;
    } catch (error) {
      logger.system.error('Failed to initialize browser', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * 配置验证码服务
   */
  configureCaptcha(config: CaptchaConfig): void {
    this.captchaConfig = config;
    captchaSolver.configure(config);
    logger.system.info('Captcha solver configured', { provider: config.provider });
  }

  /**
   * 加载已保存的网站配置
   */
  private async loadSavedConfigs(): Promise<void> {
    try {
      const sites = await bettingSiteRepository.getAllSites();
      
      for (const site of sites) {
        const selectors = JSON.parse(site.customSelectors || '{}');
        const template = SITE_TEMPLATES[site.template] || SITE_TEMPLATES.sportsbook;
        
        this.configs.set(site.name, {
          name: site.name,
          url: site.url,
          username: site.username,
          password: site.password,
          proxyServer: site.proxyServer || undefined,
          selectors: { ...template, ...selectors } as BettingSiteSelectors,
          twoFactor: site.twoFactorType ? {
            type: site.twoFactorType as any,
            secret: site.twoFactorSecret || undefined,
          } : undefined,
        });
      }

      logger.system.info('Loaded saved site configs', { count: sites.length });
    } catch (error) {
      logger.system.error('Failed to load saved configs', { error: (error as Error).message });
    }
  }

  // ============ 网站管理 ============

  /**
   * 添加博彩网站配置
   */
  async addSite(config: BettingSiteConfig, persist: boolean = true): Promise<void> {
    this.configs.set(config.name, config);
    
    // 配置二次验证
    if (config.twoFactor) {
      twoFactorAuth.configureSite(config.name, config.twoFactor);
    }

    // 持久化到数据库
    if (persist) {
      await bettingSiteRepository.saveSite({
        name: config.name,
        url: config.url,
        username: config.username,
        password: config.password,
        template: 'custom',
        customSelectors: JSON.stringify(config.selectors),
        twoFactorType: config.twoFactor?.type || null,
        twoFactorSecret: config.twoFactor?.secret || null,
        proxyServer: config.proxyServer || null,
        isActive: true,
        lastLoginAt: null,
      });
    }

    logger.system.info('Betting site added', { name: config.name, url: config.url });
  }

  // ============ 登录 ============

  /**
   * 登录博彩网站（完整流程）
   */
  async login(siteName: string): Promise<boolean> {
    const config = this.configs.get(siteName);
    if (!config) {
      logger.system.error('Site not configured', { siteName });
      return false;
    }

    if (!this.context) {
      await this.initialize();
    }

    try {
      logger.system.info('Logging into betting site', { siteName });

      // 创建新页面（可带代理）
      const page = await this.createPage(config.proxyServer);
      
      // 导航到登录页面
      await page.goto(config.url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.randomDelay(1000, 2000);

      // 如果有登录按钮，先点击
      if (config.selectors.loginButton) {
        await page.click(config.selectors.loginButton).catch(() => {});
        await this.randomDelay(500, 1000);
      }

      // 处理验证码（如果有）
      const captchaType = await captchaSolver.detectCaptchaType(page);
      if (captchaType) {
        logger.system.info('Captcha detected before login', { type: captchaType, siteName });
        const captchaResult = await this.handleCaptcha(page, captchaType, config);
        if (!captchaResult) {
          logger.system.error('Failed to solve pre-login captcha', { siteName });
          await page.screenshot({ path: `./data/captcha-failed-${siteName}.png` });
          await page.close();
          return false;
        }
      }

      // 输入用户名
      await page.fill(config.selectors.usernameInput, config.username);
      await this.randomDelay(300, 600);

      // 输入密码
      await page.fill(config.selectors.passwordInput, config.password);
      await this.randomDelay(300, 600);

      // 再次检测验证码（登录表单中的验证码）
      if (config.selectors.captchaImage || config.selectors.captchaInput) {
        const captchaHandled = await this.handleFormCaptcha(page, config);
        if (!captchaHandled) {
          logger.system.warn('Form captcha handling failed', { siteName });
        }
      }

      // 点击登录按钮
      await page.click(config.selectors.submitButton);
      await this.randomDelay(2000, 3000);

      // 处理登录后的验证码
      const postLoginCaptcha = await captchaSolver.detectCaptchaType(page);
      if (postLoginCaptcha) {
        logger.system.info('Post-login captcha detected', { type: postLoginCaptcha, siteName });
        await this.handleCaptcha(page, postLoginCaptcha, config);
        await this.randomDelay(1000, 2000);
      }

      // 检测并处理二次验证
      const needs2FA = await twoFactorAuth.detect2FARequired(page);
      if (needs2FA) {
        logger.system.info('2FA required', { siteName });
        const twoFactorResult = await twoFactorAuth.handle2FA(siteName, page, {
          codeInput: config.selectors.twoFactorInput || 'input[name*="code"]',
          submitButton: config.selectors.twoFactorSubmit || 'button[type="submit"]',
          successIndicator: config.selectors.loginSuccessIndicator,
        });

        if (!twoFactorResult.success) {
          logger.system.error('2FA verification failed', { siteName, error: twoFactorResult.error });
          await page.screenshot({ path: `./data/2fa-failed-${siteName}.png` });
          await page.close();
          return false;
        }
      }

      // 检查是否登录成功
      try {
        await page.waitForSelector(config.selectors.loginSuccessIndicator, { timeout: 15000 });
        this.pages.set(siteName, page);
        this.reconnectAttempts.set(siteName, 0);
        
        // 更新最后登录时间
        await bettingSiteRepository.updateLastLogin(siteName);
        
        logger.system.info('Login successful', { siteName });
        return true;
      } catch {
        logger.system.error('Login failed - success indicator not found', { siteName });
        await page.screenshot({ path: `./data/login-failed-${siteName}.png` });
        await page.close();
        return false;
      }
    } catch (error) {
      logger.system.error('Login error', { siteName, error: (error as Error).message });
      return false;
    }
  }

  /**
   * 处理验证码
   */
  private async handleCaptcha(page: Page, type: string, config: BettingSiteConfig): Promise<boolean> {
    try {
      switch (type) {
        case 'image':
          return await this.handleImageCaptcha(page, config);
        case 'slider':
        case 'geetest':
          return await this.handleSliderCaptcha(page, config);
        case 'recaptcha':
          return await this.handleRecaptcha(page);
        case 'hcaptcha':
          logger.system.warn('hCaptcha not fully supported');
          return false;
        default:
          logger.system.warn('Unknown captcha type', { type });
          return false;
      }
    } catch (error) {
      logger.system.error('Captcha handling error', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * 处理图片验证码
   */
  private async handleImageCaptcha(page: Page, config: BettingSiteConfig): Promise<boolean> {
    const imageSelector = config.selectors.captchaImage || 'img[src*="captcha"]';
    const inputSelector = config.selectors.captchaInput || 'input[name*="captcha"]';

    const imageElement = await page.$(imageSelector);
    if (!imageElement) return true; // 没有验证码

    // 获取验证码图片
    const imageBuffer = await imageElement.screenshot();
    const imageBase64 = imageBuffer.toString('base64');

    // 解决验证码
    const result = await captchaSolver.solveImageCaptcha(imageBase64);
    if (!result.success || !result.text) {
      return false;
    }

    // 输入验证码
    await page.fill(inputSelector, result.text);
    return true;
  }

  /**
   * 处理滑块验证码
   */
  private async handleSliderCaptcha(page: Page, config: BettingSiteConfig): Promise<boolean> {
    const result = await captchaSolver.solveSliderCaptcha(page, {
      sliderSelector: config.selectors.sliderButton,
      trackSelector: config.selectors.sliderTrack,
    });
    return result.success;
  }

  /**
   * 处理 reCAPTCHA
   */
  private async handleRecaptcha(page: Page): Promise<boolean> {
    const result = await captchaSolver.solveRecaptcha(page);
    if (!result.success || !result.token) {
      return false;
    }
    return await captchaSolver.injectRecaptchaToken(page, result.token);
  }

  /**
   * 处理表单内的验证码
   */
  private async handleFormCaptcha(page: Page, config: BettingSiteConfig): Promise<boolean> {
    if (!config.selectors.captchaImage) return true;
    return await this.handleImageCaptcha(page, config);
  }

  // ============ 赔率监控 ============

  /**
   * 获取当前赔率
   */
  async getOdds(siteName: string): Promise<OddsData[]> {
    const page = this.pages.get(siteName);
    const config = this.configs.get(siteName);

    if (!page || !config) {
      logger.system.error('Site not logged in', { siteName });
      return [];
    }

    try {
      const odds: OddsData[] = [];

      // 获取所有赔率项
      const oddsItems = await page.$$(config.selectors.oddsItem);

      for (const item of oddsItems) {
        try {
          const eventName = await item.$eval(
            config.selectors.eventName, 
            el => el.textContent?.trim() || ''
          ).catch(() => '');

          const oddsText = await item.$eval(
            config.selectors.oddsValue,
            el => el.textContent?.trim() || ''
          ).catch(() => '');

          if (eventName && oddsText) {
            // 使用赔率解析器
            const parsed = oddsParser.parse(oddsText);

            odds.push({
              eventName,
              market: siteName,
              selection: '',
              odds: parsed.decimal,
              originalOdds: oddsText,
              format: parsed.format,
              impliedProbability: parsed.impliedProbability,
              timestamp: new Date(),
            });
          }
        } catch {
          // Skip invalid items
        }
      }

      // 保存到历史记录
      if (odds.length > 0) {
        await bettingSiteRepository.saveOdds(
          odds.map(o => ({
            siteName,
            eventName: o.eventName,
            market: o.market,
            selection: o.selection,
            odds: o.odds,
          }))
        );
      }

      logger.system.info('Odds fetched', { siteName, count: odds.length });
      return odds;
    } catch (error) {
      // 检查是否需要重连
      await this.checkAndReconnect(siteName, error as Error);
      return [];
    }
  }

  /**
   * 开始监控赔率
   */
  startMonitoring(siteName: string, intervalMs: number = 5000): void {
    if (this.monitoringIntervals.has(siteName)) {
      logger.system.warn('Already monitoring', { siteName });
      return;
    }

    const interval = setInterval(async () => {
      try {
        const odds = await this.getOdds(siteName);
        
        // 广播赔率更新
        wsService.broadcastMarketUpdate({
          source: siteName,
          type: 'traditional',
          odds,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.system.error('Monitoring error', { siteName, error: (error as Error).message });
      }
    }, intervalMs);

    this.monitoringIntervals.set(siteName, interval);
    logger.system.info('Started odds monitoring', { siteName, intervalMs });
  }

  /**
   * 停止监控赔率
   */
  stopMonitoring(siteName: string): void {
    const interval = this.monitoringIntervals.get(siteName);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(siteName);
      logger.system.info('Stopped odds monitoring', { siteName });
    }
  }

  // ============ 断线重连 ============

  /**
   * 检查并尝试重连
   */
  private async checkAndReconnect(siteName: string, error: Error): Promise<void> {
    const maxRetries = 3;
    const attempts = this.reconnectAttempts.get(siteName) || 0;

    if (attempts >= maxRetries) {
      logger.system.error('Max reconnect attempts reached', { siteName, attempts });
      this.stopMonitoring(siteName);
      await this.closeSite(siteName);
      return;
    }

    // 检查是否是需要重连的错误
    const needsReconnect = 
      error.message.includes('Target closed') ||
      error.message.includes('Protocol error') ||
      error.message.includes('Session closed') ||
      error.message.includes('Execution context was destroyed');

    if (needsReconnect) {
      logger.system.warn('Attempting reconnect', { siteName, attempt: attempts + 1 });
      this.reconnectAttempts.set(siteName, attempts + 1);

      // 关闭旧页面
      const oldPage = this.pages.get(siteName);
      if (oldPage) {
        await oldPage.close().catch(() => {});
        this.pages.delete(siteName);
      }

      // 等待后重新登录
      await this.sleep(5000);
      const success = await this.login(siteName);
      
      if (success) {
        logger.system.info('Reconnect successful', { siteName });
        this.reconnectAttempts.set(siteName, 0);
      }
    }
  }

  // ============ 下注 ============

  /**
   * 执行下注
   */
  async placeBet(siteName: string, options: {
    selection: string;
    amount: number;
    odds: number;
  }): Promise<BetResult> {
    const page = this.pages.get(siteName);
    const config = this.configs.get(siteName);

    if (!page || !config) {
      return { success: false, errorMessage: 'Site not logged in' };
    }

    if (!config.selectors.betInput || !config.selectors.confirmBetButton) {
      return { success: false, errorMessage: 'Bet selectors not configured' };
    }

    try {
      logger.trade.info('Placing bet', { siteName, ...options });

      // 点击赔率/选项
      await page.click(`text=${options.selection}`);
      await this.randomDelay(500, 1000);

      // 输入下注金额
      await page.fill(config.selectors.betInput, String(options.amount));
      await this.randomDelay(300, 500);

      // 验证赔率是否变化
      const currentOddsText = await page.$eval(
        config.selectors.oddsValue,
        el => el.textContent?.trim() || ''
      ).catch(() => '');
      
      const currentOdds = oddsParser.parse(currentOddsText);
      if (Math.abs(currentOdds.decimal - options.odds) > 0.02) {
        logger.trade.warn('Odds changed significantly', { 
          expected: options.odds, 
          current: currentOdds.decimal 
        });
        return { 
          success: false, 
          errorMessage: `Odds changed from ${options.odds} to ${currentOdds.decimal}` 
        };
      }

      // 确认下注
      await page.click(config.selectors.confirmBetButton);
      await this.randomDelay(1500, 2500);

      // 截图保存
      const screenshotPath = `./data/bet-${siteName}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });

      logger.trade.info('Bet placed successfully', { siteName, ...options });

      return {
        success: true,
        betId: `${siteName}-${Date.now()}`,
        amount: options.amount,
        odds: options.odds,
      };
    } catch (error) {
      logger.trade.error('Bet failed', { siteName, error: (error as Error).message });
      return { success: false, errorMessage: (error as Error).message };
    }
  }

  /**
   * 获取账户余额
   */
  async getBalance(siteName: string): Promise<number | null> {
    const page = this.pages.get(siteName);
    const config = this.configs.get(siteName);

    if (!page || !config || !config.selectors.balanceDisplay) {
      return null;
    }

    try {
      const balanceText = await page.$eval(
        config.selectors.balanceDisplay,
        el => el.textContent?.trim() || '0'
      );

      // 提取数字
      const balance = parseFloat(balanceText.replace(/[^0-9.]/g, ''));
      return balance;
    } catch (error) {
      await this.checkAndReconnect(siteName, error as Error);
      return null;
    }
  }

  // ============ 多账户管理 ============

  /**
   * 切换账户
   */
  async switchAccount(siteName: string, accountIndex: number): Promise<boolean> {
    const config = this.configs.get(siteName);
    if (!config || !config.accounts || !config.accounts[accountIndex]) {
      return false;
    }

    const account = config.accounts[accountIndex];
    
    // 先登出
    await this.logout(siteName);
    
    // 更新配置
    config.username = account.username;
    config.password = account.password;
    if (account.twoFactorSecret && config.twoFactor) {
      config.twoFactor.secret = account.twoFactorSecret;
    }

    // 重新登录
    return await this.login(siteName);
  }

  /**
   * 登出
   */
  async logout(siteName: string): Promise<void> {
    const page = this.pages.get(siteName);
    if (page) {
      // 尝试点击登出按钮
      await page.click('text=登出, text=退出, text=Logout').catch(() => {});
      await this.sleep(1000);
      await page.close();
      this.pages.delete(siteName);
    }
  }

  // ============ 工具方法 ============

  /**
   * 创建页面（可带代理）
   */
  private async createPage(proxyServer?: string): Promise<Page> {
    if (proxyServer && this.browser) {
      // 为单个网站创建带代理的上下文
      const context = await this.browser.newContext({
        proxy: { server: proxyServer },
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });
      return await context.newPage();
    }
    
    return await this.context!.newPage();
  }

  /**
   * 随机延时（模拟人类行为）
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = min + Math.random() * (max - min);
    await this.sleep(delay);
  }

  /**
   * 截取页面截图
   */
  async takeScreenshot(siteName: string, filename?: string): Promise<string | null> {
    const page = this.pages.get(siteName);
    if (!page) {
      return null;
    }

    const path = filename || `./data/screenshot-${siteName}-${Date.now()}.png`;
    await page.screenshot({ path, fullPage: true });
    return path;
  }

  /**
   * 刷新页面
   */
  async refresh(siteName: string): Promise<void> {
    const page = this.pages.get(siteName);
    if (page) {
      await page.reload({ waitUntil: 'networkidle' });
    }
  }

  /**
   * 关闭网站
   */
  async closeSite(siteName: string): Promise<void> {
    this.stopMonitoring(siteName);
    const page = this.pages.get(siteName);
    if (page) {
      await page.close();
      this.pages.delete(siteName);
    }
    this.reconnectAttempts.delete(siteName);
  }

  /**
   * 关闭所有
   */
  async shutdown(): Promise<void> {
    logger.system.info('Shutting down betting service...');

    // 停止所有监控
    for (const siteName of this.monitoringIntervals.keys()) {
      this.stopMonitoring(siteName);
    }

    // 关闭所有页面
    for (const page of this.pages.values()) {
      await page.close();
    }
    this.pages.clear();

    // 关闭浏览器
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.isRunning = false;
    logger.system.info('Betting service shutdown complete');
  }

  /**
   * 获取运行状态
   */
  getStatus(): {
    running: boolean;
    sites: { name: string; loggedIn: boolean; monitoring: boolean }[];
  } {
    const sites = Array.from(this.configs.keys()).map(name => ({
      name,
      loggedIn: this.pages.has(name),
      monitoring: this.monitoringIntervals.has(name),
    }));

    return {
      running: this.isRunning,
      sites,
    };
  }

  /**
   * 辅助方法：延时
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============ 预设的网站配置模板 ============

export const SITE_TEMPLATES: Record<string, Partial<BettingSiteSelectors>> = {
  // 皇冠类网站通用模板
  hga: {
    loginButton: '.login-btn, #login-btn, [data-action="login"]',
    usernameInput: 'input[name="username"], input[name="account"], #username',
    passwordInput: 'input[name="password"], input[type="password"], #password',
    submitButton: 'button[type="submit"], .submit-btn, #submit',
    loginSuccessIndicator: '.user-info, .balance, .logged-in, .member-info',
    captchaImage: '.captcha-img, img[src*="captcha"]',
    captchaInput: 'input[name="captcha"], input[name="verify_code"]',
    sliderButton: '.slide-btn, .slider-button',
    sliderTrack: '.slide-track, .slider-track',
    oddsContainer: '.odds-container, .market-list, .bet-list',
    oddsItem: '.odds-item, .market-item, .bet-option',
    oddsValue: '.odds-value, .price, .odd',
    eventName: '.event-name, .match-name, .team-name',
    balanceDisplay: '.balance, .user-balance, .money',
    betInput: '.bet-amount, input[name="amount"]',
    confirmBetButton: '.confirm-bet, .place-bet, button[type="submit"]',
  },
  
  // Bet365 模板
  bet365: {
    usernameInput: '#ssc-liu',
    passwordInput: '#ssc-lipd',
    submitButton: '#ssc-lis',
    loginSuccessIndicator: '.hm-MainHeaderMembers498_MembersWide',
    oddsContainer: '.gl-MarketGroup',
    oddsItem: '.gl-Participant',
    oddsValue: '.gl-ParticipantOddsOnly_Odds',
    eventName: '.rcl-ParticipantFixtureDetails_TeamNames',
    balanceDisplay: '.hm-Balance',
  },

  // 威廉希尔模板
  williamhill: {
    usernameInput: '#login-form-username',
    passwordInput: '#login-form-password',
    submitButton: '#login-form-submit',
    loginSuccessIndicator: '.balance-text',
    oddsContainer: '.btmarket',
    oddsItem: '.btmarket__selection',
    oddsValue: '.btmarket__odds',
    eventName: '.btmarket__name',
    balanceDisplay: '.balance-text',
  },

  // 通用体育博彩模板
  sportsbook: {
    usernameInput: 'input[type="text"][name*="user"], input[type="email"], input[name*="account"]',
    passwordInput: 'input[type="password"]',
    submitButton: 'button[type="submit"], input[type="submit"], .login-btn',
    loginSuccessIndicator: '.dashboard, .account, [class*="logged"], .user-info, .member',
    captchaImage: 'img[src*="captcha"], img[src*="verify"], .captcha-image',
    captchaInput: 'input[name*="captcha"], input[name*="verify"], input[name*="code"]',
    oddsContainer: '.events, .matches, .markets',
    oddsItem: '.event, .match, .game, .market-item',
    oddsValue: '.odd, .price, .decimal, .odds-value',
    eventName: '.name, .title, .team, .event-name',
    balanceDisplay: '.balance, .money, .credit',
    betInput: 'input[name*="stake"], input[name*="amount"], .stake-input',
    confirmBetButton: '.place-bet, .confirm, .submit-bet',
  },
};

// Export singleton
export const traditionalBettingService = new TraditionalBettingService();
export default traditionalBettingService;
