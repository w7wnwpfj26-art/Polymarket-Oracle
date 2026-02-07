/**
 * Notification Service - Telegram/Discord/Webhook
 */

import { getConfig } from '../api/config';
import logger from '../utils/logger';

// Notification types
export type NotificationType = 'opportunity' | 'trade' | 'error' | 'system' | 'daily_report';

export interface NotificationMessage {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  severity?: 'info' | 'warning' | 'error' | 'success';
}

class NotificationService {
  /**
   * Send notification via all configured channels
   */
  async send(notification: NotificationMessage): Promise<boolean> {
    const config = getConfig();
    const notifications = config.notifications;

    if (!notifications?.enabled) {
      return false;
    }

    const results: boolean[] = [];

    // Check if this notification type is enabled
    if (!this.isTypeEnabled(notification.type)) {
      return false;
    }

    // Send to Telegram
    if (notifications.telegram?.enabled && notifications.telegram.botToken) {
      const result = await this.sendTelegram(notification);
      results.push(result);
    }

    // Send to Discord
    if (notifications.discord?.enabled && notifications.discord.webhookUrl) {
      const result = await this.sendDiscord(notification);
      results.push(result);
    }

    // Send to custom webhook
    if (notifications.webhook?.enabled && notifications.webhook.url) {
      const result = await this.sendWebhook(notification);
      results.push(result);
    }

    return results.some(r => r);
  }

  /**
   * Check if notification type is enabled
   */
  private isTypeEnabled(type: NotificationType): boolean {
    const config = getConfig();
    const events = config.notifications?.events || {
      opportunity: true,
      trade: true,
      error: true,
      system: true,
      daily_report: false,
    };

    return events[type] ?? false;
  }

  /**
   * Send notification via Telegram
   */
  private async sendTelegram(notification: NotificationMessage): Promise<boolean> {
    const config = getConfig();
    const { botToken, chatId } = config.notifications?.telegram || {};

    if (!botToken || !chatId) {
      return false;
    }

    try {
      const emoji = this.getEmoji(notification.severity);
      const text = `${emoji} *${notification.title}*\n\n${notification.message}`;

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }

      logger.system.info('Telegram notification sent', { type: notification.type });
      return true;
    } catch (error) {
      logger.system.error('Failed to send Telegram notification', { 
        error: (error as Error).message 
      });
      return false;
    }
  }

  /**
   * Send notification via Discord webhook
   */
  private async sendDiscord(notification: NotificationMessage): Promise<boolean> {
    const config = getConfig();
    const { webhookUrl } = config.notifications?.discord || {};

    if (!webhookUrl) {
      return false;
    }

    try {
      const color = this.getDiscordColor(notification.severity);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: notification.title,
            description: notification.message,
            color,
            timestamp: new Date().toISOString(),
            footer: { text: 'AEGIS Arbitrage System' },
            fields: notification.data ? Object.entries(notification.data).map(([name, value]) => ({
              name,
              value: String(value),
              inline: true,
            })) : [],
          }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook error: ${response.status}`);
      }

      logger.system.info('Discord notification sent', { type: notification.type });
      return true;
    } catch (error) {
      logger.system.error('Failed to send Discord notification', { 
        error: (error as Error).message 
      });
      return false;
    }
  }

  /**
   * Send notification via custom webhook
   */
  private async sendWebhook(notification: NotificationMessage): Promise<boolean> {
    const config = getConfig();
    const { url, headers } = config.notifications?.webhook || {};

    if (!url) {
      return false;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          ...notification,
          timestamp: new Date().toISOString(),
          source: 'aegis-arbitrage-system',
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status}`);
      }

      logger.system.info('Webhook notification sent', { type: notification.type });
      return true;
    } catch (error) {
      logger.system.error('Failed to send webhook notification', { 
        error: (error as Error).message 
      });
      return false;
    }
  }

  /**
   * Get emoji for severity
   */
  private getEmoji(severity?: string): string {
    switch (severity) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '🚨';
      default: return 'ℹ️';
    }
  }

  /**
   * Get Discord embed color
   */
  private getDiscordColor(severity?: string): number {
    switch (severity) {
      case 'success': return 0x00FF00; // Green
      case 'warning': return 0xFFAA00; // Orange
      case 'error': return 0xFF0000; // Red
      default: return 0x00BFFF; // Cyan
    }
  }

  // ============ Convenience Methods ============

  async notifyOpportunity(opportunity: {
    type: string;
    expectedProfit: number;
    confidence: number;
    markets: any;
  }) {
    return this.send({
      type: 'opportunity',
      title: '💰 发现套利机会',
      message: `类型: ${opportunity.type}\n预期收益: $${opportunity.expectedProfit.toFixed(2)}\n置信度: ${opportunity.confidence}%`,
      data: {
        类型: opportunity.type,
        预期收益: `$${opportunity.expectedProfit.toFixed(2)}`,
        置信度: `${opportunity.confidence}%`,
      },
      severity: 'success',
    });
  }

  async notifyTrade(trade: {
    platform: string;
    marketId: string;
    side: string;
    size: number;
    price: number;
    status: string;
  }) {
    const severity = trade.status === 'FILLED' ? 'success' : 
                     trade.status === 'FAILED' ? 'error' : 'info';

    return this.send({
      type: 'trade',
      title: trade.status === 'FILLED' ? '✅ 交易成功' : 
             trade.status === 'FAILED' ? '❌ 交易失败' : '📝 交易提交',
      message: `平台: ${trade.platform}\n方向: ${trade.side}\n数量: ${trade.size}\n价格: ${trade.price}\n状态: ${trade.status}`,
      data: trade,
      severity,
    });
  }

  async notifyError(error: {
    code: string;
    message: string;
    context?: string;
  }) {
    return this.send({
      type: 'error',
      title: '🚨 系统错误',
      message: `错误码: ${error.code}\n${error.message}${error.context ? `\n上下文: ${error.context}` : ''}`,
      data: error,
      severity: 'error',
    });
  }

  async notifySystem(title: string, message: string) {
    return this.send({
      type: 'system',
      title,
      message,
      severity: 'info',
    });
  }

  async sendDailyReport(stats: {
    marketsScanned: number;
    opportunitiesFound: number;
    opportunitiesExecuted: number;
    totalProfit: number;
    totalLoss: number;
  }) {
    const netProfit = stats.totalProfit - stats.totalLoss;

    return this.send({
      type: 'daily_report',
      title: '📊 每日报告',
      message: [
        `扫描市场: ${stats.marketsScanned}`,
        `发现机会: ${stats.opportunitiesFound}`,
        `执行交易: ${stats.opportunitiesExecuted}`,
        `总收益: $${stats.totalProfit.toFixed(2)}`,
        `总亏损: $${stats.totalLoss.toFixed(2)}`,
        `净收益: $${netProfit.toFixed(2)}`,
      ].join('\n'),
      data: stats,
      severity: netProfit >= 0 ? 'success' : 'warning',
    });
  }
}

// Export singleton
export const notificationService = new NotificationService();
export default notificationService;
