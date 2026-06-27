import { normalizePatient, normalizeTherapist, normalizeSchedule } from './storage.js';

const config = globalThis.PT_APP_CONFIG || {};
const url = config.supabaseUrl || '';
const anonKey = config.supabaseAnonKey || '';
export const isSupabaseConfigured = Boolean(url && anonKey && globalThis.supabase?.createClient);
export const supabaseClient = isSupabaseConfigured ? globalThis.supabase.createClient(url, anonKey) : null;

const toCamel = (row = {}) => ({
  ...row,
  therapistId: row.therapist_id ?? row.therapistId,
  approvedVisits: row.approved_visits ?? row.approvedVisits,
  usedVisits: row.used_visits ?? row.usedVisits,
  visitsRemaining: row.visits_remaining ?? row.visitsRemaining,
  preferredDays: row.preferred_days ?? row.preferredDays,
  preferredTimes: row.preferred_times ?? row.preferredTimes,
  authExpiration: row.auth_expiration ?? row.authExpiration,
  serviceAreas: row.service_areas ?? row.serviceAreas,
});

const patientToRow = (patient) => ({
  id: patient.id, name: patient.name, area: patient.area, address: patient.address, phone: patient.phone,
  agency: patient.agency, status: patient.status, approved_visits: patient.approvedVisits, used_visits: patient.usedVisits,
  visits_remaining: patient.visitsRemaining, frequency: patient.frequency, preferred_days: patient.preferredDays,
  preferred_times: patient.preferredTimes, auth_expiration: patient.authExpiration || null, notes: patient.notes,
  therapist_id: patient.therapistId || null,
});

const therapistToRows = (therapist) => ({
  therapist: { id: therapist.id, phone: therapist.phone, availability: therapist.availability, service_areas: therapist.serviceAreas, active: therapist.active },
  profile: { id: therapist.id, full_name: therapist.name, email: therapist.email, role: therapist.role === 'admin' ? 'admin' : 'therapist' },
});

const visitLogToRows = (log) => ({
  id: log.id,
  patient_id: log.patientId || log.patient_id,
  patient_name: log.patientName || log.patient_name,
  therapist_id: log.therapistId || log.therapist_id,
  therapist_name: log.therapistName || log.therapist_name,
  visit_id: log.visitId || log.visit_id || null,
  date: log.date,
  scheduled_day: log.scheduledDay || log.scheduled_day || null,
  scheduled_time: log.scheduledTime || log.scheduled_time || null,
  completed_time: log.completedTime || log.completed_time || null,
  status: log.status || 'done',
  note: log.note || '',
});

export async function getSession() { return (await supabaseClient.auth.getSession()).data.session; }
export async function signIn(email, password) { const { error } = await supabaseClient.auth.signInWithPassword({ email, password }); if (error) throw error; }
export async function signUp(email, password, fullName) { const { error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: fullName } } }); if (error) throw error; }
export async function signOut() { const { error } = await supabaseClient.auth.signOut(); if (error) throw error; }

export async function loadSharedData() {
  const [{ data: profiles, error: profileError }, { data: therapistRows, error: therapistError }, { data: patientRows, error: patientError }, { data: appointments, error: appointmentError }, { data: logs, error: logError }] = await Promise.all([
    supabaseClient.from('profiles').select('*'),
    supabaseClient.from('therapists').select('*'),
    supabaseClient.from('patients').select('*'),
    supabaseClient.from('appointments').select('*'),
    supabaseClient.from('visit_logs').select('*').order('date', { ascending: false }),
  ]);
  const error = profileError || therapistError || patientError || appointmentError || logError;
  if (error) throw error;
  const profileById = new Map((profiles || []).map((p) => [p.id, p]));
  const therapists = (therapistRows || []).map((row) => {
    const profile = profileById.get(row.id) || {};
    return normalizeTherapist(toCamel({ ...row, name: profile.full_name || profile.email || 'Therapist', email: profile.email, role: profile.role || 'therapist' }));
  });
  const appointmentsByPatient = new Map();
  (appointments || []).forEach((row) => {
    const visit = { id: row.id, day: row.day, time: row.time || '', status: row.status, therapistId: row.therapist_id || '', completedBy: row.completed_by || '', completedAt: row.completed_at || '', note: row.note || '' };
    appointmentsByPatient.set(row.patient_id, [...(appointmentsByPatient.get(row.patient_id) || []), visit]);
  });
  const patients = (patientRows || []).map((row) => normalizePatient({ ...toCamel(row), schedule: normalizeSchedule(appointmentsByPatient.get(row.id) || [], toCamel(row)) }));
  return { therapists, patients, visitLogs: (logs || []).map(toCamel) };
}

export async function savePatientShared(patient) {
  const { error } = await supabaseClient.from('patients').upsert(patientToRow(patient)); if (error) throw error;
  const rows = normalizeSchedule(patient.schedule, patient).map((visit) => ({ id: visit.id, patient_id: patient.id, therapist_id: visit.therapistId || patient.therapistId || null, day: visit.day, time: visit.time || null, status: visit.status, completed_by: visit.completedBy || null, completed_at: visit.completedAt || null, note: visit.note || '' }));
  await supabaseClient.from('appointments').delete().eq('patient_id', patient.id);
  if (rows.length) { const { error: appointmentError } = await supabaseClient.from('appointments').upsert(rows); if (appointmentError) throw appointmentError; }
}
export async function deletePatientShared(patientId) { const { error } = await supabaseClient.from('patients').delete().eq('id', patientId); if (error) throw error; }
export async function saveTherapistShared(therapist) { const rows = therapistToRows(therapist); let res = await supabaseClient.from('profiles').upsert(rows.profile); if (res.error) throw res.error; res = await supabaseClient.from('therapists').upsert(rows.therapist); if (res.error) throw res.error; }
export async function deleteTherapistShared(id) { const { error } = await supabaseClient.from('therapists').delete().eq('id', id); if (error) throw error; }
export async function saveVisitLogShared(log) {
  const row = visitLogToRows(log);
  const { error } = await supabaseClient.from('visit_logs').upsert(row); if (error) throw error;
  const { error: historyError } = await supabaseClient.from('visit_history').upsert({ ...row, visit_log_id: row.id }); if (historyError) throw historyError;
}
export async function savePatientImportShared(importBatch) {
  const { error } = await supabaseClient.from('uploaded_patient_imports').insert({
    file_name: importBatch.fileName,
    imported_by: importBatch.importedBy,
    row_count: importBatch.rowCount,
    imported_count: importBatch.importedCount,
    error_count: importBatch.errorCount,
    raw_rows: importBatch.rows,
  });
  if (error) throw error;
}
