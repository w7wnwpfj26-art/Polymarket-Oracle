/**
 * 国际化 Composable v2
 * 支持中文(默认)、英文、繁体中文
 * 覆盖所有视图的翻译
 */

import { ref, computed } from 'vue';

export type Language = 'zh-CN' | 'zh-TW' | 'en';

const translations: Record<Language, Record<string, string>> = {
  'zh-CN': {
    // 通用
    'common.loading': '加载中...',
    'common.scanning': '扫描中...',
    'common.analyzing': '分析中...',
    'common.confirm': '确认',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.success': '成功',
    'common.failed': '失败',
    'common.confidence': '置信度',
    'common.refresh': '刷新',
    'common.search': '搜索',
    'common.filter': '筛选',
    'common.reset': '重置',
    'common.status': '状态',
    'common.actions': '操作',
    'common.noData': '暂无数据',
    'common.online': '在线',
    'common.offline': '离线',
    'common.enabled': '已启用',
    'common.disabled': '已禁用',
    'common.connected': '已连接',
    'common.disconnected': '未连接',

    // 导航
    'nav.dashboard': '仪表盘',
    'nav.markets': '市场',
    'nav.arbitrage': '套利',
    'nav.agents': '智能体',
    'nav.config': '配置',
    'nav.history': '历史',
    'nav.betting': '传统博彩',
    'nav.copy': '跟单交易',
    'nav.sentiment': '情绪分析',

    // 仪表盘
    'dashboard.title': '系统概览',
    'dashboard.capital': '总资金',
    'dashboard.profitToday': '今日盈亏',
    'dashboard.marketsActive': '活跃市场',
    'dashboard.agentsOnline': '在线智能体',
    'dashboard.riskLevel': '风险等级',
    'dashboard.recentOpportunities': '最近机会',
    'dashboard.systemStatus': '系统状态',
    'dashboard.scanMarkets': '扫描市场',
    'dashboard.emergencyHalt': '紧急停止',
    'dashboard.mode.live': '实盘模式',
    'dashboard.mode.dryrun': '模拟模式',
    'dashboard.mode.halted': '已停止',

    // 市场
    'markets.title': '市场列表',
    'markets.search': '搜索市场...',
    'markets.volume': '24h 成交量',
    'markets.liquidity': '流动性',
    'markets.source': '数据源',
    'markets.endDate': '截止日期',

    // 套利
    'arbitrage.title': '套利机会',
    'arbitrage.scan': '扫描市场',
    'arbitrage.scanning': '扫描中...',
    'arbitrage.noOpportunities': '暂无套利机会',
    'arbitrage.noOpportunitiesHint': '点击「扫描市场」开始搜寻套利机会',
    'arbitrage.loadingOpportunities': '加载机会...',
    'arbitrage.expectedProfit': '预期收益',
    'arbitrage.profitRate': '收益率',
    'arbitrage.worstCaseLoss': '最大亏损',
    'arbitrage.analyze': '分析',
    'arbitrage.aiAnalyze': 'AI 分析',
    'arbitrage.execute': '执行',
    'arbitrage.type.dutchBook': 'Dutch Book',
    'arbitrage.type.crossPlatform': '跨平台套利',
    'arbitrage.type.hedgeArb': '对冲套利',
    'arbitrage.autoRefresh': '自动刷新',

    // 智能体
    'agents.title': '智能体管理',
    'agents.count': '共 {count} 个智能体',
    'agents.toggle': '启用/禁用',
    'agents.test': '测试',
    'agents.decisions': '今日决策',
    'agents.approvalRate': '批准率',
    'agents.lastActivity': '最后活动',

    // AI 分析
    'ai.analyzing': 'AI 正在分析...',
    'ai.semanticRisk': '语义风险',
    'ai.irreversibility': '不可逆评分',
    'ai.recommendation': '建议',
    'ai.warnings': '警告',
    'ai.execute': '执行交易',
    'ai.hold': '暂不交易',
    'ai.halt': '拒绝交易',
    'ai.agentDecisions': '代理决策',
    'ai.approve': '批准',
    'ai.reject': '拒绝',
    'ai.abstain': '弃权',

    // 配置
    'config.title': '系统配置',
    'config.ai': 'AI 配置',
    'config.risk': '风险管理',
    'config.execution': '执行策略',
    'config.dataSources': '数据源',
    'config.notifications': '通知设置',
    'config.saveSuccess': '配置已保存',
    'config.resetConfirm': '确定要重置配置吗？',

    // 历史
    'history.title': '交易历史',
    'history.executionPlan': '执行计划',
    'history.result': '结果',
    'history.profit': '盈亏',
    'history.time': '时间',

    // 传统博彩
    'betting.title': '传统博彩平台',
    'betting.sites': '已配置平台',
    'betting.addSite': '添加平台',
    'betting.odds': '赔率监控',
    'betting.automation': '自动化',

    // 跟单交易
    'copy.title': '跟单交易',
    'copy.traders': '交易员排行',
    'copy.positions': '我的跟单',
    'copy.startCopy': '开始跟单',
    'copy.stopCopy': '停止跟单',
    'copy.winRate': '胜率',
    'copy.profitPercent': '收益率',
    'copy.followers': '跟单人数',

    // 情绪分析
    'sentiment.title': '市场情绪',
    'sentiment.trending': '热门话题',
    'sentiment.bullish': '看涨',
    'sentiment.bearish': '看跌',
    'sentiment.neutral': '中性',
    'sentiment.analyze': '分析文本',
    'sentiment.liveData': '实时数据',
    'sentiment.aiEstimate': 'AI 估算',

    // 翻译
    'translate.title': '翻译原文',
    'translate.translating': '翻译中...',
    'translate.original': '原文',
    'translate.translated': '译文',
  },

  'zh-TW': {
    'common.loading': '載入中...',
    'common.scanning': '掃描中...',
    'common.analyzing': '分析中...',
    'common.confirm': '確認',
    'common.cancel': '取消',
    'common.save': '儲存',
    'common.success': '成功',
    'common.failed': '失敗',
    'common.confidence': '信心度',
    'common.refresh': '重新整理',
    'common.search': '搜尋',
    'common.filter': '篩選',
    'common.reset': '重設',
    'common.status': '狀態',
    'common.actions': '操作',
    'common.noData': '暫無資料',
    'common.online': '線上',
    'common.offline': '離線',
    'common.enabled': '已啟用',
    'common.disabled': '已停用',
    'common.connected': '已連線',
    'common.disconnected': '未連線',

    'nav.dashboard': '儀表板',
    'nav.markets': '市場',
    'nav.arbitrage': '套利',
    'nav.agents': '智慧體',
    'nav.config': '設定',
    'nav.history': '歷史',
    'nav.betting': '傳統博彩',
    'nav.copy': '跟單交易',
    'nav.sentiment': '情緒分析',

    'dashboard.title': '系統概覽',
    'dashboard.capital': '總資金',
    'dashboard.profitToday': '今日盈虧',
    'dashboard.marketsActive': '活躍市場',
    'dashboard.agentsOnline': '線上智慧體',
    'dashboard.riskLevel': '風險等級',
    'dashboard.recentOpportunities': '最近機會',
    'dashboard.systemStatus': '系統狀態',
    'dashboard.scanMarkets': '掃描市場',
    'dashboard.emergencyHalt': '緊急停止',
    'dashboard.mode.live': '實盤模式',
    'dashboard.mode.dryrun': '模擬模式',
    'dashboard.mode.halted': '已停止',

    'markets.title': '市場列表',
    'markets.search': '搜尋市場...',
    'markets.volume': '24h 成交量',
    'markets.liquidity': '流動性',
    'markets.source': '資料源',
    'markets.endDate': '截止日期',

    'arbitrage.title': '套利機會',
    'arbitrage.scan': '掃描市場',
    'arbitrage.scanning': '掃描中...',
    'arbitrage.noOpportunities': '暫無套利機會',
    'arbitrage.noOpportunitiesHint': '點擊「掃描市場」開始搜尋套利機會',
    'arbitrage.loadingOpportunities': '載入機會...',
    'arbitrage.expectedProfit': '預期收益',
    'arbitrage.profitRate': '收益率',
    'arbitrage.worstCaseLoss': '最大虧損',
    'arbitrage.analyze': '分析',
    'arbitrage.aiAnalyze': 'AI 分析',
    'arbitrage.execute': '執行',
    'arbitrage.type.dutchBook': 'Dutch Book',
    'arbitrage.type.crossPlatform': '跨平台套利',
    'arbitrage.type.hedgeArb': '對沖套利',
    'arbitrage.autoRefresh': '自動重新整理',

    'agents.title': '智慧體管理',
    'agents.count': '共 {count} 個智慧體',
    'agents.toggle': '啟用/停用',
    'agents.test': '測試',
    'agents.decisions': '今日決策',
    'agents.approvalRate': '批准率',
    'agents.lastActivity': '最後活動',

    'ai.analyzing': 'AI 正在分析...',
    'ai.semanticRisk': '語義風險',
    'ai.irreversibility': '不可逆評分',
    'ai.recommendation': '建議',
    'ai.warnings': '警告',
    'ai.execute': '執行交易',
    'ai.hold': '暫不交易',
    'ai.halt': '拒絕交易',
    'ai.agentDecisions': '代理決策',
    'ai.approve': '批准',
    'ai.reject': '拒絕',
    'ai.abstain': '棄權',

    'config.title': '系統設定',
    'config.ai': 'AI 設定',
    'config.risk': '風險管理',
    'config.execution': '執行策略',
    'config.dataSources': '資料源',
    'config.notifications': '通知設定',
    'config.saveSuccess': '設定已儲存',
    'config.resetConfirm': '確定要重設設定嗎？',

    'history.title': '交易歷史',
    'history.executionPlan': '執行計劃',
    'history.result': '結果',
    'history.profit': '盈虧',
    'history.time': '時間',

    'betting.title': '傳統博彩平台',
    'betting.sites': '已設定平台',
    'betting.addSite': '新增平台',
    'betting.odds': '賠率監控',
    'betting.automation': '自動化',

    'copy.title': '跟單交易',
    'copy.traders': '交易員排行',
    'copy.positions': '我的跟單',
    'copy.startCopy': '開始跟單',
    'copy.stopCopy': '停止跟單',
    'copy.winRate': '勝率',
    'copy.profitPercent': '收益率',
    'copy.followers': '跟單人數',

    'sentiment.title': '市場情緒',
    'sentiment.trending': '熱門話題',
    'sentiment.bullish': '看漲',
    'sentiment.bearish': '看跌',
    'sentiment.neutral': '中性',
    'sentiment.analyze': '分析文本',
    'sentiment.liveData': '即時資料',
    'sentiment.aiEstimate': 'AI 估算',

    'translate.title': '翻譯原文',
    'translate.translating': '翻譯中...',
    'translate.original': '原文',
    'translate.translated': '譯文',
  },

  'en': {
    'common.loading': 'Loading...',
    'common.scanning': 'Scanning...',
    'common.analyzing': 'Analyzing...',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.success': 'Success',
    'common.failed': 'Failed',
    'common.confidence': 'Confidence',
    'common.refresh': 'Refresh',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.reset': 'Reset',
    'common.status': 'Status',
    'common.actions': 'Actions',
    'common.noData': 'No data',
    'common.online': 'Online',
    'common.offline': 'Offline',
    'common.enabled': 'Enabled',
    'common.disabled': 'Disabled',
    'common.connected': 'Connected',
    'common.disconnected': 'Disconnected',

    'nav.dashboard': 'Dashboard',
    'nav.markets': 'Markets',
    'nav.arbitrage': 'Arbitrage',
    'nav.agents': 'Agents',
    'nav.config': 'Config',
    'nav.history': 'History',
    'nav.betting': 'Trad. Betting',
    'nav.copy': 'Copy Trading',
    'nav.sentiment': 'Sentiment',

    'dashboard.title': 'System Overview',
    'dashboard.capital': 'Total Capital',
    'dashboard.profitToday': 'Profit Today',
    'dashboard.marketsActive': 'Active Markets',
    'dashboard.agentsOnline': 'Agents Online',
    'dashboard.riskLevel': 'Risk Level',
    'dashboard.recentOpportunities': 'Recent Opportunities',
    'dashboard.systemStatus': 'System Status',
    'dashboard.scanMarkets': 'Scan Markets',
    'dashboard.emergencyHalt': 'Emergency Halt',
    'dashboard.mode.live': 'Live Mode',
    'dashboard.mode.dryrun': 'Dry Run',
    'dashboard.mode.halted': 'Halted',

    'markets.title': 'Markets',
    'markets.search': 'Search markets...',
    'markets.volume': '24h Volume',
    'markets.liquidity': 'Liquidity',
    'markets.source': 'Source',
    'markets.endDate': 'End Date',

    'arbitrage.title': 'Arbitrage Opportunities',
    'arbitrage.scan': 'Scan Markets',
    'arbitrage.scanning': 'Scanning...',
    'arbitrage.noOpportunities': 'No Arbitrage Opportunities',
    'arbitrage.noOpportunitiesHint': 'Click "Scan Markets" to start searching',
    'arbitrage.loadingOpportunities': 'Loading opportunities...',
    'arbitrage.expectedProfit': 'Expected Profit',
    'arbitrage.profitRate': 'Profit Rate',
    'arbitrage.worstCaseLoss': 'Worst Case Loss',
    'arbitrage.analyze': 'Analyze',
    'arbitrage.aiAnalyze': 'AI Analysis',
    'arbitrage.execute': 'Execute',
    'arbitrage.type.dutchBook': 'Dutch Book',
    'arbitrage.type.crossPlatform': 'Cross-Platform',
    'arbitrage.type.hedgeArb': 'Hedge Arbitrage',
    'arbitrage.autoRefresh': 'Auto Refresh',

    'agents.title': 'Agent Management',
    'agents.count': '{count} agents total',
    'agents.toggle': 'Enable/Disable',
    'agents.test': 'Test',
    'agents.decisions': 'Decisions Today',
    'agents.approvalRate': 'Approval Rate',
    'agents.lastActivity': 'Last Activity',

    'ai.analyzing': 'AI is analyzing...',
    'ai.semanticRisk': 'Semantic Risk',
    'ai.irreversibility': 'Irreversibility Score',
    'ai.recommendation': 'Recommendation',
    'ai.warnings': 'Warnings',
    'ai.execute': 'Execute Trade',
    'ai.hold': 'Hold',
    'ai.halt': 'Halt',
    'ai.agentDecisions': 'Agent Decisions',
    'ai.approve': 'Approve',
    'ai.reject': 'Reject',
    'ai.abstain': 'Abstain',

    'config.title': 'System Configuration',
    'config.ai': 'AI Settings',
    'config.risk': 'Risk Management',
    'config.execution': 'Execution Strategy',
    'config.dataSources': 'Data Sources',
    'config.notifications': 'Notifications',
    'config.saveSuccess': 'Configuration saved',
    'config.resetConfirm': 'Are you sure you want to reset?',

    'history.title': 'Trade History',
    'history.executionPlan': 'Execution Plan',
    'history.result': 'Result',
    'history.profit': 'P&L',
    'history.time': 'Time',

    'betting.title': 'Traditional Betting',
    'betting.sites': 'Configured Sites',
    'betting.addSite': 'Add Site',
    'betting.odds': 'Odds Monitor',
    'betting.automation': 'Automation',

    'copy.title': 'Copy Trading',
    'copy.traders': 'Trader Leaderboard',
    'copy.positions': 'My Copy Positions',
    'copy.startCopy': 'Start Copying',
    'copy.stopCopy': 'Stop Copying',
    'copy.winRate': 'Win Rate',
    'copy.profitPercent': 'Profit %',
    'copy.followers': 'Followers',

    'sentiment.title': 'Market Sentiment',
    'sentiment.trending': 'Trending Topics',
    'sentiment.bullish': 'Bullish',
    'sentiment.bearish': 'Bearish',
    'sentiment.neutral': 'Neutral',
    'sentiment.analyze': 'Analyze Text',
    'sentiment.liveData': 'Live Data',
    'sentiment.aiEstimate': 'AI Estimate',

    'translate.title': 'Translate',
    'translate.translating': 'Translating...',
    'translate.original': 'Original',
    'translate.translated': 'Translated',
  },
};

const currentLanguage = ref<Language>('zh-CN');

export function useI18n() {
  const t = (key: string, params?: Record<string, string | number>): string => {
    let text = translations[currentLanguage.value][key] || key;
    // Support {param} interpolation
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };

  const setLanguage = (lang: Language) => {
    currentLanguage.value = lang;
    localStorage.setItem('aegis-language', lang);
  };

  const language = computed(() => currentLanguage.value);

  const languageOptions = [
    { value: 'zh-CN', label: '简体中文' },
    { value: 'zh-TW', label: '繁體中文' },
    { value: 'en', label: 'English' },
  ];

  const initLanguage = () => {
    const saved = localStorage.getItem('aegis-language') as Language;
    if (saved && translations[saved]) {
      currentLanguage.value = saved;
    }
  };

  return { t, language, setLanguage, languageOptions, initLanguage };
}

export default useI18n;
