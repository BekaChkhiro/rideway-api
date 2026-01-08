import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

type ValidationTarget = 'body' | 'params' | 'query';

export const validate = (schema: z.ZodSchema, target: ValidationTarget = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await schema.parseAsync(req[target]);
      // Only assign to mutable targets (body and params can be modified, query is read-only)
      if (target === 'body') {
        req.body = data;
      } else if (target === 'params') {
        Object.assign(req.params, data);
      }
      // For query, we just validate but don't reassign since it's read-only
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'არასწორი მონაცემები',
            details: { errors: error.issues },
          },
        });
        return;
      }
      next(error);
    }
  };
};
