import 'reflect-metadata';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './apps/api/src/app.module';
import { createServer as createViteServer } from 'vite';

// Express 4/5 compatibility for NestJS 12 ExpressAdapter isMiddlewareApplied
const origInit = (express as any).application.init;
(express as any).application.init = function() {
  const origDP = Object.defineProperty;
  (Object as any).defineProperty = function(obj: any, prop: any, descriptor: any) {
    if (prop === 'router') {
      return origDP.call(Object, obj, prop, {
        get: function(this: any) { return this._router; },
        set: function(this: any, v: any) { this._router = v; },
        configurable: true,
        enumerable: true,
      });
    }
    return origDP.apply(Object, arguments as any);
  };
  try {
    return origInit.apply(this, arguments as any);
  } finally {
    (Object as any).defineProperty = origDP;
  }
};

async function bootstrap() {
  const server = express();
  const logger = new Logger('TCERP-FullStack');

  // 1. Mount Vite Middleware for Frontend Client FIRST (non-API routes)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    server.use((req, res, next) => {
      if (req.url.startsWith('/api')) {
        return next();
      }
      vite.middlewares(req, res, next);
    });
    logger.log('⚡ Vite Development Middleware mounted on port 3000');
  } else {
    server.use(express.static('dist'));
  }

  // 2. Create NestJS App with ExpressAdapter on the shared Express instance
  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(server));

  nestApp.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  nestApp.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    })
  );

  // Initialize all NestJS controllers, routes, guards, and filters
  await nestApp.init();
  logger.log('🚀 NestJS API endpoints initialized at /api/v1');

  if (process.env.NODE_ENV === 'production') {
    server.use((req, res, next) => {
      if (req.url.startsWith('/api')) {
        return next();
      }
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  // 3. Listen on port 3000 as strictly required by AI Studio runtime environment
  const port = 3000;
  server.listen(port, '0.0.0.0', () => {
    logger.log(`🟢 TCERP Full-Stack Server active on http://0.0.0.0:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal Server Startup Error:', err);
  process.exit(1);
});
