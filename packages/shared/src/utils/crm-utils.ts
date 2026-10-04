/**
 * TCERP - CRM Utilities & Algorithms
 * Package: @tcerp/shared
 */

export class InvalidPhoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPhoneError';
  }
}

/**
 * Normalizes Iranian and international phone numbers to canonical E.164.
 *
 * Rules:
 * 1. Normalizes Persian and Arabic numerals to ASCII digits.
 * 2. Strips spaces, dashes, parentheses, dots.
 * 3. Iranian Mobile:
 *    - Inputs like '09121234567', '9121234567', '+989121234567', '00989121234567'
 *    - Validates Iranian mobile operator prefix (090x, 091x, 092x, 093x, 099x)
 *    - Canonical output: '+989121234567' (total 13 chars)
 * 4. Iranian Landline:
 *    - Inputs like '02188888888', '+982188888888'
 *    - Canonical output: '+982188888888'
 * 5. International E.164:
 *    - Preserves valid international E.164 numbers starting with '+' (or '00' converted to '+')
 *    - Validates length between 8 and 15 digits according to ITU-T E.164 standard.
 * 6. Malformed inputs throw InvalidPhoneError.
 */
export function normalizeCanonicalPhone(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new InvalidPhoneError('شماره تلفن الزامی است.');
  }

  // Convert Persian and Arabic digits to ASCII digits
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let cleaned = raw.trim();

  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replaceAll(persianDigits[i], String(i));
    cleaned = cleaned.replaceAll(arabicDigits[i], String(i));
  }

  const isInternationalPrefix = cleaned.startsWith('+') || cleaned.startsWith('00');
  const hasPlus = cleaned.startsWith('+');
  
  // Strip all non-digits
  let digitsOnly = cleaned.replace(/\D/g, '');

  if (digitsOnly.length === 0) {
    throw new InvalidPhoneError('شماره تلفن فاقد ارقام معتبر است.');
  }

  // Convert leading 00 to standard international prefix
  if (digitsOnly.startsWith('00')) {
    digitsOnly = digitsOnly.substring(2);
  }

  // Check if international non-Iranian format
  if ((hasPlus || isInternationalPrefix) && !digitsOnly.startsWith('98')) {
    // International number (non-Iran)
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      throw new InvalidPhoneError(`شماره بین‌المللی ${raw} دارای طول نامعتبر است (${digitsOnly.length} رقم).`);
    }
    return `+${digitsOnly}`;
  }

  // Iranian number normalization
  let iranLocal = digitsOnly;
  if (iranLocal.startsWith('0098')) {
    iranLocal = iranLocal.substring(4);
  } else if (iranLocal.startsWith('98')) {
    iranLocal = iranLocal.substring(2);
  } else if (iranLocal.startsWith('0')) {
    iranLocal = iranLocal.substring(1);
  }

  // Mobile validation: must start with 9 and have exactly 10 digits
  if (iranLocal.startsWith('9')) {
    if (iranLocal.length !== 10) {
      throw new InvalidPhoneError(`شماره موبایل ایران باید ۱۰ رقم پس از پیش‌شماره باشد. طول فعلی: ${iranLocal.length}`);
    }
    // Check valid Iranian operator prefixes
    // 901-905, 910-919, 920-923, 930-939, 990-994, 996, 998, 999
    const secondDigit = iranLocal.charAt(1);
    const validSecondDigits = ['0', '1', '2', '3', '9'];
    if (!validSecondDigits.includes(secondDigit)) {
      throw new InvalidPhoneError(`پیش‌شماره اپراتور موبایل ایران نامعتبر است: 09${secondDigit}`);
    }
    return `+98${iranLocal}`;
  }

  // Landline validation: 10 digits (e.g. 2188888888, 3133333333, etc.)
  if (iranLocal.length === 10) {
    return `+98${iranLocal}`;
  }

  // If starts with 8 digits without area code (e.g. 88888888) -> not canonical without area code
  if (digitsOnly.length >= 8 && digitsOnly.length <= 15 && isInternationalPrefix) {
    return `+${digitsOnly}`;
  }

  throw new InvalidPhoneError(`فرمت شماره تلفن نامعتبر است: ${raw}`);
}

/**
 * Calculates string similarity using 3-grams (Trigram algorithm).
 * NOTE: In production queries, the PostgreSQL pg_trgm extension function similarity(col, val)
 * is used directly in SQL. This TypeScript implementation is provided for client-side evaluation,
 * local testing, and fallback processing.
 */
export function calculateTrigramSimilarity(strA: string, strB: string): number {
  if (!strA || !strB) return 0;

  const normalizeForTrigram = (s: string) => {
    return s
      .toLowerCase()
      .replace(/[يى]/g, 'ی')
      .replace(/[ك]/g, 'ک')
      .replace(/[‌]/g, ' ') // zero-width non-joiner
      .replace(/\s+/g, ' ')
      .trim();
  };

  const a = normalizeForTrigram(strA);
  const b = normalizeForTrigram(strB);

  if (a === b) return 1.0;

  const getTrigrams = (s: string): Set<string> => {
    const padded = `  ${s} `;
    const trigrams = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.add(padded.substring(i, i + 3));
    }
    return trigrams;
  };

  const triA = getTrigrams(a);
  const triB = getTrigrams(b);

  let intersectionCount = 0;
  for (const tri of triA) {
    if (triB.has(tri)) {
      intersectionCount++;
    }
  }

  const triSimilarity = (2 * intersectionCount) / (triA.size + triB.size);

  // Levenshtein edit distance for high-precision Persian name variants
  const levDist = (s1: string, s2: string): number => {
    const m = s1.length;
    const n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    const maxLen = Math.max(m, n);
    return maxLen === 0 ? 1 : 1 - dp[m][n] / maxLen;
  };

  const levSimilarity = levDist(a, b);
  const finalScore = Math.max(triSimilarity, levSimilarity);
  return Math.round(finalScore * 1000) / 1000;
}

/**
 * Customer Scoring Configuration Schema
 * Loaded dynamically from company settings / rules.
 */
export interface CustomerScoringConfig {
  weights: {
    operational_profit: number; // e.g. 0.25 (25%)
    purchased_tonnage: number;  // e.g. 0.25 (25%)
    purchase_count: number;     // e.g. 0.15 (15%)
    total_paid_amount: number;  // e.g. 0.20 (20%)
    recency: number;            // e.g. 0.15 (15%)
  };
  thresholds: {
    max_profit: number;         // Amount in Rials for 100% component score
    max_tonnage: number;        // Tons for 100% component score
    max_purchase_count: number; // Purchase count for 100% component score
    max_paid_amount: number;    // Total paid amount for 100% component score
    recency_half_life_days: number; // Days after which recency component decays by 50%
  };
  levels: {
    VIP: number;      // Threshold score for VIP level
    PLATINUM: number; // Threshold score for PLATINUM level
    GOLD: number;     // Threshold score for GOLD level
    SILVER: number;   // Threshold score for SILVER level
  };
}

export const DEFAULT_CUSTOMER_SCORING_CONFIG: CustomerScoringConfig = {
  weights: {
    operational_profit: 0.25,
    purchased_tonnage: 0.25,
    purchase_count: 0.15,
    total_paid_amount: 0.20,
    recency: 0.15,
  },
  thresholds: {
    max_profit: 1_000_000_000,      // 1 Billion Rials
    max_tonnage: 500,               // 500 Metric Tons
    max_purchase_count: 20,         // 20 Orders
    max_paid_amount: 10_000_000_000, // 10 Billion Rials
    recency_half_life_days: 90,     // 90 Days
  },
  levels: {
    VIP: 85,
    PLATINUM: 70,
    GOLD: 50,
    SILVER: 30,
  },
};

export interface CustomerMetricsInput {
  operational_profit: number;
  purchased_tonnage: number;
  purchase_count: number;
  total_paid_amount: number;
  recency_days: number;
}

export interface CustomerScoreResult {
  score: number;
  level: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'VIP';
  breakdown: {
    profit_score: number;
    tonnage_score: number;
    count_score: number;
    paid_score: number;
    recency_score: number;
  };
}

/**
 * Computes customer score and tier level dynamically based on company settings/rules.
 * Incorporates all 5 required business metrics:
 * 1. Operational profit
 * 2. Purchased tonnage
 * 3. Purchase count
 * 4. Total paid amount
 * 5. Purchase recency / frequency
 */
export function calculateCustomerScore(
  metrics: CustomerMetricsInput,
  config: CustomerScoringConfig = DEFAULT_CUSTOMER_SCORING_CONFIG
): CustomerScoreResult {
  const { weights, thresholds, levels } = config;

  // 1. Operational Profit Score (0-100)
  const profitScore = Math.min(100, Math.max(0, (metrics.operational_profit / thresholds.max_profit) * 100));

  // 2. Purchased Tonnage Score (0-100)
  const tonnageScore = Math.min(100, Math.max(0, (metrics.purchased_tonnage / thresholds.max_tonnage) * 100));

  // 3. Purchase Count Score (0-100)
  const countScore = Math.min(100, Math.max(0, (metrics.purchase_count / thresholds.max_purchase_count) * 100));

  // 4. Total Paid Amount Score (0-100)
  const paidScore = Math.min(100, Math.max(0, (metrics.total_paid_amount / thresholds.max_paid_amount) * 100));

  // 5. Recency Score (0-100, decays as recency_days increases)
  const recencyDecay = (metrics.recency_days / thresholds.recency_half_life_days) * 50;
  const recencyScore = Math.max(0, Math.min(100, 100 - recencyDecay));

  // Weighted total score
  const totalScore =
    profitScore * weights.operational_profit +
    tonnageScore * weights.purchased_tonnage +
    countScore * weights.purchase_count +
    paidScore * weights.total_paid_amount +
    recencyScore * weights.recency;

  const score = Math.round(totalScore * 100) / 100;

  let level: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'VIP' = 'BRONZE';
  if (score >= levels.VIP) level = 'VIP';
  else if (score >= levels.PLATINUM) level = 'PLATINUM';
  else if (score >= levels.GOLD) level = 'GOLD';
  else if (score >= levels.SILVER) level = 'SILVER';

  return {
    score,
    level,
    breakdown: {
      profit_score: Math.round(profitScore * 10) / 10,
      tonnage_score: Math.round(tonnageScore * 10) / 10,
      count_score: Math.round(countScore * 10) / 10,
      paid_score: Math.round(paidScore * 10) / 10,
      recency_score: Math.round(recencyScore * 10) / 10,
    },
  };
}
