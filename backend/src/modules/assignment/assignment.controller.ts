import { Request, Response, NextFunction } from 'express';
import {
  getAssignmentByIdService,
  getAllAssignmentsService,
  getMyAssignmentsService,
  acceptAssignmentService,
  enRouteAssignmentService,
  pickupAssignmentService,
  completeAssignmentService,
} from './assignment.service';
import { getIo } from '../../sockets/socket';
import { getParam } from '../../utils/helpers';

export const getAssignmentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const assignment = await getAssignmentByIdService(getParam(req.params.id));
    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};

export const getAllAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const assignments = await getAllAssignmentsService();
    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
};

export const getMyAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const driverId = req.user!.id;
    const assignments = await getMyAssignmentsService(driverId);
    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
};

export const acceptAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const assignment = await acceptAssignmentService(getParam(req.params.id));

    // Broadcast to assignment room (patient room notified inside the service)
    const io = getIo();
    io.to(`assignment:${assignment.id}`).emit('request:status_change', {
      status: 'accepted',
      assignment_id: assignment.id,
    });

    // Schedule auto-advance to en_route after 10 seconds.
    // enRouteAssignmentService is a normal top-level import — no dynamic import() hacks.
    const assignmentId = assignment.id;
    setTimeout(() => {
      enRouteAssignmentService(assignmentId).catch((e) =>
        console.error('[en_route auto-transition]', e)
      );
    }, 10_000);

    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};


export const pickupAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const assignment = await pickupAssignmentService(getParam(req.params.id));
    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};

export const completeAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const assignment = await completeAssignmentService(getParam(req.params.id));

    const io = getIo();
    const payload = {
      status: 'completed',
      assignment_id: assignment.id,
    };

    // Notify assignment room (driver + anyone subscribed)
    io.to(`assignment:${assignment.id}`).emit('request:status_change', payload);

    // Also notify patient directly via their personal room
    // (in case they dropped from assignment room — belt-and-suspenders)
    const { supabaseAdmin } = await import('../../config/supabase');
    const { data: asnRow } = await supabaseAdmin
      .from('assignments')
      .select('request_id')
      .eq('id', assignment.id)
      .single();

    if (asnRow?.request_id) {
      const { data: reqRow } = await supabaseAdmin
        .from('emergency_requests')
        .select('patient_id')
        .eq('id', asnRow.request_id)
        .single();

      if (reqRow?.patient_id) {
        io.to(`patient:${reqRow.patient_id}`).emit('request:status_change', {
          ...payload,
          request_id: asnRow.request_id,
        });
      }
    }

    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};

