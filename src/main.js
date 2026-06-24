import {
  WEEK_DAYS,
  getAuthorizationStatus,
  getTodaysVisits,
  getWeeklySchedule,
  groupPatientsByArea,
  initialPatients,
  loadMileage,
  loadPatients,
  saveMileage,
  savePatients,
} from './storage.js';

let patients = loadPatients();
let mileage = loadMileage();
let editingId = null;

const $ = (selector) => document.querySelector(selector);
const form = $('#patient-form');
const areas = $('#areas');
const patientCount = $('#patient-count');
const visitCount = $('#visit-count');
const todayList = $('#today-list');
const calendar = $('#calendar');
const mileageForm = $('#mileage-form');
const mileageList = $('#mileage-list');
const mileageTotal = $('#mileage-total');
const exportButton = $('#export-data');
const importInput = $('#import-data');
const resetButton = $('#reset-demo');
const formTitle = $('#form-title');
const cancelEdit = $('#cancel-edit');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function getMapUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function getSmsUrl(phone) {
  return `sms:${String(phone || '').replace(/[^+\d]/g, '')}`;
}

function formatTime(time) {
  if (!time) return 'Any time';
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute || 0, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function scheduleFields(schedule = []) {
  return WEEK_DAYS.map((day) => {
    const visit = schedule.find((item) => item.day === day);
    return `<label class="check-row"><input type="checkbox" name="scheduleDay" value="${day}" ${visit ? 'checked' : ''}/> <span>${day}</span><input type="time" name="time-${day}" value="${escapeHtml(visit?.time || '')}" /></label>`;
  }).join('');
}

function patientActions(patient) {
  return `<div class="actions">
    <a class="action" href="tel:${escapeHtml(patient.phone)}">📞 Call</a>
    <a class="action" href="${escapeHtml(getSmsUrl(patient.phone))}">💬 Text</a>
    <a class="action" href="${escapeHtml(getMapUrl(patient.address))}" target="_blank" rel="noreferrer">🗺️ Maps</a>
    <button type="button" class="action" data-edit="${patient.id}">✏️ Edit</button>
    <button type="button" class="action danger" data-delete="${patient.id}">🗑️ Delete</button>
  </div>`;
}

function renderPatient(patient) {
  const auth = getAuthorizationStatus(patient);
  const schedule = patient.schedule?.length ? patient.schedule.map((visit) => `<li>${escapeHtml(visit.day)} at ${escapeHtml(formatTime(visit.time))}</li>`).join('') : '<li>Not scheduled</li>';
  return `<article class="card patient-card">
    <div class="patient-header"><div><h3>${escapeHtml(patient.name)}</h3><p>${escapeHtml(patient.agency || 'No agency')} · ${escapeHtml(patient.frequency)} · ${Number(patient.visitsRemaining || 0)} visits left</p></div><span class="pill ${auth.level}">${escapeHtml(auth.label)}</span></div>
    <p>📍 ${escapeHtml(patient.address)}</p>
    <p>📱 ${escapeHtml(patient.phone || 'No phone listed')}</p>
    <div><strong>📅 Weekly schedule</strong><ul>${schedule}</ul></div>
    ${patient.notes ? `<p>📝 ${escapeHtml(patient.notes)}</p>` : ''}
    ${patientActions(patient)}
  </article>`;
}

function renderToday() {
  const visits = getTodaysVisits(patients);
  todayList.innerHTML = visits.length ? visits.map(({ patient, time }) => `<article class="visit"><strong>${escapeHtml(formatTime(time))}</strong><span>${escapeHtml(patient.name)}</span><small>${escapeHtml(patient.area)} · ${escapeHtml(patient.address)}</small>${patientActions(patient)}</article>`).join('') : '<p class="empty">No visits scheduled today.</p>';
}

function renderCalendar() {
  const week = getWeeklySchedule(patients);
  calendar.innerHTML = WEEK_DAYS.map((day) => `<section class="day"><h3>${day}</h3>${week[day].length ? week[day].map(({ patient, time }) => `<div class="slot"><strong>${escapeHtml(formatTime(time))}</strong><span>${escapeHtml(patient.name)}</span><small>${escapeHtml(patient.area)}</small></div>`).join('') : '<p>No visits</p>'}</section>`).join('');
}

function renderMileage() {
  const total = mileage.reduce((sum, entry) => sum + Number(entry.miles || 0), 0);
  mileageTotal.textContent = total.toFixed(1);
  mileageList.innerHTML = mileage.length ? mileage.map((entry) => `<li><strong>${escapeHtml(entry.date)}</strong> ${Number(entry.miles).toFixed(1)} mi — ${escapeHtml(entry.note || 'Route')}</li>`).join('') : '<li>No mileage logged yet.</li>';
}

function render() {
  patientCount.textContent = patients.length;
  visitCount.textContent = patients.reduce((sum, patient) => sum + Number(patient.visitsRemaining || 0), 0);
  const groupedPatients = groupPatientsByArea(patients);
  areas.innerHTML = Object.entries(groupedPatients).map(([area, areaPatients]) => `<div class="area"><h2>${escapeHtml(area)}</h2>${areaPatients.map(renderPatient).join('')}</div>`).join('');
  renderToday();
  renderCalendar();
  renderMileage();
}

function readPatientFromForm() {
  const data = new FormData(form);
  const schedule = data.getAll('scheduleDay').map((day) => ({ day, time: data.get(`time-${day}`) || '' }));
  return { id: editingId || globalThis.crypto?.randomUUID?.() || `p-${Date.now()}`, name: data.get('name'), area: data.get('area'), address: data.get('address'), phone: data.get('phone'), agency: data.get('agency'), visitsRemaining: Number(data.get('visitsRemaining') || 0), frequency: data.get('frequency'), authExpiration: data.get('authExpiration'), notes: data.get('notes'), schedule };
}

function fillForm(patient) {
  editingId = patient.id;
  formTitle.textContent = `✏️ Edit ${patient.name}`;
  cancelEdit.hidden = false;
  form.elements.name.value = patient.name || '';
  form.elements.area.value = patient.area || '';
  form.elements.address.value = patient.address || '';
  form.elements.phone.value = patient.phone || '';
  form.elements.agency.value = patient.agency || '';
  form.elements.visitsRemaining.value = patient.visitsRemaining || 0;
  form.elements.frequency.value = patient.frequency || '1x/week';
  form.elements.authExpiration.value = patient.authExpiration || '';
  form.elements.notes.value = patient.notes || '';
  $('#schedule-fields').innerHTML = scheduleFields(patient.schedule);
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  editingId = null;
  form.reset();
  formTitle.textContent = '➕ Add patient';
  cancelEdit.hidden = true;
  $('#schedule-fields').innerHTML = scheduleFields();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const patient = readPatientFromForm();
  patients = editingId ? patients.map((item) => (item.id === editingId ? patient : item)) : [...patients, patient];
  savePatients(patients);
  resetForm();
  render();
});

document.addEventListener('click', (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) fillForm(patients.find((patient) => patient.id === editId));
  if (deleteId && confirm('Delete this patient?')) {
    patients = patients.filter((patient) => patient.id !== deleteId);
    savePatients(patients);
    render();
  }
});

mileageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(mileageForm);
  mileage = [{ date: data.get('date') || new Date().toISOString().slice(0, 10), miles: Number(data.get('miles') || 0), note: data.get('note') }, ...mileage];
  saveMileage(mileage);
  mileageForm.reset();
  renderMileage();
});

exportButton.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ patients, mileage }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `pt-scheduler-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  if (!file) return;
  const backup = JSON.parse(await file.text());
  patients = Array.isArray(backup.patients) ? backup.patients : patients;
  mileage = Array.isArray(backup.mileage) ? backup.mileage : mileage;
  savePatients(patients);
  saveMileage(mileage);
  importInput.value = '';
  render();
});

cancelEdit.addEventListener('click', resetForm);
resetButton.addEventListener('click', () => { patients = initialPatients; mileage = []; savePatients(patients); saveMileage(mileage); resetForm(); render(); });

resetForm();
render();
