import { Request, Response, NextFunction } from 'express';
import {
  createEmergencyService,
  getEmergencyByIdService,
  getAssignmentByRequestIdService,
  getAllEmergenciesService,
  getPatientEmergenciesService,
  updateEmergencyStatusService,
} from './emergency.service';
import { triggerAllocationService } from '../assignment/assignment.service';
import { ApiResponse } from '../../types';
import { getParam } from '../../utils/helpers';

export const createEmergency = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { emergency_type, description, latitude, longitude } = req.body;
    const patient_id = req.user!.id;

    // 1. Create the request in DB
    const request = await createEmergencyService({
      patient_id,
      emergency_type,
      description,
      latitude,
      longitude,
    });

    // 2. Trigger AI + GA allocation asynchronously (don't block response)
    triggerAllocationService(request).catch((err) => {
      console.error('Allocation pipeline error:', err.message);
    });

    const response: ApiResponse = {
      success: true,
      data: request,
      message: 'Emergency request created. Allocating ambulance...',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
};

export const getEmergencyById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const request = await getEmergencyByIdService(getParam(req.params.id));
    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
};

export const getAssignmentForRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const assignment = await getAssignmentByRequestIdService(getParam(req.params.id));
    res.json({ success: true, data: assignment }); // data is null if not yet assigned
  } catch (err) {
    next(err);
  }
};

export const getAllEmergencies = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requests = await getAllEmergenciesService();
    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
};

export const getMyEmergencies = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requests = await getPatientEmergenciesService(req.user!.id);
    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
};

export const updateEmergencyStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, priority } = req.body;
    const request = await updateEmergencyStatusService(
      getParam(req.params.id),
      status,
      priority
    );
    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
};
