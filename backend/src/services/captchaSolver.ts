/**
 * 验证码处理模块
 * 支持多种验证码类型的自动识别和解决
 * 
 * 支持的验证码类型：
 * - 图片验证码 (2captcha)
 * - 滑块验证码 (geetest, 极验)
 * - reCAPTCHA v2/v3
 * - hCaptcha
 * - 点选验证码
 */

import { Page } from 'playwright';
import logger from '../utils/logger';

// ============ 类型定义 ============

export interface CaptchaConfig {
  provider: 'twocaptcha' | 'anticaptcha' | 'capsolver' | 'manual';
  apiKey: string;
  timeout: number; // 超时时间（毫秒）
  retries: number; // 重试次数
}

export interface ImageCaptchaResult {
  success: boolean;
  text?: string;
  taskId?: string;
  error?: string;
}

export interface SliderCaptchaResult {
  success: boolean;
  offset?: number;
  error?: string;
}

export interface RecaptchaResult {
  success: boolean;
  token?: string;
  error?: string;
}

// ============ 验证码解决服务 ============

class CaptchaSolverService {
  private config: CaptchaConfig = {
    provider: 'twocaptcha',
    apiKey: '',
    timeout: 120000, // 2分钟
    retries: 3,
  };

  /**
   * 配置验证码服务
   */
  configure(config: Partial<CaptchaConfig>): void {
    this.config = { ...this.config, ...config };
    logger.system.info('Captcha solver configured', { 
      provider: this.config.provider,
      hasApiKey: !!this.config.apiKey 
    });
  }

  /**
   * 检测页面上的验证码类型
   */
  async detectCaptchaType(page: Page): Promise<string | null> {
    try {
      // 检测 reCAPTCHA
      const hasRecaptcha = await page.$('iframe[src*="recaptcha"]');
      if (hasRecaptcha) return 'recaptcha';

      // 检测 hCaptcha
      const hasHcaptcha = await page.$('iframe[src*="hcaptcha"]');
      if (hasHcaptcha) return 'hcaptcha';

      // 检测极验滑块
      const hasGeetest = await page.$('.geetest_holder, .geetest_widget');
      if (hasGeetest) return 'geetest';

      // 检测通用滑块
      const hasSlider = await page.$('.slider-captcha, .slide-verify, [class*="slider"]');
      if (hasSlider) return 'slider';

      // 检测图片验证码
      const hasImageCaptcha = await page.$('img[src*="captcha"], img[src*="verify"], .captcha-image');
      if (hasImageCaptcha) return 'image';

      // 检测点选验证码
      const hasClickCaptcha = await page.$('.click-captcha, .point-captcha');
      if (hasClickCaptcha) return 'click';

      return null;
    } catch (error) {
      logger.system.error('Failed to detect captcha type', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * 解决图片验证码
   */
  async solveImageCaptcha(imageBase64: string): Promise<ImageCaptchaResult> {
    if (!this.config.apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    try {
      logger.system.info('Solving image captcha...');

      switch (this.config.provider) {
        case 'twocaptcha':
          return await this.solve2CaptchaImage(imageBase64);
        case 'anticaptcha':
          return await this.solveAntiCaptchaImage(imageBase64);
        case 'capsolver':
          return await this.solveCapsolverImage(imageBase64);
        case 'manual':
          return await this.promptManualInput('请输入验证码：');
        default:
          return { success: false, error: 'Unknown provider' };
      }
    } catch (error) {
      logger.system.error('Image captcha solving failed', { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 2Captcha 图片验证码
   */
  private async solve2CaptchaImage(imageBase64: string): Promise<ImageCaptchaResult> {
    const apiKey = this.config.apiKey;
    
    // 步骤1: 提交验证码
    const submitResponse = await fetch('http://2captcha.com/in.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: apiKey,
        method: 'base64',
        body: imageBase64,
        json: '1',
      }),
    });

    const submitResult = await submitResponse.json();
    if (submitResult.status !== 1) {
      return { success: false, error: submitResult.request };
    }

    const taskId = submitResult.request;
    logger.system.info('2Captcha task created', { taskId });

    // 步骤2: 轮询结果
    const startTime = Date.now();
    while (Date.now() - startTime < this.config.timeout) {
      await this.sleep(5000); // 等待5秒

      const resultResponse = await fetch(
        `http://2captcha.com/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`
      );
      const result = await resultResponse.json();

      if (result.status === 1) {
        logger.system.info('Image captcha solved', { text: result.request });
        return { success: true, text: result.request, taskId };
      }

      if (result.request !== 'CAPCHA_NOT_READY') {
        return { success: false, error: result.request, taskId };
      }
    }

    return { success: false, error: 'Timeout', taskId };
  }

  /**
   * Anti-Captcha 图片验证码
   */
  private async solveAntiCaptchaImage(imageBase64: string): Promise<ImageCaptchaResult> {
    const apiKey = this.config.apiKey;

    // 创建任务
    const createResponse = await fetch('https://api.anti-captcha.com/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: apiKey,
        task: {
          type: 'ImageToTextTask',
          body: imageBase64,
        },
      }),
    });

    const createResult = await createResponse.json();
    if (createResult.errorId !== 0) {
      return { success: false, error: createResult.errorDescription };
    }

    const taskId = createResult.taskId;

    // 轮询结果
    const startTime = Date.now();
    while (Date.now() - startTime < this.config.timeout) {
      await this.sleep(3000);

      const resultResponse = await fetch('https://api.anti-captcha.com/getTaskResult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: apiKey,
          taskId,
        }),
      });

      const result = await resultResponse.json();

      if (result.status === 'ready') {
        return { success: true, text: result.solution.text, taskId: String(taskId) };
      }

      if (result.errorId !== 0) {
        return { success: false, error: result.errorDescription, taskId: String(taskId) };
      }
    }

    return { success: false, error: 'Timeout', taskId: String(taskId) };
  }

  /**
   * Capsolver 图片验证码
   */
  private async solveCapsolverImage(imageBase64: string): Promise<ImageCaptchaResult> {
    const apiKey = this.config.apiKey;

    const response = await fetch('https://api.capsolver.com/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: apiKey,
        task: {
          type: 'ImageToTextTask',
          body: imageBase64,
        },
      }),
    });

    const result = await response.json();
    if (result.errorId !== 0) {
      return { success: false, error: result.errorDescription };
    }

    return { success: true, text: result.solution?.text, taskId: result.taskId };
  }

  /**
   * 解决滑块验证码
   */
  async solveSliderCaptcha(page: Page, options?: {
    sliderSelector?: string;
    trackSelector?: string;
    bgImageSelector?: string;
    pieceImageSelector?: string;
  }): Promise<SliderCaptchaResult> {
    try {
      logger.system.info('Solving slider captcha...');

      const sliderSelector = options?.sliderSelector || '.slide-btn, .slider-button, [class*="slider"]';
      const trackSelector = options?.trackSelector || '.slide-track, .slider-track';

      // 获取滑块元素
      const slider = await page.$(sliderSelector);
      const track = await page.$(trackSelector);

      if (!slider || !track) {
        return { success: false, error: 'Slider elements not found' };
      }

      // 获取轨道宽度
      const trackBox = await track.boundingBox();
      if (!trackBox) {
        return { success: false, error: 'Cannot get track dimensions' };
      }

      // 尝试使用 2captcha 的滑块识别
      if (this.config.apiKey && this.config.provider !== 'manual') {
        // 获取背景图和滑块图
        const bgImage = await this.getElementScreenshot(page, options?.bgImageSelector || '.captcha-bg');
        const pieceImage = await this.getElementScreenshot(page, options?.pieceImageSelector || '.captcha-piece');

        if (bgImage && pieceImage) {
          const offset = await this.getSliderOffset(bgImage, pieceImage);
          if (offset > 0) {
            await this.slideWithHumanBehavior(page, slider, offset);
            return { success: true, offset };
          }
        }
      }

      // 降级：尝试多个常见偏移量
      const commonOffsets = [200, 180, 220, 160, 240];
      for (const offset of commonOffsets) {
        await this.slideWithHumanBehavior(page, slider, offset);
        await this.sleep(1000);

        // 检查是否成功
        const isGone = await page.$(sliderSelector) === null;
        if (isGone) {
          logger.system.info('Slider captcha solved', { offset });
          return { success: true, offset };
        }
      }

      return { success: false, error: 'All offsets failed' };
    } catch (error) {
      logger.system.error('Slider captcha solving failed', { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 模拟人类滑动行为
   */
  private async slideWithHumanBehavior(page: Page, slider: any, distance: number): Promise<void> {
    const box = await slider.boundingBox();
    if (!box) return;

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    // 移动到滑块位置
    await page.mouse.move(startX, startY);
    await this.sleep(100 + Math.random() * 200);

    // 按下鼠标
    await page.mouse.down();
    await this.sleep(50 + Math.random() * 100);

    // 模拟人类滑动轨迹（先快后慢）
    const steps = 30 + Math.floor(Math.random() * 20);
    let currentX = startX;

    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      // 使用缓动函数：开始快，结束慢
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const targetX = startX + distance * easeProgress;
      
      // 添加随机抖动
      const jitter = (Math.random() - 0.5) * 2;
      const jitterY = (Math.random() - 0.5) * 3;

      currentX = targetX + jitter;
      await page.mouse.move(currentX, startY + jitterY);
      await this.sleep(10 + Math.random() * 20);
    }

    // 松开鼠标
    await this.sleep(50 + Math.random() * 100);
    await page.mouse.up();
  }

  /**
   * 解决 reCAPTCHA
   */
  async solveRecaptcha(page: Page, siteKey?: string): Promise<RecaptchaResult> {
    try {
      logger.system.info('Solving reCAPTCHA...');

      // 自动检测 siteKey
      if (!siteKey) {
        siteKey = await page.evaluate(() => {
          const iframe = document.querySelector('iframe[src*="recaptcha"]');
          if (iframe) {
            const src = iframe.getAttribute('src') || '';
            const match = src.match(/k=([^&]+)/);
            return match ? match[1] : null;
          }
          // 或者从 div 中获取
          const div = document.querySelector('.g-recaptcha');
          return div?.getAttribute('data-sitekey') || null;
        });
      }

      if (!siteKey) {
        return { success: false, error: 'Cannot find reCAPTCHA siteKey' };
      }

      const pageUrl = page.url();

      if (this.config.provider === 'twocaptcha') {
        return await this.solve2CaptchaRecaptcha(siteKey, pageUrl);
      } else if (this.config.provider === 'anticaptcha') {
        return await this.solveAntiCaptchaRecaptcha(siteKey, pageUrl);
      }

      return { success: false, error: 'Provider not supported for reCAPTCHA' };
    } catch (error) {
      logger.system.error('reCAPTCHA solving failed', { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 2Captcha reCAPTCHA
   */
  private async solve2CaptchaRecaptcha(siteKey: string, pageUrl: string): Promise<RecaptchaResult> {
    const apiKey = this.config.apiKey;

    // 提交任务
    const submitResponse = await fetch(
      `http://2captcha.com/in.php?key=${apiKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`
    );
    const submitResult = await submitResponse.json();

    if (submitResult.status !== 1) {
      return { success: false, error: submitResult.request };
    }

    const taskId = submitResult.request;

    // 轮询结果
    const startTime = Date.now();
    while (Date.now() - startTime < this.config.timeout) {
      await this.sleep(10000); // reCAPTCHA 需要更长时间

      const resultResponse = await fetch(
        `http://2captcha.com/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`
      );
      const result = await resultResponse.json();

      if (result.status === 1) {
        return { success: true, token: result.request };
      }

      if (result.request !== 'CAPCHA_NOT_READY') {
        return { success: false, error: result.request };
      }
    }

    return { success: false, error: 'Timeout' };
  }

  /**
   * Anti-Captcha reCAPTCHA
   */
  private async solveAntiCaptchaRecaptcha(siteKey: string, pageUrl: string): Promise<RecaptchaResult> {
    const apiKey = this.config.apiKey;

    const createResponse = await fetch('https://api.anti-captcha.com/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: apiKey,
        task: {
          type: 'RecaptchaV2TaskProxyless',
          websiteURL: pageUrl,
          websiteKey: siteKey,
        },
      }),
    });

    const createResult = await createResponse.json();
    if (createResult.errorId !== 0) {
      return { success: false, error: createResult.errorDescription };
    }

    const taskId = createResult.taskId;

    // 轮询结果
    const startTime = Date.now();
    while (Date.now() - startTime < this.config.timeout) {
      await this.sleep(5000);

      const resultResponse = await fetch('https://api.anti-captcha.com/getTaskResult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: apiKey,
          taskId,
        }),
      });

      const result = await resultResponse.json();

      if (result.status === 'ready') {
        return { success: true, token: result.solution.gRecaptchaResponse };
      }

      if (result.errorId !== 0) {
        return { success: false, error: result.errorDescription };
      }
    }

    return { success: false, error: 'Timeout' };
  }

  /**
   * 将 reCAPTCHA token 注入页面
   */
  async injectRecaptchaToken(page: Page, token: string): Promise<boolean> {
    try {
      await page.evaluate((t) => {
        // 设置 textarea
        const textarea = document.querySelector('#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
        if (textarea) {
          (textarea as HTMLTextAreaElement).value = t;
          (textarea as HTMLTextAreaElement).style.display = 'block';
        }

        // 调用回调
        const callback = (window as any).___grecaptcha_cfg?.clients?.[0]?.o?.callback;
        if (typeof callback === 'function') {
          callback(t);
        }
      }, token);

      logger.system.info('reCAPTCHA token injected');
      return true;
    } catch (error) {
      logger.system.error('Failed to inject reCAPTCHA token', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * 解决极验验证码 (Geetest)
   */
  async solveGeetest(page: Page, options?: {
    gt?: string;
    challenge?: string;
  }): Promise<{ success: boolean; validate?: string; seccode?: string; error?: string }> {
    try {
      logger.system.info('Solving Geetest captcha...');

      // 获取极验参数
      const params = await page.evaluate(() => {
        const holder = document.querySelector('.geetest_holder');
        return {
          gt: holder?.getAttribute('data-gt') || (window as any).gt,
          challenge: holder?.getAttribute('data-challenge') || (window as any).challenge,
        };
      });

      const gt = options?.gt || params.gt;
      const challenge = options?.challenge || params.challenge;

      if (!gt || !challenge) {
        return { success: false, error: 'Cannot find Geetest parameters' };
      }

      if (this.config.provider === 'twocaptcha') {
        return await this.solve2CaptchaGeetest(gt, challenge, page.url());
      }

      return { success: false, error: 'Provider not supported for Geetest' };
    } catch (error) {
      logger.system.error('Geetest solving failed', { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 2Captcha 极验
   */
  private async solve2CaptchaGeetest(
    gt: string, 
    challenge: string, 
    pageUrl: string
  ): Promise<{ success: boolean; validate?: string; seccode?: string; error?: string }> {
    const apiKey = this.config.apiKey;

    const submitResponse = await fetch(
      `http://2captcha.com/in.php?key=${apiKey}&method=geetest&gt=${gt}&challenge=${challenge}&pageurl=${encodeURIComponent(pageUrl)}&json=1`
    );
    const submitResult = await submitResponse.json();

    if (submitResult.status !== 1) {
      return { success: false, error: submitResult.request };
    }

    const taskId = submitResult.request;

    // 轮询结果
    const startTime = Date.now();
    while (Date.now() - startTime < this.config.timeout) {
      await this.sleep(5000);

      const resultResponse = await fetch(
        `http://2captcha.com/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`
      );
      const result = await resultResponse.json();

      if (result.status === 1) {
        const solution = JSON.parse(result.request);
        return {
          success: true,
          validate: solution.geetest_validate,
          seccode: solution.geetest_seccode,
        };
      }

      if (result.request !== 'CAPCHA_NOT_READY') {
        return { success: false, error: result.request };
      }
    }

    return { success: false, error: 'Timeout' };
  }

  /**
   * 手动输入验证码
   */
  private async promptManualInput(message: string): Promise<ImageCaptchaResult> {
    // 在服务端，我们通过 WebSocket 通知前端显示输入框
    // 这里只是返回一个等待状态
    logger.system.info('Manual captcha input required', { message });
    
    // 实际实现中，需要通过 WebSocket 与前端交互
    return { 
      success: false, 
      error: 'Manual input required - please implement WebSocket interaction' 
    };
  }

  /**
   * 获取元素截图的 base64
   */
  private async getElementScreenshot(page: Page, selector: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (!element) return null;

      const buffer = await element.screenshot();
      return buffer.toString('base64');
    } catch {
      return null;
    }
  }

  /**
   * 通过图像识别获取滑块偏移量
   */
  private async getSliderOffset(bgImage: string, pieceImage: string): Promise<number> {
    if (this.config.provider === 'twocaptcha') {
      // 使用 2captcha 的滑块识别 API
      const response = await fetch('http://2captcha.com/in.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          key: this.config.apiKey,
          method: 'base64',
          coordinatescaptcha: '1',
          body: bgImage,
          json: '1',
        }),
      });

      const result = await response.json();
      if (result.status === 1) {
        // 解析坐标
        const coords = result.request.split(':');
        if (coords.length >= 2) {
          return parseInt(coords[0], 10);
        }
      }
    }

    return 0;
  }

  /**
   * 辅助方法：延时
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取当前配置
   */
  getConfig(): CaptchaConfig {
    return { ...this.config };
  }
}

// Export singleton
export const captchaSolver = new CaptchaSolverService();
export default captchaSolver;
