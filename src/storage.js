export const STORAGE_KEY = 'home-health-pt-scheduler-v4';
export const VISIT_LOGS_KEY = 'home-health-pt-visit-logs-v1';
export const LEGACY_STORAGE_KEY = 'home-health-pt-scheduler-v3';
export const OLDER_STORAGE_KEYS = ['home-health-pt-scheduler-v2', 'home-health-pt-scheduler-v1'];
export const THERAPISTS_KEY = 'home-health-pt-therapists-v1';
export const SESSION_KEY = 'home-health-pt-session-v1';

export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const VISIT_STATUSES = ['scheduled', 'done', 'missed', 'cancelled', 'rescheduled'];
export const VISIT_STATUS_LABELS = { scheduled: 'Scheduled', done: 'Done', missed: 'Missed', cancelled: 'Cancelled', rescheduled: 'Rescheduled' };
export const LOW_VISIT_WARNING_THRESHOLD = 2;

export const initialTherapists = [
  { id: 't-admin', name: 'Admin User', phone: '(555) 010-0000', email: 'admin@pt.local', role: 'admin', active: true, serviceAreas: ['All'], availability: 'Weekdays' },
  { id: 't-amy', name: 'Amy Nguyen, PT', phone: '(555) 011-1111', email: 'amy@pt.local', role: 'PT', active: true, serviceAreas: ['North Valley'], availability: 'Mon-Fri mornings' },
  { id: 't-ben', name: 'Ben Patel, PTA', phone: '(555) 012-2222', email: 'ben@pt.local', role: 'PTA', active: true, serviceAreas: ['Eastside'], availability: 'Mon-Thu afternoons' },
];

export const initialPatients = [
  {
    id: 'p-101',
    name: 'Maria Lopez',
    area: 'North Valley',
    address: '1128 Cedar Ave, North Valley',
    phone: '(555) 013-4451',
    agency: 'Sunrise Home Health',
    status: 'Active',
    approvedVisits: 12,
    usedVisits: 4,
    therapistId: 't-amy',
    visitsRemaining: 8,
    frequency: '2x/week',
    preferredDays: ['Monday', 'Thursday'],
    preferredTimes: 'Morning',
    authExpiration: '2026-07-31',
    notes: 'Prefers morning visits. Has two steps at entry.',
    schedule: [
      { id: 'v-101-a', day: 'Monday', time: '09:00', status: 'scheduled', therapistId: 't-amy', completedBy: '', completedAt: '', note: '' },
      { id: 'v-101-b', day: 'Thursday', time: '10:30', status: 'scheduled', therapistId: 't-amy', completedBy: '', completedAt: '', note: '' },
    ],
  },
  {
    id: 'p-102',
    name: 'James Carter',
    area: 'Eastside',
    address: '44 Oak Bend Rd, Eastside',
    phone: '(555) 018-2240',
    agency: 'CareBridge Agency',
    status: 'Authorization pending',
    approvedVisits: 8,
    usedVisits: 4,
    therapistId: 't-ben',
    visitsRemaining: 4,
    frequency: '1x/week',
    preferredDays: ['Wednesday'],
    preferredTimes: 'Afternoon',
    authExpiration: '2026-07-12',
    notes: 'Call daughter before arrival.',
    schedule: [{ id: 'v-102-a', day: 'Wednesday', time: '13:00', status: 'scheduled', therapistId: 't-ben', completedBy: '', completedAt: '', note: '' }],
  },
];

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function normalizeVisitStatus(status = 'scheduled') {
  if (status === 'completed') return 'done';
  return VISIT_STATUSES.includes(status) ? status : 'scheduled';
}

export function formatDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getVisitDateForDay(day, today = new Date()) {
  const targetIndex = WEEK_DAYS.indexOf(day);
  if (targetIndex < 0) return formatDateKey(today);
  const mondayBasedToday = (today.getDay() + 6) % 7;
  const date = new Date(today);
  date.setHours(12, 0, 0, 0);
  let delta = targetIndex - mondayBasedToday;
  if (delta < 0) delta += 7;
  date.setDate(date.getDate() + delta);
  return formatDateKey(date);
}

export function normalizeSchedule(schedule = [], patient = {}) {
  return schedule.map((visit) => {
    if (typeof visit === 'string') {
      const [day = 'Monday', ...rest] = visit.split(' ');
      return { id: makeId('v'), day, time: rest.join(' ') || '', status: 'scheduled', therapistId: patient.therapistId || '', completedBy: '', completedAt: '', note: '' };
    }
    return {
      id: visit.id || makeId('v'),
      day: visit.day || 'Monday',
      time: visit.time || '',
      status: normalizeVisitStatus(visit.status),
      therapistId: visit.therapistId || patient.therapistId || '',
      completedBy: visit.completedBy || '',
      completedAt: visit.completedAt || '',
      note: visit.note || '',
    };
  });
}

export function normalizePatient(patient) {
  const normalized = {
    agency: '',
    area: '',
    notes: '',
    phone: '',
    therapistId: '',
    status: 'Active',
    approvedVisits: 0,
    usedVisits: 0,
    visitsRemaining: 0,
    frequency: '1x/week',
    preferredDays: [],
    preferredTimes: '',
    authExpiration: '',
    schedule: [],
    ...patient,
    approvedVisits: Number(patient.approvedVisits || patient.approved || 0),
    usedVisits: Number(patient.usedVisits || 0),
    visitsRemaining: Number(patient.visitsRemaining ?? patient.remainingVisits ?? 0),
    preferredDays: Array.isArray(patient.preferredDays) ? patient.preferredDays : [],
  };
  normalized.schedule = normalizeSchedule(patient.schedule, normalized);
  return normalized;
}

export function normalizeTherapist(therapist) {
  return { phone: '', email: '', role: 'PT', active: true, serviceAreas: [], availability: '', ...therapist, active: therapist.active !== false, serviceAreas: Array.isArray(therapist.serviceAreas) ? therapist.serviceAreas : String(therapist.serviceAreas || '').split(',').map((area) => area.trim()).filter(Boolean) };
}

export function loadPatients(storage = globalThis.localStorage) {
  if (!storage) return initialPatients.map(normalizePatient);
  try {
    const raw = storage.getItem(STORAGE_KEY) || storage.getItem(LEGACY_STORAGE_KEY) || OLDER_STORAGE_KEYS.map((key) => storage.getItem(key)).find(Boolean);
    const parsed = raw ? JSON.parse(raw) : initialPatients;
    return Array.isArray(parsed) ? parsed.map(normalizePatient) : initialPatients.map(normalizePatient);
  } catch {
    return initialPatients.map(normalizePatient);
  }
}

export function savePatients(patients, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(patients.map(normalizePatient)));
}

export function loadTherapists(storage = globalThis.localStorage) {
  if (!storage) return initialTherapists.map(normalizeTherapist);
  try {
    const parsed = JSON.parse(storage.getItem(THERAPISTS_KEY) || 'null') || initialTherapists;
    return Array.isArray(parsed) ? parsed.map(normalizeTherapist) : initialTherapists.map(normalizeTherapist);
  } catch {
    return initialTherapists.map(normalizeTherapist);
  }
}

export function saveTherapists(therapists, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(THERAPISTS_KEY, JSON.stringify(therapists.map(normalizeTherapist)));
}

export function loadSession(storage = globalThis.localStorage) {
  if (!storage) return 't-admin';
  return storage.getItem(SESSION_KEY) || 't-admin';
}

export function saveSession(userId, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(SESSION_KEY, userId);
}

export function groupPatientsByArea(patients) {
  return patients.reduce((groups, patient) => {
    const area = patient.area?.trim() || 'Unassigned';
    groups[area] = groups[area] || [];
    groups[area].push(patient);
    return groups;
  }, {});
}

export function getAuthorizationStatus(patient, today = new Date()) {
  if (!patient.authExpiration) return { label: 'No auth date', level: 'neutral', days: null };
  const expiry = new Date(`${patient.authExpiration}T23:59:59`);
  const days = Math.ceil((expiry - today) / 86_400_000);
  if (days < 0) return { label: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`, level: 'danger', days };
  if (days <= 14) return { label: `Expires in ${days} day${days === 1 ? '' : 's'}`, level: 'warning', days };
  return { label: `Auth ${patient.authExpiration}`, level: 'good', days };
}

export function canSeePatient(user, patient) {
  return user?.role === 'admin' || patient.therapistId === user?.id;
}

export function getVisiblePatients(patients, user) {
  return patients.filter((patient) => canSeePatient(user, patient));
}

export function getTodaysVisits(patients, today = new Date()) {
  const day = WEEK_DAYS[(today.getDay() + 6) % 7];
  return patients.flatMap((patient) => normalizeSchedule(patient.schedule, patient)
    .filter((visit) => visit.day === day)
    .map((visit) => ({ ...visit, patient })));
}

export function getWeeklySchedule(patients) {
  return WEEK_DAYS.reduce((schedule, day) => {
    schedule[day] = patients.flatMap((patient) => normalizeSchedule(patient.schedule, patient)
      .filter((visit) => visit.day === day)
      .map((visit) => ({ ...visit, patient })))
      .sort((a, b) => `${a.therapistId}-${a.time || ''}`.localeCompare(`${b.therapistId}-${b.time || ''}`));
    return schedule;
  }, {});
}

export function getFrequencyCount(frequency = '') {
  const match = String(frequency).match(/(\d+)x/i);
  return match ? Number(match[1]) : 1;
}

function preferredTimeSlots(preferredTimes = '') {
  const text = preferredTimes.toLowerCase();
  if (text.includes('morning')) return ['09:00', '10:00', '11:00'];
  if (text.includes('afternoon')) return ['13:00', '14:00', '15:00'];
  if (text.includes('evening')) return ['16:00', '17:00'];
  return ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'];
}

export function buildScheduleSuggestions(patient, patients, therapists) {
  if (!patient?.id || !patient.therapistId) return [];
  const activeTherapist = therapists.find((therapist) => therapist.id === patient.therapistId && therapist.active);
  if (!activeTherapist) return [];

  const weeklyTarget = Math.min(Number(patient.visitsRemaining || 0), getFrequencyCount(patient.frequency));
  const scheduledVisits = normalizeSchedule(patient.schedule, patient).filter((visit) => visit.status === 'scheduled');
  const needed = Math.max(1, weeklyTarget - scheduledVisits.length);
  const preferredDays = patient.preferredDays?.length ? patient.preferredDays : WEEK_DAYS;
  const times = preferredTimeSlots(patient.preferredTimes);
  const area = String(patient.area || '').trim().toLowerCase();
  const options = [];

  WEEK_DAYS.forEach((day) => {
    times.forEach((time) => {
      const sameDay = patients.flatMap((candidate) => normalizeSchedule(candidate.schedule, candidate)
        .filter((visit) => visit.day === day && visit.status !== 'cancelled')
        .map((visit) => ({ visit, patient: candidate })));
      const therapistVisits = sameDay.filter((item) => item.visit.therapistId === patient.therapistId);
      const nearby = therapistVisits.filter((item) => String(item.patient.area || '').trim().toLowerCase() === area && item.patient.id !== patient.id).length;
      const exactBusy = therapistVisits.some((item) => item.visit.time === time);
      const alreadyScheduledThatDay = scheduledVisits.some((visit) => visit.day === day);
      const preferredDay = preferredDays.includes(day);
      const score = (nearby * 35) + (preferredDay ? 18 : -8) - (therapistVisits.length * 5) - (exactBusy ? 80 : 0) - (alreadyScheduledThatDay ? 45 : 0);
      const reasons = [
        preferredDay ? 'matches preferred day' : 'outside preferred days',
        `${nearby} nearby ${area || 'area'} visit${nearby === 1 ? '' : 's'}`,
        `${therapistVisits.length} existing ${activeTherapist.name} visit${therapistVisits.length === 1 ? '' : 's'} that day`,
        `${needed} weekly visit${needed === 1 ? '' : 's'} still needed`,
      ];
      if (exactBusy) reasons.push('therapist is already busy at that time');
      options.push({ day, time, therapistId: patient.therapistId, score, reason: reasons.join(' · ') });
    });
  });

  return options.sort((a, b) => b.score - a.score || a.day.localeCompare(b.day) || a.time.localeCompare(b.time)).slice(0, Math.max(3, needed));
}


export function normalizeVisitLog(log = {}) {
  return {
    id: log.id || makeId('log'),
    patientId: log.patientId || '',
    patientName: log.patientName || '',
    therapistId: log.therapistId || '',
    therapistName: log.therapistName || '',
    visitId: log.visitId || '',
    date: log.date || formatDateKey(new Date()),
    scheduledDay: log.scheduledDay || '',
    scheduledTime: log.scheduledTime || '',
    completedTime: log.completedTime || log.timeCompleted || '',
    status: normalizeVisitStatus(log.status || 'done'),
    note: log.note || '',
    source: log.source || 'localStorage',
  };
}

export function loadVisitLogs(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(VISIT_LOGS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeVisitLog) : [];
  } catch {
    return [];
  }
}

export function saveVisitLogs(logs, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(VISIT_LOGS_KEY, JSON.stringify(logs.map(normalizeVisitLog)));
}

export function createVisitLog({ patient, visit, therapist, status = 'done', note = '', completedAt = new Date(), today = new Date() }) {
  const completedTime = completedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return normalizeVisitLog({
    id: makeId('log'),
    patientId: patient.id,
    patientName: patient.name,
    therapistId: therapist.id,
    therapistName: therapist.name,
    visitId: visit.id,
    date: formatDateKey(today),
    scheduledDay: visit.day,
    scheduledTime: visit.time || '',
    completedTime,
    status,
    note,
    source: 'localStorage',
  });
}

export function upsertVisitLog(logs, nextLog) {
  const normalized = normalizeVisitLog(nextLog);
  const index = logs.findIndex((log) => log.visitId === normalized.visitId && log.date === normalized.date);
  if (index === -1) return [...logs, normalized];
  return logs.map((log, currentIndex) => (currentIndex === index ? { ...log, ...normalized, id: log.id } : log));
}

export function getVisitLogHistory(patient, logs = []) {
  return logs.filter((log) => log.patientId === patient.id).sort((a, b) => `${b.date} ${b.completedTime}`.localeCompare(`${a.date} ${a.completedTime}`));
}

export function getLastSeenDate(patient, logs = []) {
  return getVisitLogHistory(patient, logs).find((log) => log.status === 'done')?.date || '';
}

export function getNextScheduledVisit(patient, today = new Date()) {
  return normalizeSchedule(patient.schedule, patient)
    .filter((visit) => visit.status === 'scheduled' || visit.status === 'rescheduled')
    .map((visit) => ({ ...visit, date: getVisitDateForDay(visit.day, today) }))
    .filter((visit) => visit.date >= formatDateKey(today))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0] || null;
}

export function getAdminVisitSummary(patients, logs = [], today = new Date()) {
  const todayKey = formatDateKey(today);
  const todayVisits = getTodaysVisits(patients, today);
  const completedToday = todayVisits.filter((visit) => visit.status === 'done').length + logs.filter((log) => log.date === todayKey && log.status === 'done' && !todayVisits.some((visit) => visit.id === log.visitId)).length;
  const notCompletedToday = todayVisits.filter((visit) => visit.status !== 'done').length;
  return {
    completedToday,
    notCompletedToday,
    missed: todayVisits.filter((visit) => visit.status === 'missed').length,
    cancelled: todayVisits.filter((visit) => visit.status === 'cancelled').length,
    overduePatients: getNeedsToBeSeenPatients(patients, logs, today).filter((item) => item.reasons.some((reason) => reason.includes('Overdue'))).length,
  };
}

export function getNeedsToBeSeenPatients(patients, logs = [], today = new Date()) {
  const todayVisits = getTodaysVisits(patients, today);
  const todayPatientIds = new Set(todayVisits.filter((visit) => visit.status !== 'done').map((visit) => visit.patient.id));
  const todayKey = formatDateKey(today);
  return patients.map((patient) => {
    const reasons = [];
    if (todayPatientIds.has(patient.id)) reasons.push('Scheduled today but not Done');
    const lastSeen = getLastSeenDate(patient, logs);
    const maxDays = Math.ceil(7 / Math.max(1, getFrequencyCount(patient.frequency)));
    if (Number(patient.visitsRemaining || 0) > 0) {
      if (!lastSeen) reasons.push('Overdue: no completed visit logged');
      else {
        const daysSince = Math.floor((new Date(`${todayKey}T12:00:00`) - new Date(`${lastSeen}T12:00:00`)) / 86_400_000);
        if (daysSince > maxDays) reasons.push(`Overdue: last seen ${daysSince} days ago`);
      }
      if (!getNextScheduledVisit(patient, today)) reasons.push('Remaining visits but no upcoming schedule');
    }
    return { patient, reasons, lastSeen, nextScheduled: getNextScheduledVisit(patient, today) };
  }).filter((item) => item.reasons.length > 0);
}

export function filterVisits(patients, filters = {}, logs = [], today = new Date()) {
  const allVisits = patients.flatMap((patient) => normalizeSchedule(patient.schedule, patient).map((visit) => ({ ...visit, patient, date: getVisitDateForDay(visit.day, today) })));
  return allVisits.filter((visit) => {
    if (filters.therapistId && visit.therapistId !== filters.therapistId) return false;
    if (filters.patientId && visit.patient.id !== filters.patientId) return false;
    if (filters.status && visit.status !== filters.status) return false;
    if (filters.date && visit.date !== filters.date) return false;
    return true;
  });
}


export function getTherapistProductivity(patients, therapists, logs = [], today = new Date()) {
  const todayKey = formatDateKey(today);
  const weekVisits = patients.flatMap((patient) => normalizeSchedule(patient.schedule, patient).map((visit) => ({ ...visit, patient })));
  return therapists.map((therapist) => ({
    therapist,
    completedToday: logs.filter((log) => log.therapistId === therapist.id && log.status === 'done' && log.date === todayKey).length + weekVisits.filter((visit) => visit.therapistId === therapist.id && visit.status === 'done' && getVisitDateForDay(visit.day, today) === todayKey).length,
    completedThisWeek: logs.filter((log) => log.therapistId === therapist.id && log.status === 'done').length + weekVisits.filter((visit) => visit.therapistId === therapist.id && visit.status === 'done').length,
    missed: weekVisits.filter((visit) => visit.therapistId === therapist.id && visit.status === 'missed').length,
    pending: weekVisits.filter((visit) => visit.therapistId === therapist.id && visit.status === 'scheduled').length,
    patientsAssigned: patients.filter((patient) => patient.therapistId === therapist.id).length,
  }));
}

export function buildReports(patients, therapists, logs = [], today = new Date()) {
  const allVisits = patients.flatMap((patient) => normalizeSchedule(patient.schedule, patient).map((visit) => ({ ...visit, patient, date: getVisitDateForDay(visit.day, today) })));
  const productivity = getTherapistProductivity(patients, therapists, logs, today);
  return {
    productivity,
    pendingVisits: allVisits.filter((visit) => visit.status === 'scheduled'),
    patientsNotSeenThisWeek: patients.filter((patient) => !logs.some((log) => log.patientId === patient.id && log.status === 'done')),
    overdue: getNeedsToBeSeenPatients(patients, logs, today),
    lowAuthorization: patients.filter((patient) => Number(patient.visitsRemaining || 0) <= LOW_VISIT_WARNING_THRESHOLD),
    expiringAuthorization: patients.filter((patient) => { const status = getAuthorizationStatus(patient, today); return status.days !== null && status.days <= 14; }),
    weeklyVisitTotal: allVisits.length,
  };
}
