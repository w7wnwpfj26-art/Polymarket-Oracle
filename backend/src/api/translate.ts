/**
 * Translation API
 * 使用 AI 进行文本翻译
 */

import { Hono } from 'hono';
import type { ApiResponse } from '../core/types';
import { getConfig } from './config';
import logger from '../utils/logger';

export const translateRoutes = new Hono();

interface TranslateRequest {
  text: string;
  targetLanguage: 'zh' | 'zh-TW' | 'en';
  sourceLanguage?: string;
}

interface TranslateResponse {
  original: string;
  translated: string;
  targetLanguage: string;
}

// 翻译缓存
const translationCache = new Map<string, string>();

// 生成缓存 key
const getCacheKey = (text: string, targetLang: string): string => {
  return `${targetLang}:${text.slice(0, 100)}`;
};

// 翻译文本
translateRoutes.post('/', async (c) => {
  const start = Date.now();
  const body = await c.req.json<TranslateRequest>();
  const { text, targetLanguage = 'zh' } = body;

  if (!text) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Text is required' },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 400);
  }

  // 检查缓存
  const cacheKey = getCacheKey(text, targetLanguage);
  if (translationCache.has(cacheKey)) {
    return c.json<ApiResponse<TranslateResponse>>({
      success: true,
      data: {
        original: text,
        translated: translationCache.get(cacheKey)!,
        targetLanguage,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
        cached: true,
      },
    });
  }

  try {
    const config = getConfig();
    
    // 根据目标语言生成提示
    const targetLangName = {
      'zh': '简体中文',
      'zh-TW': '繁體中文',
      'en': 'English',
    }[targetLanguage] || '简体中文';

    const prompt = `Translate the following text to ${targetLangName}. Only output the translation, no explanations:

${text}`;

    let translated = text;

    // 尝试使用 AI 翻译
    if (config.ai.provider === 'openai' && config.ai.openaiApiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.ai.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: config.ai.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        translated = data.choices?.[0]?.message?.content?.trim() || text;
      }
    } else if (config.ai.provider === 'deepseek' && config.ai.deepseekApiKey) {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.ai.deepseekApiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        translated = data.choices?.[0]?.message?.content?.trim() || text;
      }
    } else {
      // 没有配置 AI，返回原文
      logger.system.warn('No AI provider configured for translation');
    }

    // 缓存结果
    translationCache.set(cacheKey, translated);

    // 限制缓存大小
    if (translationCache.size > 1000) {
      const firstKey = translationCache.keys().next().value;
      if (firstKey) translationCache.delete(firstKey);
    }

    return c.json<ApiResponse<TranslateResponse>>({
      success: true,
      data: {
        original: text,
        translated,
        targetLanguage,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    logger.system.error('Translation failed', { error: (error as Error).message });
    
    return c.json<ApiResponse<TranslateResponse>>({
      success: true, // Still return success with original text
      data: {
        original: text,
        translated: text, // Return original if translation fails
        targetLanguage,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
        fallback: true,
      },
    });
  }
});

// 批量翻译
translateRoutes.post('/batch', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{ texts: string[]; targetLanguage: string }>();
  const { texts, targetLanguage = 'zh' } = body;

  if (!texts || !Array.isArray(texts)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Texts array is required' },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 400);
  }

  const results: TranslateResponse[] = [];

  for (const text of texts.slice(0, 10)) { // Limit to 10 texts
    const cacheKey = getCacheKey(text, targetLanguage);
    const translated = translationCache.get(cacheKey) || text;
    results.push({
      original: text,
      translated,
      targetLanguage,
    });
  }

  return c.json<ApiResponse<TranslateResponse[]>>({
    success: true,
    data: results,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});
