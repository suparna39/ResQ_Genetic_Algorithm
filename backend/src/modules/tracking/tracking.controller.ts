import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/errorHandler';
import { TrackingLog } from '../../types';
import { getIo } from '../../sockets/socket';

export const updateTracking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { assignment_id, latitude, longitude } = req.body;

    // Insert tracking log
    const { data, error } = await supabaseAdmin
      .from('tracking_logs')
      .insert({ assignment_id, latitude, longitude })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    // Broadcast to everyone in the assignment room
    const io = getIo();
    io.to(`assignment:${assignment_id}`).emit('driver:location_update', {
      assignment_id,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getTrackingHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('tracking_logs')
      .select('*')
      .eq('assignment_id', req.params.assignmentId)
      .order('timestamp', { ascending: true });

    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data as TrackingLog[] });
  } catch (err) {
    next(err);
  }
};
