import 'reflect-metadata';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

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
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('TCERP-NestAPI');

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    })
  );

  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  logger.log(`🚀 TCERP NestJS API successfully listening on http://localhost:${port}`);
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap().catch(err => {
    console.error('Failed to start NestJS API:', err);
    process.exit(1);
  });
}

export { bootstrap };
