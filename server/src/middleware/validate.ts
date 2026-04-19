import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.reduce((acc, err) => {
          const path = err.path.join('.');
          acc[path] = err.message;
          return acc;
        }, {} as Record<string, string>);

        console.error('[Validation Error]', source, 'data:', JSON.stringify(req[source]), 'errors:', details);
        next(new ValidationError('请求参数验证失败', details));
      } else {
        next(error);
      }
    }
  };
};

export const validateMultiple = (schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const errors: Record<string, string> = {};

      for (const [source, schema] of Object.entries(schemas)) {
        if (schema) {
          try {
            const data = schema.parse(req[source as keyof typeof schemas]);
            (req as unknown as Record<string, unknown>)[source] = data;
          } catch (error) {
            if (error instanceof ZodError) {
              error.errors.forEach((err) => {
                const path = `${source}.${err.path.join('.')}`;
                errors[path] = err.message;
              });
            }
          }
        }
      }

      if (Object.keys(errors).length > 0) {
        console.error('[Validation Error Multiple]', 'body:', JSON.stringify(req.body), 'params:', JSON.stringify(req.params), 'errors:', errors);
        next(new ValidationError('请求参数验证失败', errors));
      } else {
        next();
      }
    } catch (error) {
      next(error);
    }
  };
};
