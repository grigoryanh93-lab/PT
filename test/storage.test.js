import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthorizationStatus, getTodaysVisits, getWeeklySchedule, groupPatientsByArea, loadMileage, loadPatients, saveMileage, savePatients, STORAGE_KEY } from '../src/storage.js';

test('groups patients by area with an unassigned fallback', () => {
  const grouped = groupPatientsByArea([{ name: 'A', area: 'North' }, { name: 'B', area: ' ' }]);
  assert.equal(grouped.North.length, 1);
  assert.equal(grouped.Unassigned.length, 1);
});

test('persists and loads patients from storage', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const patients = [{ id: '1', name: 'Saved patient', schedule: ['Monday 9:00 AM'] }];
  savePatients(patients, storage);
  assert.equal(memory.has(STORAGE_KEY), true);
  assert.equal(loadPatients(storage)[0].schedule[0].day, 'Monday');
});

test('finds today visits and builds weekly schedule', () => {
  const patients = [{ id: '1', name: 'A', schedule: [{ day: 'Wednesday', time: '09:00' }] }];
  const today = new Date('2026-06-24T12:00:00Z');
  assert.equal(getTodaysVisits(patients, today).length, 1);
  assert.equal(getWeeklySchedule(patients).Wednesday[0].patient.name, 'A');
});

test('reports authorization expiration alerts', () => {
  const status = getAuthorizationStatus({ authExpiration: '2026-06-30' }, new Date('2026-06-24T00:00:00Z'));
  assert.equal(status.level, 'warning');
});

test('persists mileage entries', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  saveMileage([{ miles: 12.5 }], storage);
  assert.equal(loadMileage(storage)[0].miles, 12.5);
});
