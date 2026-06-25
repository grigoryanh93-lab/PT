import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScheduleSuggestions, canSeePatient, getAuthorizationStatus, getTodaysVisits, getWeeklySchedule, groupPatientsByArea, loadPatients, loadTherapists, savePatients, saveTherapists, STORAGE_KEY, THERAPISTS_KEY } from '../src/storage.js';

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
  const patients = [{ id: '1', name: 'A', therapistId: 't-1', schedule: [{ day: 'Wednesday', time: '09:00', status: 'completed' }] }];
  const today = new Date('2026-06-24T12:00:00Z');
  assert.equal(getTodaysVisits(patients, today).length, 1);
  assert.equal(getWeeklySchedule(patients).Wednesday[0].patient.name, 'A');
  assert.equal(getWeeklySchedule(patients).Wednesday[0].status, 'completed');
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
