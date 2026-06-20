import { Request, Response, NextFunction } from 'express';
import {
  getAllAmbulancesService,
  getAvailableAmbulancesService,
  updateAmbulanceStatusService,
  updateAmbulanceLocationService,
  getAmbulanceByDriverIdService,
} from './ambulance.service';
import { getIo } from '../../sockets/socket';
import { getParam } from '../../utils/helpers';

export const getAllAmbulances = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ambulances = await getAllAmbulancesService();
    res.json({ success: true, data: ambulances });
  } catch (err) {
    next(err);
  }
};

export const getAvailableAmbulances = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ambulances = await getAvailableAmbulancesService();
    res.json({ success: true, data: ambulances });
  } catch (err) {
    next(err);
  }
};

export const updateAmbulanceStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.body;
    const ambulance = await updateAmbulanceStatusService(getParam(req.params.id), status);
    res.json({ success: true, data: ambulance });
  } catch (err) {
    next(err);
  }
};

export const updateDriverLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { latitude, longitude, assignment_id } = req.body;
    const driver_id = req.user!.id;

    const ambulance = await getAmbulanceByDriverIdService(driver_id);
    if (!ambulance) {
      res.status(404).json({ success: false, error: 'No ambulance assigned to this driver' });
      return;
    }

    const updated = await updateAmbulanceLocationService(
      ambulance.id,
      latitude,
      longitude
    );

    // Broadcast live location update to patient tracking room
    if (assignment_id) {
      const io = getIo();
      io.to(`assignment:${assignment_id}`).emit('driver:location_update', {
        ambulance_id: ambulance.id,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const getMyAmbulance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ambulance = await getAmbulanceByDriverIdService(req.user!.id);
    res.json({ success: true, data: ambulance });
  } catch (err) {
    next(err);
  }
};
