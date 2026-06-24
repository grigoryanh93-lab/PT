import { groupPatientsByArea, initialPatients, loadPatients, savePatients } from './storage.js';

let patients = loadPatients();
const form = document.querySelector('#patient-form');
const areas = document.querySelector('#areas');
const patientCount = document.querySelector('#patient-count');
const visitCount = document.querySelector('#visit-count');
const resetButton = document.querySelector('#reset-demo');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function renderPatient(patient) {
  const schedule = patient.schedule?.length ? patient.schedule.map((visit) => `<li>${escapeHtml(visit)}</li>`).join('') : '<li>Not scheduled</li>';
  return `<article class="card patient-card">
    <div class="patient-header"><div><h3>${escapeHtml(patient.name)}</h3><p>${escapeHtml(patient.frequency)} · ${Number(patient.visitsRemaining || 0)} visits left</p></div><span>${escapeHtml(patient.authExpiration || 'No auth date')}</span></div>
    <p>📍 ${escapeHtml(patient.address)}</p>
    <p>☎️ <a href="tel:${escapeHtml(patient.phone)}">${escapeHtml(patient.phone || 'No phone listed')}</a></p>
    <div><strong>📅 Weekly schedule</strong><ul>${schedule}</ul></div>
    ${patient.notes ? `<p>📝 ${escapeHtml(patient.notes)}</p>` : ''}
  </article>`;
}

function render() {
  patientCount.textContent = patients.length;
  visitCount.textContent = patients.reduce((sum, patient) => sum + Number(patient.visitsRemaining || 0), 0);
  const groupedPatients = groupPatientsByArea(patients);
  areas.innerHTML = Object.entries(groupedPatients).map(([area, areaPatients]) => `<div class="area"><h2>${escapeHtml(area)}</h2>${areaPatients.map(renderPatient).join('')}</div>`).join('');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const patient = Object.fromEntries(data.entries());
  patient.id = globalThis.crypto?.randomUUID?.() || `p-${Date.now()}`;
  patient.visitsRemaining = Number(patient.visitsRemaining || 0);
  patient.schedule = patient.scheduleText.split('\n').map((line) => line.trim()).filter(Boolean);
  delete patient.scheduleText;
  patients = [...patients, patient];
  savePatients(patients);
  form.reset();
  render();
});

resetButton.addEventListener('click', () => {
  patients = initialPatients;
  savePatients(patients);
  render();
});

render();
