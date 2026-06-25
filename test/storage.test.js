import test from 'node:test';
import assert from 'node:assert/strict';
import { VISIT_LOGS_KEY, buildScheduleSuggestions, canSeePatient, createVisitLog, filterVisits, getAdminVisitSummary, getAuthorizationStatus, getLastSeenDate, getNeedsToBeSeenPatients, getNextScheduledVisit, getTodaysVisits, getWeeklySchedule, groupPatientsByArea, loadPatients, loadTherapists, loadVisitLogs, savePatients, saveTherapists, saveVisitLogs, STORAGE_KEY, THERAPISTS_KEY, upsertVisitLog } from '../src/storage.js';

test('groups patients by area with an unassigned fallback', () => {
  const grouped = groupPatientsByArea([{ name: 'A', area: 'North' }, { name: 'B', area: ' ' }]);
  assert.equal(grouped.North.length, 1);
  assert.equal(grouped.Unassigned.length, 1);
});

test('persists and loads patients from storage with visit status fields', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const patients = [{ id: '1', name: 'Saved patient', therapistId: 't-1', schedule: ['Monday 9:00 AM'] }];
  savePatients(patients, storage);
  assert.equal(memory.has(STORAGE_KEY), true);
  const loaded = loadPatients(storage)[0];
  assert.equal(loaded.schedule[0].day, 'Monday');
  assert.equal(loaded.schedule[0].status, 'scheduled');
  assert.equal(loaded.schedule[0].therapistId, 't-1');
});

test('persists therapist list for mock users', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  saveTherapists([{ id: 't-1', name: 'Therapist', active: false }], storage);
  assert.equal(memory.has(THERAPISTS_KEY), true);
  assert.equal(loadTherapists(storage)[0].active, false);
});

test('filters patients by admin and therapist permissions', () => {
  const patient = { therapistId: 't-1' };
  assert.equal(canSeePatient({ id: 'admin', role: 'admin' }, patient), true);
  assert.equal(canSeePatient({ id: 't-1', role: 'therapist' }, patient), true);
  assert.equal(canSeePatient({ id: 't-2', role: 'therapist' }, patient), false);
});

test('finds today visits and builds weekly schedule', () => {
  const patients = [{ id: '1', name: 'A', therapistId: 't-1', schedule: [{ day: 'Wednesday', time: '09:00', status: 'done' }] }];
  const today = new Date('2026-06-24T12:00:00Z');
  assert.equal(getTodaysVisits(patients, today).length, 1);
  assert.equal(getWeeklySchedule(patients).Wednesday[0].patient.name, 'A');
  assert.equal(getWeeklySchedule(patients).Wednesday[0].status, 'done');
});

test('reports authorization expiration alerts', () => {
  const status = getAuthorizationStatus({ authExpiration: '2026-06-30' }, new Date('2026-06-24T00:00:00Z'));
  assert.equal(status.level, 'warning');
});

test('suggests optimized options that prioritize nearby patients and assigned therapist', () => {
  const therapists = [{ id: 't-1', name: 'Therapist', active: true }];
  const patient = { id: 'p-1', name: 'New', area: 'North', therapistId: 't-1', frequency: '1x/week', visitsRemaining: 2, preferredDays: ['Monday'], preferredTimes: 'Morning', schedule: [] };
  const patients = [patient, { id: 'p-2', area: 'North', therapistId: 't-1', schedule: [{ day: 'Monday', time: '08:00', therapistId: 't-1' }] }];
  const options = buildScheduleSuggestions(patient, patients, therapists);
  assert.equal(options[0].day, 'Monday');
  assert.match(options[0].reason, /nearby/);
});

test('returns no schedule suggestions without an active assigned therapist', () => {
  const patient = { id: 'p-1', therapistId: 't-1', visitsRemaining: 1, frequency: '1x/week', schedule: [] };
  assert.deepEqual(buildScheduleSuggestions(patient, [patient], [{ id: 't-1', active: false }]), []);
  assert.deepEqual(buildScheduleSuggestions({ ...patient, therapistId: '' }, [patient], [{ id: 't-1', active: true }]), []);
});

test('schedule optimizer penalizes exact therapist conflicts and explains weekly need', () => {
  const therapists = [{ id: 't-1', name: 'Therapist', active: true }];
  const patient = { id: 'p-1', name: 'New', area: 'North', therapistId: 't-1', frequency: '2x/week', visitsRemaining: 2, preferredDays: ['Monday'], preferredTimes: 'Morning', schedule: [] };
  const patients = [patient, { id: 'p-2', area: 'North', therapistId: 't-1', schedule: [{ day: 'Monday', time: '09:00', therapistId: 't-1', status: 'scheduled' }] }];
  const options = buildScheduleSuggestions(patient, patients, therapists);
  assert.notEqual(options[0].time, '09:00');
  assert.match(options[0].reason, /2 weekly visits still needed/);
});


test('creates and persists visit logs for done visits', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const patient = { id: 'p-1', name: 'Patient A' };
  const visit = { id: 'v-1', day: 'Thursday', time: '10:00' };
  const therapist = { id: 't-1', name: 'Therapist A' };
  const log = createVisitLog({ patient, visit, therapist, note: 'Gait training', completedAt: new Date('2026-06-25T14:15:00Z'), today: new Date('2026-06-25T12:00:00Z') });
  saveVisitLogs(upsertVisitLog([], log), storage);
  assert.equal(memory.has(VISIT_LOGS_KEY), true);
  const loaded = loadVisitLogs(storage)[0];
  assert.equal(loaded.patientName, 'Patient A');
  assert.equal(loaded.therapistName, 'Therapist A');
  assert.equal(loaded.date, '2026-06-25');
  assert.equal(loaded.status, 'done');
  assert.equal(loaded.note, 'Gait training');
});

test('summarizes admin visit dashboard and filters visits', () => {
  const patients = [
    { id: 'p-1', name: 'A', therapistId: 't-1', visitsRemaining: 1, frequency: '1x/week', schedule: [{ id: 'v-1', day: 'Thursday', time: '09:00', status: 'done', therapistId: 't-1' }] },
    { id: 'p-2', name: 'B', therapistId: 't-2', visitsRemaining: 1, frequency: '1x/week', schedule: [{ id: 'v-2', day: 'Thursday', time: '10:00', status: 'missed', therapistId: 't-2' }] },
  ];
  const today = new Date('2026-06-25T12:00:00Z');
  const summary = getAdminVisitSummary(patients, [], today);
  assert.equal(summary.completedToday, 1);
  assert.equal(summary.notCompletedToday, 1);
  assert.equal(summary.missed, 1);
  assert.equal(filterVisits(patients, { therapistId: 't-2', status: 'missed', date: '2026-06-25' }, [], today)[0].patient.name, 'B');
});

test('tracks last seen, next scheduled visit, and needs-to-be-seen reasons', () => {
  const today = new Date('2026-06-25T12:00:00Z');
  const patients = [
    { id: 'p-1', name: 'A', therapistId: 't-1', visitsRemaining: 2, frequency: '2x/week', schedule: [{ id: 'v-1', day: 'Thursday', time: '09:00', status: 'scheduled', therapistId: 't-1' }] },
    { id: 'p-2', name: 'B', therapistId: 't-1', visitsRemaining: 1, frequency: '1x/week', schedule: [] },
  ];
  const logs = [{ patientId: 'p-1', patientName: 'A', therapistId: 't-1', therapistName: 'Therapist', visitId: 'old', date: '2026-06-18', status: 'done' }];
  assert.equal(getLastSeenDate(patients[0], logs), '2026-06-18');
  assert.equal(getNextScheduledVisit(patients[0], today).date, '2026-06-25');
  const needsSeen = getNeedsToBeSeenPatients(patients, logs, today);
  assert.equal(needsSeen.some((item) => item.patient.id === 'p-1' && item.reasons.includes('Scheduled today but not Done')), true);
  assert.equal(needsSeen.some((item) => item.patient.id === 'p-2' && item.reasons.includes('Remaining visits but no upcoming schedule')), true);
});
