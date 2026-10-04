/**
 * FooladERP - Environment Validation & Configuration Service
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
}

export function validateEnvironment(): { isValid: boolean; config: AppConfig; errors: string[] } {
  const errors: string[] = [];

  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.APP_PORT || process.env.PORT || '3000', 10);
  const appUrl = process.env.APP_URL || `http://localhost:${port}`;

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
  const dbName = process.env.DB_NAME || 'foolad_erp';
  const dbUser = process.env.DB_USER || 'erp_user';

  if (isNaN(port)) {
    errors.push('APP_PORT must be a valid integer');
  }

  const config: AppConfig = {
    nodeEnv,
    port,
    appUrl,
    db: {
      host: dbHost,
      port: dbPort,
      name: dbName,
      user: dbUser,
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
  };

  return {
    isValid: errors.length === 0,
    config,
    errors,
  };
}
