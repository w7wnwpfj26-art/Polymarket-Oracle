/**
 * 二次验证处理模块
 * 支持 SMS、TOTP (Google Authenticator)、邮箱验证
 */

import { Page } from 'playwright';
import * as OTPAuth from 'otpauth';
import logger from '../utils/logger';
import wsService from './websocket';

// ============ 类型定义 ============

export interface TwoFactorConfig {
  type: 'totp' | 'sms' | 'email' | 'manual';
  secret?: string; // TOTP secret
  phoneNumber?: string;
  email?: string;
}

export interface TwoFactorResult {
  success: boolean;
  code?: string;
  error?: string;
}

// ============ 二次验证服务 ============

class TwoFactorAuthService {
  private configs: Map<string, TwoFactorConfig> = new Map();
  private pendingCodes: Map<string, string> = new Map(); // 等待用户输入的验证码

  /**
   * 配置二次验证
   */
  configureSite(siteName: string, config: TwoFactorConfig): void {
    this.configs.set(siteName, config);
    logger.system.info('2FA configured for site', { siteName, type: config.type });
  }

  /**
   * 获取 TOTP 验证码
   */
  getTOTPCode(secret: string): string {
    try {
      const totp = new OTPAuth.TOTP({
        issuer: 'BettingSite',
        label: 'Account',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret.replace(/\s/g, '')),
      });

      const code = totp.generate();
      logger.system.info('TOTP code generated', { code: '***' + code.slice(-2) });
      return code;
    } catch (error) {
      logger.system.error('TOTP generation failed', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 处理二次验证
   */
  async handle2FA(siteName: string, page: Page, selectors: {
    codeInput: string;
    submitButton: string;
    successIndicator: string;
  }): Promise<TwoFactorResult> {
    const config = this.configs.get(siteName);

    if (!config) {
      logger.system.warn('No 2FA config for site, attempting manual', { siteName });
      return await this.handleManual2FA(siteName, page, selectors);
    }

    try {
      let code: string | undefined;

      switch (config.type) {
        case 'totp':
          if (!config.secret) {
            return { success: false, error: 'TOTP secret not configured' };
          }
          code = this.getTOTPCode(config.secret);
          break;

        case 'sms':
          code = await this.waitForSMSCode(siteName);
          break;

        case 'email':
          code = await this.waitForEmailCode(siteName);
          break;

        case 'manual':
          return await this.handleManual2FA(siteName, page, selectors);
      }

      if (!code) {
        return { success: false, error: 'Failed to get verification code' };
      }

      // 输入验证码
      await page.fill(selectors.codeInput, code);
      await this.sleep(500);

      // 点击提交
      await page.click(selectors.submitButton);
      await this.sleep(2000);

      // 检查是否成功
      try {
        await page.waitForSelector(selectors.successIndicator, { timeout: 10000 });
        logger.system.info('2FA verification successful', { siteName });
        return { success: true, code };
      } catch {
        return { success: false, error: '2FA verification failed' };
      }
    } catch (error) {
      logger.system.error('2FA handling failed', { siteName, error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 检测页面是否需要二次验证
   */
  async detect2FARequired(page: Page): Promise<boolean> {
    try {
      // 常见的 2FA 页面元素
      const selectors = [
        'input[name*="code"]',
        'input[name*="otp"]',
        'input[name*="verification"]',
        'input[name*="2fa"]',
        'input[placeholder*="验证码"]',
        'input[placeholder*="短信"]',
        '.two-factor',
        '.verification-code',
        '[class*="otp"]',
      ];

      for (const selector of selectors) {
        const element = await page.$(selector);
        if (element) {
          // 确认不是普通的图片验证码
          const isVisible = await element.isVisible();
          if (isVisible) {
            logger.system.info('2FA detected on page');
            return true;
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * 等待用户输入短信验证码
   */
  private async waitForSMSCode(siteName: string, timeout: number = 120000): Promise<string | undefined> {
    logger.system.info('Waiting for SMS code...', { siteName });

    // 通知前端需要输入验证码
    wsService.broadcastSystemEvent({
      type: 'SMS_CODE_REQUIRED',
      siteName,
      message: '请输入收到的短信验证码',
    });

    // 等待验证码
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const code = this.pendingCodes.get(`sms:${siteName}`);
      if (code) {
        this.pendingCodes.delete(`sms:${siteName}`);
        return code;
      }
      await this.sleep(1000);
    }

    logger.system.error('SMS code timeout', { siteName });
    return undefined;
  }

  /**
   * 等待用户输入邮箱验证码
   */
  private async waitForEmailCode(siteName: string, timeout: number = 120000): Promise<string | undefined> {
    logger.system.info('Waiting for email code...', { siteName });

    // 通知前端需要输入验证码
    wsService.broadcastSystemEvent({
      type: 'EMAIL_CODE_REQUIRED',
      siteName,
      message: '请输入收到的邮箱验证码',
    });

    // 等待验证码
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const code = this.pendingCodes.get(`email:${siteName}`);
      if (code) {
        this.pendingCodes.delete(`email:${siteName}`);
        return code;
      }
      await this.sleep(1000);
    }

    logger.system.error('Email code timeout', { siteName });
    return undefined;
  }

  /**
   * 手动二次验证（通过 WebSocket 通知前端）
   */
  private async handleManual2FA(siteName: string, page: Page, selectors: {
    codeInput: string;
    submitButton: string;
    successIndicator: string;
  }): Promise<TwoFactorResult> {
    logger.system.info('Manual 2FA required', { siteName });

    // 截图当前页面
    const screenshot = await page.screenshot({ encoding: 'base64' });

    // 通知前端
    wsService.broadcastSystemEvent({
      type: 'MANUAL_2FA_REQUIRED',
      siteName,
      message: '请手动输入验证码',
      screenshot: `data:image/png;base64,${screenshot}`,
      selectors,
    });

    // 等待验证码
    const startTime = Date.now();
    const timeout = 300000; // 5分钟

    while (Date.now() - startTime < timeout) {
      const code = this.pendingCodes.get(`manual:${siteName}`);
      if (code) {
        this.pendingCodes.delete(`manual:${siteName}`);

        // 输入验证码
        await page.fill(selectors.codeInput, code);
        await this.sleep(500);
        await page.click(selectors.submitButton);
        await this.sleep(2000);

        // 检查是否成功
        try {
          await page.waitForSelector(selectors.successIndicator, { timeout: 10000 });
          return { success: true, code };
        } catch {
          return { success: false, error: 'Manual 2FA verification failed' };
        }
      }
      await this.sleep(1000);
    }

    return { success: false, error: 'Manual 2FA timeout' };
  }

  /**
   * 接收用户提交的验证码
   */
  submitCode(type: 'sms' | 'email' | 'manual', siteName: string, code: string): void {
    this.pendingCodes.set(`${type}:${siteName}`, code);
    logger.system.info('Verification code received', { type, siteName });
  }

  /**
   * 辅助方法：延时
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取站点配置
   */
  getSiteConfig(siteName: string): TwoFactorConfig | undefined {
    return this.configs.get(siteName);
  }

  /**
   * 移除站点配置
   */
  removeSiteConfig(siteName: string): void {
    this.configs.delete(siteName);
  }
}

// Export singleton
export const twoFactorAuth = new TwoFactorAuthService();
export default twoFactorAuth;
