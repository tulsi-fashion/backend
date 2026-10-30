import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

export const requestIdMiddleware = (req: any, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id']?.toString() || uuidv4();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};
