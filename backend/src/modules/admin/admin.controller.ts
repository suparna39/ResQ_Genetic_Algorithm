import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/errorHandler';

export const getAdminMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [requestsRes, ambulancesRes, assignmentsRes] = await Promise.all([
      supabaseAdmin.from('emergency_requests').select('status, priority', { count: 'exact' }),
      supabaseAdmin.from('ambulances').select('status', { count: 'exact' }),
      supabaseAdmin.from('assignments').select('eta', { count: 'exact' }),
    ]);

    if (requestsRes.error) throw new AppError(requestsRes.error.message, 500);
    if (ambulancesRes.error) throw new AppError(ambulancesRes.error.message, 500);
    if (assignmentsRes.error) throw new AppError(assignmentsRes.error.message, 500);

    const requests = requestsRes.data || [];
    const ambulances = ambulancesRes.data || [];
    const assignments = assignmentsRes.data || [];

    const totalRequests = requests.length;
    const pendingRequests = requests.filter((r) => r.status === 'pending').length;
    const activeRequests = requests.filter((r) =>
      ['assigned', 'accepted', 'en_route', 'picked_up'].includes(r.status)
    ).length;
    const completedRequests = requests.filter((r) => r.status === 'completed').length;
    const criticalRequests = requests.filter((r) => r.priority === 'critical').length;

    const availableAmbulances = ambulances.filter((a) => a.status === 'available').length;
    const busyAmbulances = ambulances.filter((a) => a.status === 'busy').length;
    const offlineAmbulances = ambulances.filter((a) => a.status === 'offline').length;

    const avgEta =
      assignments.length > 0
        ? Math.round(
            assignments.reduce((sum, a) => sum + (a.eta || 0), 0) / assignments.length
          )
        : 0;

    res.json({
      success: true,
      data: {
        requests: {
          total: totalRequests,
          pending: pendingRequests,
          active: activeRequests,
          completed: completedRequests,
          critical: criticalRequests,
        },
        ambulances: {
          total: ambulances.length,
          available: availableAmbulances,
          busy: busyAmbulances,
          offline: offlineAmbulances,
        },
        assignments: {
          total: assignments.length,
          average_eta_minutes: avgEta,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getRecentRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const { data, error } = await supabaseAdmin
      .from('emergency_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
