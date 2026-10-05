/**
 * TCERP - NestJS Global Exception Filter
 * Provides secure, controlled HTTP status codes and formats errors without leaking stack traces.
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { DuplicatePhoneError } from '@tcerp/database';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (request && request.url && !request.url.startsWith('/api')) {
      const nextFn = (request as any).next;
      if (typeof nextFn === 'function') {
        return nextFn();
      }
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'خطای داخلی سرور رخ داده است.';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, any>;
        message = obj.message || obj.error || message;
        details = obj.message !== message ? obj.message : undefined;
        errorCode = obj.error || `HTTP_${status}`;
      }
    } else if (exception instanceof DuplicatePhoneError) {
      status = HttpStatus.CONFLICT; // 409
      message = exception.message;
      errorCode = 'DUPLICATE_PHONE_NUMBER';
    } else if (exception instanceof Error) {
      if (exception.name === 'InvalidPhoneError') {
        status = HttpStatus.BAD_REQUEST; // 400
        message = exception.message;
        errorCode = 'INVALID_PHONE_FORMAT';
      } else if (exception.message.includes('یافت نشد') || exception.message.includes('not found')) {
        status = HttpStatus.NOT_FOUND; // 404
        message = exception.message;
        errorCode = 'RESOURCE_NOT_FOUND';
      } else if (exception.message.includes('دسترسی') || exception.message.includes('Forbidden') || exception.message.includes('permission denied')) {
        status = HttpStatus.FORBIDDEN; // 403
        message = exception.message;
        errorCode = 'PERMISSION_DENIED';
      } else {
        // Unhandled server / database errors: keep stack trace safe on server logs, do not send to client
        console.error(`[EXCEPTION_FILTER_ERROR] ${request.method} ${request.url}:`, (exception as any)?.message, (exception as any)?.stack);
        this.logger.error(`Unhandled error at ${request.method} ${request.url}: ${(exception as any)?.message}`, (exception as any)?.stack);
        status = HttpStatus.INTERNAL_SERVER_ERROR; // 500
        message = 'خطای پایگاه‌داده یا سرور در پردازش درخواست.';
        errorCode = 'DATABASE_OR_INTERNAL_ERROR';
      }
    }

    response.status(status).json({
      statusCode: status,
      errorCode,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
