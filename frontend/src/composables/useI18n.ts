/**
 * 国际化 Composable
 * 支持中文(默认)、英文、繁体中文
 */

import { ref, computed } from 'vue';

export type Language = 'zh-CN' | 'zh-TW' | 'en';

// 翻译字典
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
    
    // 套利页面
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
    
    // 翻译
    'translate.title': '翻译原文',
    'translate.translating': '翻译中...',
    'translate.original': '原文',
    'translate.translated': '译文',
  },
  
  'zh-TW': {
    // 通用
    'common.loading': '載入中...',
    'common.scanning': '掃描中...',
    'common.analyzing': '分析中...',
    'common.confirm': '確認',
    'common.cancel': '取消',
    'common.save': '儲存',
    'common.success': '成功',
    'common.failed': '失敗',
    'common.confidence': '信心度',
    
    // 套利頁面
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
    
    // AI 分析
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
    
    // 翻譯
    'translate.title': '翻譯原文',
    'translate.translating': '翻譯中...',
    'translate.original': '原文',
    'translate.translated': '譯文',
  },
  
  'en': {
    // Common
    'common.loading': 'Loading...',
    'common.scanning': 'Scanning...',
    'common.analyzing': 'Analyzing...',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.success': 'Success',
    'common.failed': 'Failed',
    'common.confidence': 'Confidence',
    
    // Arbitrage
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
    
    // AI
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
    
    // Translate
    'translate.title': 'Translate',
    'translate.translating': 'Translating...',
    'translate.original': 'Original',
    'translate.translated': 'Translated',
  },
};

// 当前语言（全局状态）
const currentLanguage = ref<Language>('zh-CN');

export function useI18n() {
  // 获取翻译
  const t = (key: string): string => {
    return translations[currentLanguage.value][key] || key;
  };

  // 切换语言
  const setLanguage = (lang: Language) => {
    currentLanguage.value = lang;
    localStorage.setItem('aegis-language', lang);
  };

  // 获取当前语言
  const language = computed(() => currentLanguage.value);

  // 语言选项
  const languageOptions = [
    { value: 'zh-CN', label: '简体中文' },
    { value: 'zh-TW', label: '繁體中文' },
    { value: 'en', label: 'English' },
  ];

  // 初始化语言
  const initLanguage = () => {
    const saved = localStorage.getItem('aegis-language') as Language;
    if (saved && translations[saved]) {
      currentLanguage.value = saved;
    }
  };

  return {
    t,
    language,
    setLanguage,
    languageOptions,
    initLanguage,
  };
}

export default useI18n;
