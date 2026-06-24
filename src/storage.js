export const STORAGE_KEY = 'home-health-pt-scheduler-v1';

export const initialPatients = [
  {
    id: 'p-101',
    name: 'Maria Lopez',
    area: 'North Valley',
    address: '1128 Cedar Ave, North Valley',
    phone: '(555) 013-4451',
    visitsRemaining: 8,
    frequency: '2x/week',
    authExpiration: '2026-07-31',
    notes: 'Prefers morning visits. Has two steps at entry.',
    schedule: ['Monday 9:00 AM', 'Thursday 10:30 AM'],
  },
  {
    id: 'p-102',
    name: 'James Carter',
    area: 'Eastside',
    address: '44 Oak Bend Rd, Eastside',
    phone: '(555) 018-2240',
    visitsRemaining: 4,
    frequency: '1x/week',
    authExpiration: '2026-07-12',
    notes: 'Call daughter before arrival.',
    schedule: ['Wednesday 1:00 PM'],
  },
];

export function loadPatients(storage = globalThis.localStorage) {
  if (!storage) return initialPatients;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : initialPatients;
  } catch {
    return initialPatients;
  }
}

export function savePatients(patients, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

export function groupPatientsByArea(patients) {
  return patients.reduce((groups, patient) => {
    const area = patient.area?.trim() || 'Unassigned';
    groups[area] = groups[area] || [];
    groups[area].push(patient);
    return groups;
  }, {});
}
