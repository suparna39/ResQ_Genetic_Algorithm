import { supabaseAdmin } from '../../config/supabase';
import { EmergencyRequest, RequestStatus, Priority } from '../../types';
import { AppError } from '../../middleware/errorHandler';

export const createEmergencyService = async (data: {
  patient_id: string;
  emergency_type: string;
  description: string;
  latitude: number;
  longitude: number;
}): Promise<EmergencyRequest> => {
  const { data: request, error } = await supabaseAdmin
    .from('emergency_requests')
    .insert({
      ...data,
      status: 'pending',
      priority: null,
    })
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);
  return request as EmergencyRequest;
};

export const getEmergencyByIdService = async (
  id: string
): Promise<EmergencyRequest> => {
  const { data, error } = await supabaseAdmin
    .from('emergency_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new AppError('Emergency request not found', 404);
  return data as EmergencyRequest;
};

export const getAssignmentByRequestIdService = async (requestId: string) => {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*, ambulances(*)')
    .eq('request_id', requestId)
    .not('status', 'in', '("completed","cancelled")')
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new AppError(error.message, 500);
  return data; // null if no assignment yet
};

export const getAllEmergenciesService = async (): Promise<EmergencyRequest[]> => {
  const { data, error } = await supabaseAdmin
    .from('emergency_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new AppError(error.message, 500);
  return (data || []) as EmergencyRequest[];
};

export const getPatientEmergenciesService = async (
  patient_id: string
): Promise<EmergencyRequest[]> => {
  const { data, error } = await supabaseAdmin
    .from('emergency_requests')
    .select('*')
    .eq('patient_id', patient_id)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(error.message, 500);
  return (data || []) as EmergencyRequest[];
};

export const updateEmergencyStatusService = async (
  id: string,
  status: RequestStatus,
  priority?: Priority
): Promise<EmergencyRequest> => {
  const updatePayload: Record<string, unknown> = { status };
  if (priority) updatePayload.priority = priority;

  const { data, error } = await supabaseAdmin
    .from('emergency_requests')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);
  return data as EmergencyRequest;
};
