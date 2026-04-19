import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors.js';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const successResponse = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = 200
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  return res.status(statusCode).json(response);
};

export const paginatedResponse = <T>(
  res: Response,
  data: T[],
  pagination: PaginationInfo,
  message?: string
): Response => {
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    message,
    pagination,
  };
  return res.status(200).json(response);
};

export const errorResponse = (
  res: Response,
  error: AppError | Error,
  statusCode?: number
): Response => {
  const status = error instanceof AppError ? error.statusCode : (statusCode || 500);
  const code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';
  const details = error instanceof AppError ? error.details : undefined;

  const response: ApiResponse & { details?: unknown; stack?: string } = {
    success: false,
    message: error.message,
    code,
    ...(details && { details }),
  };

  if (config.NODE_ENV === 'development' && !(error instanceof AppError)) {
    response.stack = error.stack;
  }

  return res.status(status).json(response);
};

export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export const asyncHandler = (fn: AsyncHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const globalErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  if (error instanceof AppError) {
    return errorResponse(res, error);
  }

  const prodError = new AppError(
    config.NODE_ENV === 'production' ? '服务器内部错误' : error.message,
    500
  );

  return errorResponse(res, prodError);
};
