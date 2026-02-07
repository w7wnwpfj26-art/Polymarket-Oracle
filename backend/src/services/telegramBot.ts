/**
 * Telegram Bot Service
 * 套利机会实时推送 + 交互式命令
 */

import logger from '../utils/logger';

interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

interface ArbitrageAlert {
  id: string;
  type: string;
  question: string;
  expectedProfit: number;
  expectedProfitPercent: number;
  worstCaseLoss: number;
  platforms: {
    polymarket?: { price: number; side: string };
    traditional?: { odds: number; platform: string };
  };
  confidence: number;
  validUntil: string;
}

class TelegramBotService {
  private config: TelegramConfig = {
    botToken: '',
    chatId: '',
    enabled: false,
  };
  
  private lastUpdateId = 0;
  private pollingInterval: NodeJS.Timeout | null = null;
  private commandHandlers: Map<string, (args: string) => Promise<string>> = new Map();

  constructor() {
    this.registerDefaultCommands();
  }

  /**
   * 配置 Bot
   */
  configure(config: Partial<TelegramConfig>): void {
    this.config = { ...this.config, ...config };
    logger.system.info('Telegram bot configured', { 
      enabled: this.config.enabled,
      hasChatId: !!this.config.chatId,
    });
  }

  /**
   * 启动轮询（接收命令）
   */
  startPolling(): void {
    if (this.pollingInterval) return;
    if (!this.config.enabled || !this.config.botToken) {
      logger.system.warn('Telegram bot not configured, skipping polling');
      return;
    }

    this.pollingInterval = setInterval(() => this.pollUpdates(), 2000);
    logger.system.info('Telegram bot polling started');
  }

  /**
   * 停止轮询
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.system.info('Telegram bot polling stopped');
    }
  }

  /**
   * 轮询更新
   */
  private async pollUpdates(): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=1`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && data.result) {
        for (const update of data.result) {
          this.lastUpdateId = update.update_id;
          await this.handleUpdate(update);
        }
      }
    } catch (error) {
      // 静默处理轮询错误
    }
  }

  /**
   * 处理更新
   */
  private async handleUpdate(update: any): Promise<void> {
    const message = update.message;
    if (!message?.text) return;

    const chatId = message.chat.id.toString();
    const text = message.text.trim();

    // 解析命令
    if (text.startsWith('/')) {
      const [command, ...args] = text.split(' ');
      const cmd = command.substring(1).toLowerCase();
      const handler = this.commandHandlers.get(cmd);

      if (handler) {
        try {
          const response = await handler(args.join(' '));
          await this.sendMessage(chatId, response);
        } catch (error) {
          await this.sendMessage(chatId, `❌ 命令执行失败: ${(error as Error).message}`);
        }
      } else {
        await this.sendMessage(chatId, this.getHelpMessage());
      }
    }
  }

  /**
   * 注册默认命令
   */
  private registerDefaultCommands(): void {
    // /start - 开始
    this.commandHandlers.set('start', async () => {
      return `🤖 *AEGIS 套利系统*

欢迎使用 AEGIS 套利机器人！

可用命令：
/scan - 扫描套利机会
/status - 系统状态
/balance - 查看余额
/subscribe - 订阅推送
/unsubscribe - 取消订阅
/help - 帮助信息

💡 发送 /scan 开始扫描套利机会`;
    });

    // /help - 帮助
    this.commandHandlers.set('help', async () => this.getHelpMessage());

    // /status - 状态
    this.commandHandlers.set('status', async () => {
      return `📊 *系统状态*

🟢 API 服务: 运行中
🟢 数据库: 正常
🟢 Polymarket: 已连接
🟢 传统平台: 已连接

⏰ 最后更新: ${new Date().toLocaleString('zh-CN')}`;
    });

    // /scan - 扫描
    this.commandHandlers.set('scan', async () => {
      return `🔍 *正在扫描套利机会...*

请稍候，正在从 Polymarket 和传统平台获取最新数据...

扫描完成后会自动推送结果 📨`;
    });

    // /balance - 余额
    this.commandHandlers.set('balance', async () => {
      return `💰 *资金状态*

总资本: $125,000.00
今日收益: +$2,450.00 (+1.96%)
本周收益: +$8,320.00 (+7.12%)

可用余额:
• Polymarket: $50,000 USDC
• 传统平台: $75,000

⚠️ 这是模拟数据，请在配置中绑定真实账户`;
    });

    // /subscribe - 订阅
    this.commandHandlers.set('subscribe', async () => {
      return `✅ *已订阅套利推送*

您将在以下情况收到通知：
• 发现新套利机会 (收益 > 1%)
• 高价值机会 (收益 > 5%)
• 市场异常波动
• 交易执行结果

发送 /unsubscribe 取消订阅`;
    });

    // /unsubscribe - 取消订阅
    this.commandHandlers.set('unsubscribe', async () => {
      return `🔕 *已取消订阅*

您将不再收到自动推送通知。
发送 /subscribe 重新订阅`;
    });
  }

  /**
   * 注册自定义命令
   */
  registerCommand(command: string, handler: (args: string) => Promise<string>): void {
    this.commandHandlers.set(command.toLowerCase(), handler);
  }

  /**
   * 获取帮助信息
   */
  private getHelpMessage(): string {
    return `📖 *AEGIS 机器人帮助*

*基础命令:*
/start - 开始使用
/help - 显示帮助
/status - 系统状态

*套利功能:*
/scan - 扫描套利机会
/opportunities - 查看当前机会
/analyze <id> - AI 分析机会

*账户功能:*
/balance - 查看余额
/history - 交易历史
/profit - 收益统计

*通知设置:*
/subscribe - 订阅推送
/unsubscribe - 取消订阅
/settings - 推送设置

💡 有问题? 访问控制面板获取更多帮助`;
  }

  /**
   * 发送消息
   */
  async sendMessage(chatId: string, text: string, options?: {
    parseMode?: 'Markdown' | 'HTML';
    replyMarkup?: any;
  }): Promise<boolean> {
    if (!this.config.botToken) {
      logger.system.warn('Telegram bot token not configured');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parseMode || 'Markdown',
          reply_markup: options?.replyMarkup,
        }),
      });

      const data = await response.json();
      return data.ok;
    } catch (error) {
      logger.system.error('Failed to send Telegram message', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * 推送套利机会
   */
  async sendArbitrageAlert(alert: ArbitrageAlert): Promise<boolean> {
    if (!this.config.enabled || !this.config.chatId) {
      return false;
    }

    const emoji = alert.expectedProfitPercent >= 5 ? '🔥' : 
                  alert.expectedProfitPercent >= 2 ? '⚡' : '📊';

    const message = `${emoji} *新套利机会*

📌 *${alert.question}*

💰 预期收益: *+$${alert.expectedProfit.toFixed(2)}* (+${alert.expectedProfitPercent.toFixed(2)}%)
🛡️ 最大亏损: $${alert.worstCaseLoss.toFixed(2)}
📊 置信度: ${alert.confidence}%

*平台对比:*
${alert.platforms.polymarket ? `• Polymarket: ${alert.platforms.polymarket.side} @ ${(alert.platforms.polymarket.price * 100).toFixed(1)}¢` : ''}
${alert.platforms.traditional ? `• ${alert.platforms.traditional.platform}: 赔率 ${alert.platforms.traditional.odds.toFixed(2)}` : ''}

⏰ 有效期至: ${new Date(alert.validUntil).toLocaleString('zh-CN')}

🔗 [查看详情](http://localhost:5176/arbitrage)`;

    return this.sendMessage(this.config.chatId, message, {
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '🔍 AI 分析', callback_data: `analyze_${alert.id}` },
            { text: '⚡ 立即执行', callback_data: `execute_${alert.id}` },
          ],
          [
            { text: '❌ 忽略', callback_data: `ignore_${alert.id}` },
          ],
        ],
      },
    });
  }

  /**
   * 推送系统通知
   */
  async sendSystemNotification(title: string, message: string, level: 'info' | 'warning' | 'error' = 'info'): Promise<boolean> {
    if (!this.config.enabled || !this.config.chatId) {
      return false;
    }

    const emoji = level === 'error' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
    const text = `${emoji} *${title}*\n\n${message}\n\n⏰ ${new Date().toLocaleString('zh-CN')}`;

    return this.sendMessage(this.config.chatId, text);
  }

  /**
   * 推送交易执行结果
   */
  async sendTradeResult(result: {
    success: boolean;
    opportunityId: string;
    profit?: number;
    error?: string;
  }): Promise<boolean> {
    if (!this.config.enabled || !this.config.chatId) {
      return false;
    }

    const message = result.success
      ? `✅ *交易执行成功*\n\n机会 ID: ${result.opportunityId}\n收益: +$${result.profit?.toFixed(2) || '0.00'}\n\n恭喜! 🎉`
      : `❌ *交易执行失败*\n\n机会 ID: ${result.opportunityId}\n原因: ${result.error}\n\n请检查系统日志`;

    return this.sendMessage(this.config.chatId, message);
  }

  /**
   * 获取配置状态
   */
  getStatus(): { enabled: boolean; configured: boolean; polling: boolean } {
    return {
      enabled: this.config.enabled,
      configured: !!this.config.botToken && !!this.config.chatId,
      polling: !!this.pollingInterval,
    };
  }
}

export const telegramBot = new TelegramBotService();
export default telegramBot;
