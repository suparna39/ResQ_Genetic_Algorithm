import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: AppError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = (err as AppError).statusCode || 500;
  const isOperational = (err as AppError).isOperational || false;

  if (!isOperational) {
    console.error('💥 Unexpected error:', err);
  }

  const response: ApiResponse = {
    success: false,
    error: err.message || 'Internal Server Error',
  };

  res.status(statusCode).json(response);
};
