/**
 * Global Error Handler Middleware
 * Provides unified error handling across all API endpoints
 */

import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import logger from '../utils/logger';
import type { ApiResponse } from '../core/types';

// Custom error classes
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTH_REQUIRED');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(
      `External service error: ${service}`,
      503,
      'EXTERNAL_SERVICE_ERROR',
      { service, originalMessage: originalError?.message }
    );
  }
}

// Error response formatter
function formatErrorResponse(
  error: Error,
  requestId: string,
  includeStack: boolean = false
): ApiResponse<null> {
  const isAppError = error instanceof AppError;
  const isHTTPException = error instanceof HTTPException;
  
  const statusCode = isAppError 
    ? error.statusCode 
    : isHTTPException 
    ? error.status 
    : 500;
    
  const errorCode = isAppError 
    ? error.code 
    : isHTTPException 
    ? 'HTTP_EXCEPTION' 
    : 'INTERNAL_ERROR';
    
  const errorMessage = error.message || 'An unexpected error occurred';
  
  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code: errorCode,
      message: errorMessage,
      ...(isAppError && error.details ? { details: error.details } : {}),
      ...(includeStack ? { stack: error.stack } : {})
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      processingTimeMs: 0
    }
  };
  
  return response;
}

// Global error handler
export function globalErrorHandler() {
  return async (err: Error, c: Context) => {
    const requestId = c.get('requestId') || crypto.randomUUID();
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Log error with context
    const errorContext = {
      requestId,
      method: c.req.method,
      path: c.req.path,
      query: c.req.query(),
      userAgent: c.req.header('user-agent'),
      ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
        ...(err instanceof AppError ? { code: err.code, statusCode: err.statusCode } : {})
      }
    };
    
    // Determine log level based on error type
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.system.error('Server error occurred', errorContext);
      } else if (err.statusCode >= 400) {
        logger.system.warn('Client error occurred', errorContext);
      } else {
        logger.system.info('Request error', errorContext);
      }
    } else if (err instanceof HTTPException) {
      if (err.status >= 500) {
        logger.system.error('HTTP exception occurred', errorContext);
      } else {
        logger.system.warn('HTTP exception occurred', errorContext);
      }
    } else {
      logger.system.critical('Unexpected error occurred', errorContext);
    }
    
    // Format response
    const errorResponse = formatErrorResponse(
      err,
      requestId,
      !isProduction // Include stack in non-production
    );
    
    // Determine status code
    const statusCode = err instanceof AppError 
      ? err.statusCode 
      : err instanceof HTTPException 
      ? err.status 
      : 500;
    
    // Set additional headers for specific errors
    if (err instanceof RateLimitError && err.details) {
      const retryAfter = (err.details as any).retryAfter;
      if (retryAfter) {
        c.header('Retry-After', retryAfter.toString());
      }
    }
    
    return c.json(errorResponse, statusCode as any);
  };
}

// Request ID middleware (should be applied before error handler)
export function requestIdMiddleware() {
  return async (c: Context, next: Function) => {
    const requestId = c.req.header('x-request-id') || crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-ID', requestId);
    await next();
  };
}

// Async error wrapper for route handlers
export function asyncHandler(fn: Function) {
  return async (c: Context) => {
    try {
      return await fn(c);
    } catch (error) {
      throw error; // Will be caught by global error handler
    }
  };
}

// Not found handler
export function notFoundHandler() {
  return (c: Context) => {
    const requestId = c.get('requestId') || crypto.randomUUID();
    
    logger.api.warn('Route not found', {
      requestId,
      method: c.req.method,
      path: c.req.path
    });
    
    return c.json(formatErrorResponse(
      new NotFoundError('Route'),
      requestId
    ), 404);
  };
}
