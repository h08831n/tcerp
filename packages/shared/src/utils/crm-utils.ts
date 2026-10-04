/**
 * TCERP - CRM Utilities & Algorithms
 * Package: @tcerp/shared
 */

/**
 * Normalizes Iranian and international phone numbers to canonical E.164.
 * Examples:
 * - '09121234567' -> '+989121234567'
 * - '+989121234567' -> '+989121234567'
 * - '00989121234567' -> '+989121234567'
 * - '9121234567' -> '+989121234567'
 */
export function normalizeCanonicalPhone(raw: string): string {
  if (!raw) return '';
  // Convert Persian/Arabic digits to English digits
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let cleaned = raw.trim();

  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replaceAll(persianDigits[i], String(i));
    cleaned = cleaned.replaceAll(arabicDigits[i], String(i));
  }

  // Strip all non-digit characters
  cleaned = cleaned.replace(/\D/g, '');

  if (cleaned.startsWith('0098')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('98')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Prepend Iranian country code
  return `+98${cleaned}`;
}

/**
 * Calculates string similarity using 3-grams (Trigram algorithm, identical to pg_trgm in PostgreSQL).
 * Returns a value between 0.0 (no similarity) and 1.0 (exact match).
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
 * Computes customer score level based on configurable parameters.
 */
export function calculateCustomerScore(
  metrics: {
    operational_profit: number;
    purchased_tonnage: number;
    purchase_count: number;
    total_paid: number;
    recency_days: number;
  },
  config = {
    profitWeight: 0.35,
    tonnageWeight: 0.35,
    frequencyWeight: 0.30,
    levels: {
      VIP: 85,
      PLATINUM: 70,
      GOLD: 50,
      SILVER: 30,
      BRONZE: 0,
    },
  }
): { score: number; level: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'VIP' } {
  // Normalize metrics onto 0-100 scale:
  // Profit: 100M Rials = 50 pts, 500M+ = 100 pts
  const profitScore = Math.min(100, (metrics.operational_profit / 500_000_000) * 100);
  // Tonnage: 10 tons = 20 pts, 100 tons = 100 pts
  const tonnageScore = Math.min(100, (metrics.purchased_tonnage / 100) * 100);
  // Frequency & Count: 10 purchases = 100 pts
  const countScore = Math.min(100, metrics.purchase_count * 10);

  const rawScore =
    profitScore * config.profitWeight +
    tonnageScore * config.tonnageWeight +
    countScore * config.frequencyWeight;

  const score = Math.round(rawScore * 100) / 100;

  let level: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'VIP' = 'BRONZE';
  if (score >= config.levels.VIP) level = 'VIP';
  else if (score >= config.levels.PLATINUM) level = 'PLATINUM';
  else if (score >= config.levels.GOLD) level = 'GOLD';
  else if (score >= config.levels.SILVER) level = 'SILVER';

  return { score, level };
}
