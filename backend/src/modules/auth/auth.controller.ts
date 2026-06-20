import { Request, Response } from 'express';
import { ApiResponse } from '../../types';

export const getMeController = (req: Request, res: Response): void => {
  const response: ApiResponse = {
    success: true,
    data: req.user,
  };
  res.json(response);
};
