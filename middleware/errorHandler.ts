/**
 * Centralized Error Handling Middleware
 * Catches all errors from async route handlers and formats them consistently
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../utils/errors';
import { handleValidationError } from '../validations/common.validation';

export interface ErrorResponse {
  error: string;
  details?: Record<string, any>;
  statusCode?: number;
}

/**
 * Global error handling middleware
 * Must be registered as the LAST middleware in Express app
 */
export const errorHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Safe error logging that won't fail on circular references
  try {
    const errorLog = {
      message: err instanceof Error ? err.message : String(err),
      type: err.constructor.name,
      ...(err instanceof AppError && { statusCode: err.statusCode })
    };
    console.error('[Error Handler]', JSON.stringify(errorLog, null, 2));
  } catch (logErr) {
    console.error('[Error Handler] Failed to log error:', err instanceof Error ? err.message : String(err));
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const validationErr = handleValidationError(err);
    return res.status(400).json(validationErr);
  }

  // Handle custom AppError instances
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: err.message,
      statusCode: err.statusCode
    };
    
    // Include details for ValidationError
    if (err instanceof ValidationError && err.details) {
      response.details = err.details;
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle Prisma-specific errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const code = (err as any).code;
    
    switch (code) {
      case 'P2025':
        return res.status(404).json({
          error: 'Resource not found',
          statusCode: 404
        });
      case 'P2002':
        return res.status(409).json({
          error: 'Unique constraint violation',
          statusCode: 409,
          details: { field: (err as any).meta?.target }
        });
      case 'P2014':
        return res.status(400).json({
          error: 'Required relation violation',
          statusCode: 400
        });
      default:
        return res.status(500).json({
          error: 'Database error occurred',
          statusCode: 500
        });
    }
  }

  // Handle unknown errors
  const statusCode = (err as any).statusCode || 500;
  const message = err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    error: message,
    statusCode
  });
};

/**
 * Async error wrapper - wraps async route handlers to catch errors
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
