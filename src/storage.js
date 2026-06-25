export const STORAGE_KEY = 'home-health-pt-scheduler-v3';
export const LEGACY_STORAGE_KEY = 'home-health-pt-scheduler-v2';
export const THERAPISTS_KEY = 'home-health-pt-therapists-v1';
export const SESSION_KEY = 'home-health-pt-session-v1';

export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const VISIT_STATUSES = ['scheduled', 'completed', 'missed', 'cancelled'];

export const initialTherapists = [
  { id: 't-admin', name: 'Admin User', phone: '(555) 010-0000', email: 'admin@pt.local', role: 'admin', active: true },
  { id: 't-amy', name: 'Amy Nguyen, PT', phone: '(555) 011-1111', email: 'amy@pt.local', role: 'therapist', active: true },
  { id: 't-ben', name: 'Ben Patel, PTA', phone: '(555) 012-2222', email: 'ben@pt.local', role: 'therapist', active: true },
];

export const initialPatients = [
  {
    id: 'p-101',
    name: 'Maria Lopez',
    area: 'North Valley',
    address: '1128 Cedar Ave, North Valley',
    phone: '(555) 013-4451',
    agency: 'Sunrise Home Health',
    therapistId: 't-amy',
    visitsRemaining: 8,
    frequency: '2x/week',
    preferredDays: ['Monday', 'Thursday'],
    preferredTimes: 'Morning',
    authExpiration: '2026-07-31',
    notes: 'Prefers morning visits. Has two steps at entry.',
    schedule: [
      { id: 'v-101-a', day: 'Monday', time: '09:00', status: 'scheduled', therapistId: 't-amy', completedBy: '' },
      { id: 'v-101-b', day: 'Thursday', time: '10:30', status: 'scheduled', therapistId: 't-amy', completedBy: '' },
    ],
  },
  {
    id: 'p-102',
    name: 'James Carter',
    area: 'Eastside',
    address: '44 Oak Bend Rd, Eastside',
    phone: '(555) 018-2240',
    agency: 'CareBridge Agency',
    therapistId: 't-ben',
    visitsRemaining: 4,
    frequency: '1x/week',
    preferredDays: ['Wednesday'],
    preferredTimes: 'Afternoon',
    authExpiration: '2026-07-12',
    notes: 'Call daughter before arrival.',
    schedule: [{ id: 'v-102-a', day: 'Wednesday', time: '13:00', status: 'scheduled', therapistId: 't-ben', completedBy: '' }],
  },
];

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function normalizeSchedule(schedule = [], patient = {}) {
  return schedule.map((visit) => {
    if (typeof visit === 'string') {
      const [day = 'Monday', ...rest] = visit.split(' ');
      return { id: makeId('v'), day, time: rest.join(' ') || '', status: 'scheduled', therapistId: patient.therapistId || '', completedBy: '' };
    }
    return {
      id: visit.id || makeId('v'),
      day: visit.day || 'Monday',
      time: visit.time || '',
      status: VISIT_STATUSES.includes(visit.status) ? visit.status : 'scheduled',
      therapistId: visit.therapistId || patient.therapistId || '',
      completedBy: visit.completedBy || '',
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
    visitsRemaining: 0,
    frequency: '1x/week',
    preferredDays: [],
    preferredTimes: '',
    authExpiration: '',
    schedule: [],
    ...patient,
    visitsRemaining: Number(patient.visitsRemaining || 0),
    preferredDays: Array.isArray(patient.preferredDays) ? patient.preferredDays : [],
  };
  normalized.schedule = normalizeSchedule(patient.schedule, normalized);
  return normalized;
}

export function normalizeTherapist(therapist) {
  return { phone: '', email: '', role: 'therapist', active: true, ...therapist, active: therapist.active !== false };
}

export function loadPatients(storage = globalThis.localStorage) {
  if (!storage) return initialPatients.map(normalizePatient);
  try {
    const raw = storage.getItem(STORAGE_KEY) || storage.getItem(LEGACY_STORAGE_KEY) || storage.getItem('home-health-pt-scheduler-v1');
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
