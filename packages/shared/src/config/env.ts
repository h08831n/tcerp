/**
 * FooladERP - Environment Validation & Configuration Service
 * Package: @foolad/shared
 *
 * Rules:
 * - SMS credentials required only if SMS provider is NOT mock
 * - Moadian credentials required only when Moadian integration is enabled (MOADIAN_ENABLED=true)
 * - Telegram credentials required only when Telegram integration is enabled (TELEGRAM_ENABLED=true)
 * - Never require real external production secrets during local development.
 */

export interface AppConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  db: {
    host: string;
    port: number;
    name: string;
    user: string;
    poolMin: number;
    poolMax: number;
  };
  redis: {
    host: string;
    port: number;
  };
  storage: {
    endpoint: string;
    bucket: string;
    region: string;
  };
  security: {
    jwtExpiresIn: string;
    jwtRefreshExpiresIn: string;
  };
  integrations: {
    sms: {
      provider: string;
      apiKey?: string;
      lineNumber?: string;
    };
    moadian: {
      enabled: boolean;
      environment: string;
      fiscalId?: string;
      privateKey?: string;
    };
    telegram: {
      enabled: boolean;
      botToken?: string;
      channelId?: string;
    };
  };
}

export function validateEnvironment(): { isValid: boolean; config: AppConfig; errors: string[] } {
  const errors: string[] = [];

  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.APP_PORT || process.env.PORT || '3000', 10);
  const appUrl = process.env.APP_URL || `http://localhost:${port}`;

  if (isNaN(port)) {
    errors.push('APP_PORT must be a valid integer');
  }

  // Integrations configuration
  const smsProvider = process.env.SMS_PROVIDER || 'mock';
  const moadianEnabled = process.env.MOADIAN_ENABLED === 'true';
  const telegramEnabled = process.env.TELEGRAM_ENABLED === 'true';

  // 1. SMS credentials required ONLY if provider is not mock
  if (smsProvider !== 'mock' && !process.env.SMS_API_KEY) {
    errors.push('SMS_API_KEY is required when SMS_PROVIDER is not mock');
  }

  // 2. Moadian credentials required ONLY when Moadian integration is enabled
  if (moadianEnabled && !process.env.MOADIAN_FISCAL_ID) {
    errors.push('MOADIAN_FISCAL_ID is required when MOADIAN_ENABLED is true');
  }

  // 3. Telegram credentials required ONLY when Telegram integration is enabled
  if (telegramEnabled && !process.env.TELEGRAM_BOT_TOKEN) {
    errors.push('TELEGRAM_BOT_TOKEN is required when TELEGRAM_ENABLED is true');
  }

  const config: AppConfig = {
    nodeEnv,
    port,
    appUrl,
    db: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      name: process.env.DB_NAME || 'foolad_erp',
      user: process.env.DB_USER || 'erp_user',
      poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
      poolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    storage: {
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      bucket: process.env.S3_BUCKET_NAME || 'foolad-erp-vault',
      region: process.env.S3_REGION || 'us-east-1',
    },
    security: {
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
      jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    },
    integrations: {
      sms: {
        provider: smsProvider,
        apiKey: process.env.SMS_API_KEY,
        lineNumber: process.env.SMS_LINE_NUMBER,
      },
      moadian: {
        enabled: moadianEnabled,
        environment: process.env.MOADIAN_ENVIRONMENT || 'sandbox',
        fiscalId: process.env.MOADIAN_FISCAL_ID,
        privateKey: process.env.MOADIAN_PRIVATE_KEY,
      },
      telegram: {
        enabled: telegramEnabled,
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        channelId: process.env.TELEGRAM_CHANNEL_ID,
      },
    },
  };

  return {
    isValid: errors.length === 0,
    config,
    errors,
  };
}
