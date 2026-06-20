import { supabaseAdmin } from '../../config/supabase';
import { Ambulance, AmbulanceStatus } from '../../types';
import { AppError } from '../../middleware/errorHandler';

export const getAllAmbulancesService = async (): Promise<Ambulance[]> => {
  const { data, error } = await supabaseAdmin
    .from('ambulances')
    .select('*')
    .order('last_updated', { ascending: false });

  if (error) throw new AppError(error.message, 500);
  return (data || []) as Ambulance[];
};

export const getAvailableAmbulancesService = async (): Promise<Ambulance[]> => {
  const { data, error } = await supabaseAdmin
    .from('ambulances')
    .select('*')
    .eq('status', 'available');

  if (error) throw new AppError(error.message, 500);
  return (data || []) as Ambulance[];
};

export const updateAmbulanceStatusService = async (
  id: string,
  status: AmbulanceStatus
): Promise<Ambulance> => {
  const { data, error } = await supabaseAdmin
    .from('ambulances')
    .update({ status, last_updated: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);
  return data as Ambulance;
};

export const updateAmbulanceLocationService = async (
  ambulance_id: string,
  latitude: number,
  longitude: number
): Promise<Ambulance> => {
  const { data, error } = await supabaseAdmin
    .from('ambulances')
    .update({
      latitude,
      longitude,
      last_updated: new Date().toISOString(),
    })
    .eq('id', ambulance_id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);
  return data as Ambulance;
};

export const getAmbulanceByDriverIdService = async (
  driver_id: string
): Promise<Ambulance | null> => {
  const { data, error } = await supabaseAdmin
    .from('ambulances')
    .select('*')
    .eq('driver_id', driver_id)
    .single();

  if (error) return null;
  return data as Ambulance;
};
