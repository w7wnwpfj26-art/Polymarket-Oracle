/**
 * 赔率格式解析器
 * 支持多种赔率格式的解析和转换
 * 
 * 支持的格式：
 * - Decimal (欧洲盘): 1.85, 2.50
 * - Fractional (英式盘): 1/2, 5/4, 11/10
 * - American (美式盘): -110, +150
 * - Hong Kong (香港盘): 0.85, 1.50
 * - Malay (马来盘): 0.85, -0.67
 * - Indonesian (印尼盘): 1.85, -1.18
 */

import logger from '../utils/logger';

// ============ 类型定义 ============

export type OddsFormat = 'decimal' | 'fractional' | 'american' | 'hongkong' | 'malay' | 'indonesian' | 'unknown';

export interface ParsedOdds {
  original: string;
  format: OddsFormat;
  decimal: number;
  fractional: string;
  american: number;
  hongkong: number;
  malay: number;
  indonesian: number;
  impliedProbability: number;
}

// ============ 赔率解析器 ============

class OddsParser {
  /**
   * 解析赔率字符串
   */
  parse(oddsStr: string): ParsedOdds {
    const cleaned = oddsStr.trim().replace(/\s/g, '');
    
    // 检测格式并解析
    const format = this.detectFormat(cleaned);
    let decimal: number;

    switch (format) {
      case 'decimal':
        decimal = this.parseDecimal(cleaned);
        break;
      case 'fractional':
        decimal = this.parseFractional(cleaned);
        break;
      case 'american':
        decimal = this.parseAmerican(cleaned);
        break;
      case 'hongkong':
        decimal = this.parseHongKong(cleaned);
        break;
      case 'malay':
        decimal = this.parseMalay(cleaned);
        break;
      case 'indonesian':
        decimal = this.parseIndonesian(cleaned);
        break;
      default:
        decimal = parseFloat(cleaned) || 1;
    }

    // 确保赔率有效
    if (isNaN(decimal) || decimal < 1) {
      decimal = 1;
    }

    return {
      original: oddsStr,
      format,
      decimal,
      fractional: this.toFractional(decimal),
      american: this.toAmerican(decimal),
      hongkong: this.toHongKong(decimal),
      malay: this.toMalay(decimal),
      indonesian: this.toIndonesian(decimal),
      impliedProbability: this.toImpliedProbability(decimal),
    };
  }

  /**
   * 检测赔率格式
   */
  detectFormat(oddsStr: string): OddsFormat {
    // 分数格式: 1/2, 5/4
    if (/^\d+\/\d+$/.test(oddsStr)) {
      return 'fractional';
    }

    // 美式格式: +150, -110
    if (/^[+-]\d+$/.test(oddsStr)) {
      return 'american';
    }

    // 马来/印尼格式: 负数小数
    if (/^-\d+\.\d+$/.test(oddsStr)) {
      const value = parseFloat(oddsStr);
      if (value >= -1 && value < 0) {
        return 'malay';
      }
      return 'indonesian';
    }

    // 欧洲/香港格式: 正数小数
    if (/^\d+\.?\d*$/.test(oddsStr)) {
      const value = parseFloat(oddsStr);
      if (value >= 1) {
        return 'decimal';
      }
      if (value > 0 && value < 1) {
        return 'hongkong';
      }
    }

    return 'unknown';
  }

  // ============ 解析各种格式 ============

  /**
   * 解析欧洲盘 (Decimal)
   */
  parseDecimal(oddsStr: string): number {
    return parseFloat(oddsStr) || 1;
  }

  /**
   * 解析英式盘 (Fractional)
   * 例如: 1/2 = 1.50, 5/4 = 2.25
   */
  parseFractional(oddsStr: string): number {
    const [numerator, denominator] = oddsStr.split('/').map(Number);
    if (!denominator) return 1;
    return (numerator / denominator) + 1;
  }

  /**
   * 解析美式盘 (American)
   * 例如: -110 = 1.909, +150 = 2.50
   */
  parseAmerican(oddsStr: string): number {
    const value = parseInt(oddsStr, 10);
    if (value >= 0) {
      return (value / 100) + 1;
    } else {
      return (100 / Math.abs(value)) + 1;
    }
  }

  /**
   * 解析香港盘 (Hong Kong)
   * 例如: 0.85 = 1.85, 1.50 = 2.50
   */
  parseHongKong(oddsStr: string): number {
    return parseFloat(oddsStr) + 1;
  }

  /**
   * 解析马来盘 (Malay)
   * 正数: 0.85 = 1.85
   * 负数: -0.67 表示赢率为 1/0.67 + 1
   */
  parseMalay(oddsStr: string): number {
    const value = parseFloat(oddsStr);
    if (value >= 0) {
      return value + 1;
    } else {
      return (1 / Math.abs(value)) + 1;
    }
  }

  /**
   * 解析印尼盘 (Indonesian)
   * 正数: 1.85 = 2.85
   * 负数: -1.18 = 1.85 (1/1.18 + 1)
   */
  parseIndonesian(oddsStr: string): number {
    const value = parseFloat(oddsStr);
    if (value >= 0) {
      return value + 1;
    } else {
      return (1 / Math.abs(value)) + 1;
    }
  }

  // ============ 转换为各种格式 ============

  /**
   * 转换为英式盘
   */
  toFractional(decimal: number): string {
    const decimalPart = decimal - 1;
    
    // 常见分数映射
    const fractions: [number, string][] = [
      [0.5, '1/2'],
      [0.33, '1/3'],
      [0.25, '1/4'],
      [0.2, '1/5'],
      [0.67, '2/3'],
      [0.75, '3/4'],
      [1, '1/1'],
      [1.5, '3/2'],
      [2, '2/1'],
      [2.5, '5/2'],
      [3, '3/1'],
      [4, '4/1'],
      [5, '5/1'],
      [10, '10/1'],
    ];

    // 找最接近的分数
    let closestFraction = '1/1';
    let minDiff = Infinity;

    for (const [value, fraction] of fractions) {
      const diff = Math.abs(decimalPart - value);
      if (diff < minDiff) {
        minDiff = diff;
        closestFraction = fraction;
      }
    }

    // 如果差距太大，返回计算值
    if (minDiff > 0.1) {
      const numerator = Math.round(decimalPart * 100);
      const denominator = 100;
      const gcd = this.gcd(numerator, denominator);
      return `${numerator / gcd}/${denominator / gcd}`;
    }

    return closestFraction;
  }

  /**
   * 转换为美式盘
   */
  toAmerican(decimal: number): number {
    if (decimal >= 2) {
      return Math.round((decimal - 1) * 100);
    } else {
      return Math.round(-100 / (decimal - 1));
    }
  }

  /**
   * 转换为香港盘
   */
  toHongKong(decimal: number): number {
    return parseFloat((decimal - 1).toFixed(2));
  }

  /**
   * 转换为马来盘
   */
  toMalay(decimal: number): number {
    const hk = decimal - 1;
    if (hk <= 1) {
      return parseFloat(hk.toFixed(2));
    } else {
      return parseFloat((-1 / hk).toFixed(2));
    }
  }

  /**
   * 转换为印尼盘
   */
  toIndonesian(decimal: number): number {
    const hk = decimal - 1;
    if (hk >= 1) {
      return parseFloat(hk.toFixed(2));
    } else {
      return parseFloat((-1 / hk).toFixed(2));
    }
  }

  /**
   * 计算隐含概率
   */
  toImpliedProbability(decimal: number): number {
    return parseFloat(((1 / decimal) * 100).toFixed(2));
  }

  // ============ 工具方法 ============

  /**
   * 最大公约数
   */
  private gcd(a: number, b: number): number {
    return b === 0 ? a : this.gcd(b, a % b);
  }

  /**
   * 批量解析赔率
   */
  parseAll(oddsStrings: string[]): ParsedOdds[] {
    return oddsStrings.map(s => this.parse(s));
  }

  /**
   * 格式化显示
   */
  formatDisplay(decimal: number, format: OddsFormat): string {
    switch (format) {
      case 'decimal':
        return decimal.toFixed(2);
      case 'fractional':
        return this.toFractional(decimal);
      case 'american':
        const am = this.toAmerican(decimal);
        return am >= 0 ? `+${am}` : `${am}`;
      case 'hongkong':
        return this.toHongKong(decimal).toFixed(2);
      case 'malay':
        return this.toMalay(decimal).toFixed(2);
      case 'indonesian':
        return this.toIndonesian(decimal).toFixed(2);
      default:
        return decimal.toFixed(2);
    }
  }

  /**
   * 比较两个赔率
   */
  compare(odds1: string | number, odds2: string | number): number {
    const decimal1 = typeof odds1 === 'string' ? this.parse(odds1).decimal : odds1;
    const decimal2 = typeof odds2 === 'string' ? this.parse(odds2).decimal : odds2;
    return decimal1 - decimal2;
  }

  /**
   * 计算两个赔率的价值差异
   */
  valueDifference(odds1: string | number, odds2: string | number): {
    decimal: number;
    percentage: number;
    favorOdds1: boolean;
  } {
    const d1 = typeof odds1 === 'string' ? this.parse(odds1).decimal : odds1;
    const d2 = typeof odds2 === 'string' ? this.parse(odds2).decimal : odds2;
    
    const diff = d1 - d2;
    const percentage = ((d1 - d2) / d2) * 100;

    return {
      decimal: parseFloat(diff.toFixed(3)),
      percentage: parseFloat(percentage.toFixed(2)),
      favorOdds1: diff > 0,
    };
  }

  /**
   * 计算组合赔率（多关）
   */
  calculateParlay(odds: number[]): number {
    return odds.reduce((acc, odd) => acc * odd, 1);
  }

  /**
   * 计算保本赔率
   */
  calculateBreakEven(impliedProbability: number): number {
    return 1 / (impliedProbability / 100);
  }
}

// Export singleton
export const oddsParser = new OddsParser();
export default oddsParser;
