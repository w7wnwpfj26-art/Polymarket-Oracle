/**
 * AEGIS客户端数据持久化服务
 * 使用electron-store实现本地数据存储，确保升级后数据不丢失
 */

const Store = require('electron-store');
const log = require('electron-log');
const path = require('path');
const { app } = require('electron');

// 数据模型定义
const schema = {
  // 用户配置
  userConfig: {
    type: 'object',
    properties: {
      apiKeys: {
        type: 'object',
        properties: {
          polymarket: { type: 'string', default: '' },
          kalshi: { type: 'string', default: '' },
          oddsApi: { type: 'string', default: '' },
          openai: { type: 'string', default: '' },
          telegram: { type: 'string', default: '' }
        }
      },
      walletAddress: { type: 'string', default: '' },
      privateKey: { type: 'string', default: '' }, // 应加密存储
      notifications: {
        type: 'object',
        properties: {
          email: { type: 'string', default: '' },
          telegram: { type: 'string', default: '' },
          enableSound: { type: 'boolean', default: true },
          enableDesktop: { type: 'boolean', default: true }
        }
      }
    }
  },
  
  // 交易策略配置
  strategyConfig: {
    type: 'object',
    properties: {
      arbitrage: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          minProfitPercentage: { type: 'number', default: 2.0 },
          maxInvestment: { type: 'number', default: 1000 },
          autoExecute: { type: 'boolean', default: false }
        }
      },
      copyTrading: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: false },
          followAddresses: { type: 'array', default: [] },
          maxCopyAmount: { type: 'number', default: 500 }
        }
      }
    }
  },
  
  // 历史数据
  history: {
    type: 'object',
    properties: {
      trades: { type: 'array', default: [] },
      arbitrageOpportunities: { type: 'array', default: [] },
      profitHistory: { type: 'array', default: [] }
    }
  },
  
  // 应用状态
  appState: {
    type: 'object',
    properties: {
      lastLoginTime: { type: 'number', default: 0 },
      windowBounds: {
        type: 'object',
        properties: {
          width: { type: 'number', default: 1400 },
          height: { type: 'number', default: 900 },
          x: { type: 'number' },
          y: { type: 'number' }
        }
      },
      theme: { type: 'string', default: 'dark' },
      language: { type: 'string', default: 'zh-CN' }
    }
  },
  
  // 版本信息（用于数据迁移）
  version: {
    type: 'object',
    properties: {
      dataVersion: { type: 'string', default: '1.0.0' },
      lastAppVersion: { type: 'string', default: '1.0.0' }
    }
  }
};

class DataStoreService {
  constructor() {
    this.store = null;
    this.encryptionKey = null;
  }

  /**
   * 初始化数据存储
   */
  initialize(encryptionKey = null) {
    try {
      this.encryptionKey = encryptionKey;
      
      this.store = new Store({
        name: 'aegis-data',
        schema: schema,
        cwd: app.getPath('userData'),
        // 启用加密存储敏感数据
        encryptionKey: encryptionKey || undefined,
        // 数据迁移配置
        migrations: {
          '1.0.0': store => {
            // 初始版本无需迁移
            log.info('[DataStore] Initial version 1.0.0');
          },
          '1.1.0': store => {
            // 示例：添加新字段的迁移
            log.info('[DataStore] Migrating to 1.1.0');
            const config = store.get('userConfig', {});
            if (!config.notifications) {
              config.notifications = {
                email: '',
                telegram: '',
                enableSound: true,
                enableDesktop: true
              };
              store.set('userConfig', config);
            }
          }
        }
      });

      log.info('[DataStore] Initialized successfully');
      log.info(`[DataStore] Store location: ${this.store.path}`);
      
      // 记录当前应用版本
      this.updateAppVersion();
      
      return true;
    } catch (error) {
      log.error('[DataStore] Initialization failed:', error);
      return false;
    }
  }

  /**
   * 更新应用版本信息
   */
  updateAppVersion() {
    const currentVersion = app.getVersion();
    const versionInfo = this.store.get('version', {});
    
    if (versionInfo.lastAppVersion !== currentVersion) {
      log.info(`[DataStore] Version changed: ${versionInfo.lastAppVersion} -> ${currentVersion}`);
      this.store.set('version.lastAppVersion', currentVersion);
    }
  }

  // ==================== 用户配置管理 ====================

  /**
   * 获取API密钥配置
   */
  getApiKeys() {
    return this.store.get('userConfig.apiKeys', {});
  }

  /**
   * 保存API密钥
   */
  saveApiKey(platform, apiKey) {
    this.store.set(`userConfig.apiKeys.${platform}`, apiKey);
    log.info(`[DataStore] Saved API key for ${platform}`);
  }

  /**
   * 获取钱包配置
   */
  getWalletConfig() {
    return {
      address: this.store.get('userConfig.walletAddress', ''),
      privateKey: this.store.get('userConfig.privateKey', '')
    };
  }

  /**
   * 保存钱包配置（私钥应加密）
   */
  saveWalletConfig(address, privateKey) {
    this.store.set('userConfig.walletAddress', address);
    this.store.set('userConfig.privateKey', privateKey);
    log.info('[DataStore] Wallet config saved');
  }

  /**
   * 获取通知配置
   */
  getNotificationConfig() {
    return this.store.get('userConfig.notifications', {});
  }

  /**
   * 保存通知配置
   */
  saveNotificationConfig(config) {
    this.store.set('userConfig.notifications', config);
    log.info('[DataStore] Notification config saved');
  }

  // ==================== 策略配置管理 ====================

  /**
   * 获取套利策略配置
   */
  getArbitrageConfig() {
    return this.store.get('strategyConfig.arbitrage', {});
  }

  /**
   * 保存套利策略配置
   */
  saveArbitrageConfig(config) {
    this.store.set('strategyConfig.arbitrage', config);
    log.info('[DataStore] Arbitrage config saved');
  }

  /**
   * 获取复制交易配置
   */
  getCopyTradingConfig() {
    return this.store.get('strategyConfig.copyTrading', {});
  }

  /**
   * 保存复制交易配置
   */
  saveCopyTradingConfig(config) {
    this.store.set('strategyConfig.copyTrading', config);
    log.info('[DataStore] Copy trading config saved');
  }

  // ==================== 历史数据管理 ====================

  /**
   * 添加交易记录
   */
  addTradeRecord(trade) {
    const trades = this.store.get('history.trades', []);
    trades.unshift({
      ...trade,
      timestamp: Date.now()
    });
    
    // 保留最近1000条记录
    if (trades.length > 1000) {
      trades.length = 1000;
    }
    
    this.store.set('history.trades', trades);
    log.info('[DataStore] Trade record added');
  }

  /**
   * 获取交易历史
   */
  getTradeHistory(limit = 100) {
    const trades = this.store.get('history.trades', []);
    return trades.slice(0, limit);
  }

  /**
   * 添加套利机会记录
   */
  addArbitrageOpportunity(opportunity) {
    const opportunities = this.store.get('history.arbitrageOpportunities', []);
    opportunities.unshift({
      ...opportunity,
      timestamp: Date.now()
    });
    
    // 保留最近500条记录
    if (opportunities.length > 500) {
      opportunities.length = 500;
    }
    
    this.store.set('history.arbitrageOpportunities', opportunities);
  }

  /**
   * 获取套利机会历史
   */
  getArbitrageHistory(limit = 50) {
    const opportunities = this.store.get('history.arbitrageOpportunities', []);
    return opportunities.slice(0, limit);
  }

  /**
   * 记录收益数据
   */
  recordProfit(profit) {
    const profitHistory = this.store.get('history.profitHistory', []);
    profitHistory.push({
      amount: profit,
      timestamp: Date.now()
    });
    
    // 保留最近365天的数据
    const thirtyDaysAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const filtered = profitHistory.filter(p => p.timestamp > thirtyDaysAgo);
    
    this.store.set('history.profitHistory', filtered);
  }

  /**
   * 获取收益历史
   */
  getProfitHistory() {
    return this.store.get('history.profitHistory', []);
  }

  // ==================== 应用状态管理 ====================

  /**
   * 获取窗口边界
   */
  getWindowBounds() {
    return this.store.get('appState.windowBounds', {
      width: 1400,
      height: 900
    });
  }

  /**
   * 保存窗口边界
   */
  saveWindowBounds(bounds) {
    this.store.set('appState.windowBounds', bounds);
  }

  /**
   * 获取主题设置
   */
  getTheme() {
    return this.store.get('appState.theme', 'dark');
  }

  /**
   * 保存主题设置
   */
  saveTheme(theme) {
    this.store.set('appState.theme', theme);
  }

  /**
   * 获取语言设置
   */
  getLanguage() {
    return this.store.get('appState.language', 'zh-CN');
  }

  /**
   * 保存语言设置
   */
  saveLanguage(language) {
    this.store.set('appState.language', language);
  }

  /**
   * 更新最后登录时间
   */
  updateLastLoginTime() {
    this.store.set('appState.lastLoginTime', Date.now());
  }

  // ==================== 数据导出与备份 ====================

  /**
   * 导出所有数据（用于备份）
   */
  exportAllData() {
    return {
      userConfig: this.store.get('userConfig'),
      strategyConfig: this.store.get('strategyConfig'),
      history: this.store.get('history'),
      appState: this.store.get('appState'),
      version: this.store.get('version'),
      exportTime: Date.now()
    };
  }

  /**
   * 导入数据（用于恢复）
   */
  importData(data) {
    try {
      if (data.userConfig) this.store.set('userConfig', data.userConfig);
      if (data.strategyConfig) this.store.set('strategyConfig', data.strategyConfig);
      if (data.history) this.store.set('history', data.history);
      if (data.appState) this.store.set('appState', data.appState);
      
      log.info('[DataStore] Data imported successfully');
      return true;
    } catch (error) {
      log.error('[DataStore] Import failed:', error);
      return false;
    }
  }

  /**
   * 清除所有数据（慎用）
   */
  clearAllData() {
    this.store.clear();
    log.warn('[DataStore] All data cleared');
  }

  /**
   * 获取存储路径
   */
  getStorePath() {
    return this.store.path;
  }

  /**
   * 获取数据统计
   */
  getStats() {
    return {
      storePath: this.store.path,
      storeSize: this.store.size,
      tradeCount: this.store.get('history.trades', []).length,
      opportunityCount: this.store.get('history.arbitrageOpportunities', []).length,
      dataVersion: this.store.get('version.dataVersion'),
      lastAppVersion: this.store.get('version.lastAppVersion')
    };
  }
}

// 单例模式
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new DataStoreService();
    }
    return instance;
  },
  DataStoreService
};
