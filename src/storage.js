export const STORAGE_KEY = 'home-health-pt-scheduler-v2';
export const MILEAGE_KEY = 'home-health-pt-mileage-v1';

export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const initialPatients = [
  {
    id: 'p-101',
    name: 'Maria Lopez',
    area: 'North Valley',
    address: '1128 Cedar Ave, North Valley',
    phone: '(555) 013-4451',
    agency: 'Sunrise Home Health',
    visitsRemaining: 8,
    frequency: '2x/week',
    authExpiration: '2026-07-31',
    notes: 'Prefers morning visits. Has two steps at entry.',
    schedule: [
      { day: 'Monday', time: '09:00' },
      { day: 'Thursday', time: '10:30' },
    ],
  },
  {
    id: 'p-102',
    name: 'James Carter',
    area: 'Eastside',
    address: '44 Oak Bend Rd, Eastside',
    phone: '(555) 018-2240',
    agency: 'CareBridge Agency',
    visitsRemaining: 4,
    frequency: '1x/week',
    authExpiration: '2026-07-12',
    notes: 'Call daughter before arrival.',
    schedule: [{ day: 'Wednesday', time: '13:00' }],
  },
];

export function normalizeSchedule(schedule = []) {
  return schedule.map((visit) => {
    if (typeof visit === 'string') {
      const [day = 'Monday', ...rest] = visit.split(' ');
      return { day, time: rest.join(' ') || '' };
    }
    return { day: visit.day || 'Monday', time: visit.time || '' };
  });
}

export function normalizePatient(patient) {
  return {
    agency: '',
    area: '',
    notes: '',
    phone: '',
    visitsRemaining: 0,
    frequency: '1x/week',
    authExpiration: '',
    schedule: [],
    ...patient,
    visitsRemaining: Number(patient.visitsRemaining || 0),
    schedule: normalizeSchedule(patient.schedule),
  };
}

export function loadPatients(storage = globalThis.localStorage) {
  if (!storage) return initialPatients.map(normalizePatient);
  try {
    const raw = storage.getItem(STORAGE_KEY) || storage.getItem('home-health-pt-scheduler-v1');
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

export function loadMileage(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(MILEAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMileage(entries, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(MILEAGE_KEY, JSON.stringify(entries));
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
  const msPerDay = 86_400_000;
  const days = Math.ceil((expiry - today) / msPerDay);
  if (days < 0) return { label: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`, level: 'danger', days };
  if (days <= 14) return { label: `Expires in ${days} day${days === 1 ? '' : 's'}`, level: 'warning', days };
  return { label: `Auth ${patient.authExpiration}`, level: 'good', days };
}

export function getTodaysVisits(patients, today = new Date()) {
  const day = WEEK_DAYS[(today.getDay() + 6) % 7];
  return patients.flatMap((patient) => normalizeSchedule(patient.schedule)
    .filter((visit) => visit.day === day)
    .map((visit) => ({ ...visit, patient })));
}

export function getWeeklySchedule(patients) {
  return WEEK_DAYS.reduce((schedule, day) => {
    schedule[day] = patients.flatMap((patient) => normalizeSchedule(patient.schedule)
      .filter((visit) => visit.day === day)
      .map((visit) => ({ ...visit, patient })))
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return schedule;
  }, {});
}
