import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiResponse } from '../types';

export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = (result.error as ZodError).issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      const response: ApiResponse = {
        success: false,
        error: 'Validation failed',
        data: errors,
      };
      res.status(400).json(response);
      return;
    }
    req.body = result.data;
    next();
  };
