import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPatientsByArea, loadPatients, savePatients, STORAGE_KEY } from '../src/storage.js';

test('groups patients by area with an unassigned fallback', () => {
  const grouped = groupPatientsByArea([{ name: 'A', area: 'North' }, { name: 'B', area: ' ' }]);
  assert.equal(grouped.North.length, 1);
  assert.equal(grouped.Unassigned.length, 1);
});

test('persists and loads patients from storage', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const patients = [{ id: '1', name: 'Saved patient' }];
  savePatients(patients, storage);
  assert.equal(memory.has(STORAGE_KEY), true);
  assert.deepEqual(loadPatients(storage), patients);
});
