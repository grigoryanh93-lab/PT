import {
  VISIT_STATUSES,
  WEEK_DAYS,
  buildScheduleSuggestions,
  getAuthorizationStatus,
  getTodaysVisits,
  getVisiblePatients,
  getWeeklySchedule,
  groupPatientsByArea,
  initialPatients,
  initialTherapists,
  loadPatients,
  loadSession,
  loadTherapists,
  savePatients,
  saveSession,
  saveTherapists,
} from './storage.js';

let patients = loadPatients();
let therapists = loadTherapists();
let currentUserId = loadSession();
let editingId = null;
let pendingSuggestions = [];

const $ = (selector) => document.querySelector(selector);
const form = $('#patient-form');
const therapistForm = $('#therapist-form');
const areas = $('#areas');
const patientCount = $('#patient-count');
const visitCount = $('#visit-count');
const scheduledCount = $('#scheduled-count');
const todayList = $('#today-list');
const calendar = $('#calendar');
const exportButton = $('#export-data');
const importInput = $('#import-data');
const resetButton = $('#reset-demo');
const formTitle = $('#form-title');
const cancelEdit = $('#cancel-edit');
const userSelect = $('#user-select');
const roleNote = $('#role-note');
const therapistAdmin = $('#therapist-admin');
const therapistList = $('#therapist-list');
const optimizePatient = $('#optimize-patient');
const optimizeButton = $('#optimize-button');
const suggestions = $('#suggestions');

const id = (prefix) => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function showFeedback(message, type = 'success') {
  let notice = $('#app-feedback');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'app-feedback';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    document.body.append(notice);
  }
  notice.className = `app-feedback ${type}`;
  notice.textContent = message;
  clearTimeout(showFeedback.timeout);
  showFeedback.timeout = setTimeout(() => { notice.classList.add('hiding'); }, 3200);
}

function runAction(label, action) {
  try {
    const result = action();
    if (label) showFeedback(label);
    return result;
  } catch (error) {
    console.error(`Action failed: ${label || 'unlabeled action'}`, error);
    showFeedback(error.message || 'Something went wrong. Please try again.', 'error');
    return undefined;
  }
}
const currentUser = () => therapists.find((therapist) => therapist.id === currentUserId) || therapists[0];
const visiblePatients = () => getVisiblePatients(patients, currentUser());
const therapistName = (therapistId) => therapists.find((therapist) => therapist.id === therapistId)?.name || 'Unassigned';

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

function therapistOptions(selected = '') {
  return therapists.filter((therapist) => therapist.active && therapist.role !== 'admin').map((therapist) => `<option value="${escapeHtml(therapist.id)}" ${therapist.id === selected ? 'selected' : ''}>${escapeHtml(therapist.name)}</option>`).join('');
}

function scheduleFields(schedule = []) {
  return WEEK_DAYS.map((day) => {
    const visit = schedule.find((item) => item.day === day) || {};
    return `<label class="check-row"><input type="checkbox" name="scheduleDay" value="${day}" ${visit.day ? 'checked' : ''}/> <span>${day}</span><input type="time" name="time-${day}" value="${escapeHtml(visit.time || '')}" /><select name="status-${day}">${VISIT_STATUSES.map((status) => `<option value="${status}" ${visit.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>`;
  }).join('');
}

function preferredDayFields(selected = []) {
  return WEEK_DAYS.map((day) => `<label class="check-inline"><input type="checkbox" name="preferredDay" value="${day}" ${selected.includes(day) ? 'checked' : ''}/> ${day}</label>`).join('');
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

function renderVisitControls(patient, visit) {
  return `<div class="visit-controls"><select data-visit-status="${patient.id}|${visit.id}">${VISIT_STATUSES.map((status) => `<option ${visit.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select><small>Completed by: ${escapeHtml(visit.completedBy ? therapistName(visit.completedBy) : '—')}</small></div>`;
}

function renderPatient(patient) {
  const auth = getAuthorizationStatus(patient);
  const schedule = patient.schedule?.length ? patient.schedule.map((visit) => `<li><span>${escapeHtml(visit.day)} at ${escapeHtml(formatTime(visit.time))} · ${escapeHtml(visit.status)} · ${escapeHtml(therapistName(visit.therapistId))}</span>${renderVisitControls(patient, visit)}</li>`).join('') : '<li>Not scheduled</li>';
  return `<article class="card patient-card">
    <div class="patient-header"><div><h3>${escapeHtml(patient.name)}</h3><p>${escapeHtml(patient.agency || 'No agency')} · ${escapeHtml(patient.frequency)} · ${Number(patient.visitsRemaining || 0)} visits left</p></div><span class="pill ${auth.level}">${escapeHtml(auth.label)}</span></div>
    <p>👩‍⚕️ ${escapeHtml(therapistName(patient.therapistId))}</p><p>📍 ${escapeHtml(patient.area)} · ${escapeHtml(patient.address)}</p><p>📱 ${escapeHtml(patient.phone || 'No phone listed')}</p>
    <div><strong>📅 Weekly schedule</strong><ul>${schedule}</ul></div>
    <p>⭐ Prefers ${escapeHtml(patient.preferredDays?.join(', ') || 'any day')} ${patient.preferredTimes ? `· ${escapeHtml(patient.preferredTimes)}` : ''}</p>
    ${patient.notes ? `<p>📝 ${escapeHtml(patient.notes)}</p>` : ''}${patientActions(patient)}
  </article>`;
}

function renderToday() {
  const visits = getTodaysVisits(visiblePatients());
  todayList.innerHTML = visits.length ? visits.map((visit) => `<article class="visit ${visit.status}"><strong>${escapeHtml(formatTime(visit.time))}</strong><span>${escapeHtml(visit.patient.name)}</span><small>${escapeHtml(visit.patient.area)} · ${escapeHtml(therapistName(visit.therapistId))} · ${escapeHtml(visit.status)}</small>${renderVisitControls(visit.patient, visit)}${patientActions(visit.patient)}</article>`).join('') : '<p class="empty">No visits scheduled today.</p>';
}

function renderCalendar() {
  const week = getWeeklySchedule(visiblePatients());
  calendar.innerHTML = WEEK_DAYS.map((day) => `<section class="day"><h3>${day}</h3>${week[day].length ? week[day].map((visit) => `<div class="slot ${visit.status}"><strong>${escapeHtml(formatTime(visit.time))}</strong><span>${escapeHtml(visit.patient.name)}</span><small>${escapeHtml(visit.patient.area)} · ${escapeHtml(therapistName(visit.therapistId))} · ${escapeHtml(visit.status)}</small></div>`).join('') : '<p>No visits</p>'}</section>`).join('');
}

function renderTherapists() {
  userSelect.innerHTML = therapists.map((therapist) => `<option value="${therapist.id}" ${therapist.id === currentUserId ? 'selected' : ''}>${therapist.name} (${therapist.role})</option>`).join('');
  const user = currentUser();
  roleNote.textContent = user.role === 'admin' ? 'Admin view: all patients, schedules, and visit status.' : 'Therapist view: assigned patients only.';
  therapistAdmin.hidden = user.role !== 'admin';
  therapistList.innerHTML = therapists.map((therapist) => `<article class="therapist-row"><strong>${escapeHtml(therapist.name)}</strong><span>${escapeHtml(therapist.phone || 'No phone')}</span><span>${escapeHtml(therapist.email || 'No email')}</span><button data-toggle-therapist="${therapist.id}" type="button">${therapist.active ? 'Active' : 'Inactive'}</button></article>`).join('');
  form.elements.therapistId.innerHTML = therapistOptions(user.role === 'therapist' ? user.id : '');
  form.elements.therapistId.disabled = user.role !== 'admin';
}

function renderOptimize() {
  const shown = visiblePatients();
  optimizePatient.innerHTML = shown.length
    ? '<option value="">Select patient to optimize…</option>' + shown.map((patient) => `<option value="${patient.id}">${escapeHtml(patient.name)} · ${escapeHtml(patient.area)} · ${escapeHtml(therapistName(patient.therapistId))}</option>`).join('')
    : '<option value="">No visible patients</option>';
}

function render() {
  const shown = visiblePatients();
  patientCount.textContent = shown.length;
  visitCount.textContent = shown.reduce((sum, patient) => sum + Number(patient.visitsRemaining || 0), 0);
  scheduledCount.textContent = shown.reduce((sum, patient) => sum + patient.schedule.filter((visit) => visit.status === 'scheduled').length, 0);
  const groupedPatients = groupPatientsByArea(shown);
  areas.innerHTML = Object.entries(groupedPatients).map(([area, areaPatients]) => `<div class="area"><h2>${escapeHtml(area)}</h2>${areaPatients.map(renderPatient).join('')}</div>`).join('');
  renderTherapists(); renderOptimize(); renderToday(); renderCalendar();
}

function readPatientFromForm() {
  const data = new FormData(form);
  const existing = patients.find((patient) => patient.id === editingId);
  const therapistId = currentUser().role === 'admin' ? data.get('therapistId') : currentUser().id;
  const schedule = data.getAll('scheduleDay').map((day) => {
    const oldVisit = existing?.schedule?.find((visit) => visit.day === day);
    return { id: oldVisit?.id || id('v'), day, time: data.get(`time-${day}`) || '', status: data.get(`status-${day}`) || 'scheduled', therapistId, completedBy: oldVisit?.completedBy || '' };
  });
  return { id: editingId || id('p'), name: data.get('name'), area: data.get('area'), address: data.get('address'), phone: data.get('phone'), agency: data.get('agency'), therapistId, visitsRemaining: Number(data.get('visitsRemaining') || 0), frequency: data.get('frequency'), preferredDays: data.getAll('preferredDay'), preferredTimes: data.get('preferredTimes'), authExpiration: data.get('authExpiration'), notes: data.get('notes'), schedule };
}

function fillForm(patient) {
  editingId = patient.id; formTitle.textContent = `✏️ Edit ${patient.name}`; cancelEdit.hidden = false;
  ['name', 'area', 'address', 'phone', 'agency', 'frequency', 'authExpiration', 'notes', 'preferredTimes'].forEach((field) => { form.elements[field].value = patient[field] || ''; });
  form.elements.visitsRemaining.value = patient.visitsRemaining || 0;
  form.elements.therapistId.innerHTML = therapistOptions(patient.therapistId);
  $('#preferred-days').innerHTML = preferredDayFields(patient.preferredDays);
  $('#schedule-fields').innerHTML = scheduleFields(patient.schedule);
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  editingId = null; form.reset(); formTitle.textContent = '➕ Add patient'; cancelEdit.hidden = true;
  $('#preferred-days').innerHTML = preferredDayFields(); $('#schedule-fields').innerHTML = scheduleFields(); renderTherapists();
}

form.addEventListener('submit', (event) => { event.preventDefault(); runAction(editingId ? 'Patient updated.' : 'Patient saved.', () => { const patient = readPatientFromForm(); patients = editingId ? patients.map((item) => (item.id === editingId ? patient : item)) : [...patients, patient]; savePatients(patients); resetForm(); render(); }); });

therapistForm.addEventListener('submit', (event) => { event.preventDefault(); runAction('Therapist saved.', () => { const data = new FormData(therapistForm); therapists = [...therapists, { id: id('t'), name: data.get('name'), phone: data.get('phone'), email: data.get('email'), role: data.get('role'), active: data.get('active') === 'on' }]; saveTherapists(therapists); therapistForm.reset(); therapistForm.elements.active.checked = true; render(); }); });

userSelect.addEventListener('change', () => runAction('User view changed.', () => { currentUserId = userSelect.value; saveSession(currentUserId); resetForm(); render(); }));

optimizeButton.addEventListener('click', () => runAction('', () => {
  const patient = patients.find((item) => item.id === optimizePatient.value);
  if (!patient) {
    pendingSuggestions = [];
    suggestions.innerHTML = '<p class="empty error">Select a patient before optimizing.</p>';
    showFeedback('Select a patient before optimizing.', 'error');
    return;
  }
  if (!therapists.find((therapist) => therapist.id === patient.therapistId && therapist.active)) {
    pendingSuggestions = [];
    suggestions.innerHTML = `<p class="empty error">${escapeHtml(patient.name)} needs an active assigned therapist before optimization.</p>`;
    showFeedback('Assign an active therapist before optimizing.', 'error');
    return;
  }
  pendingSuggestions = buildScheduleSuggestions(patient, patients, therapists);
  suggestions.innerHTML = pendingSuggestions.length ? pendingSuggestions.map((option, index) => `<article class="suggestion"><strong>${escapeHtml(option.day)} at ${escapeHtml(formatTime(option.time))}</strong><span>${escapeHtml(option.reason)}</span><div class="button-row"><button class="primary" data-apply-suggestion="${index}" type="button">Apply Suggestion</button><button data-edit-suggestion="${index}" type="button">Edit & Apply</button></div></article>`).join('') : '<p class="empty error">No suggestion available for this patient.</p>';
  showFeedback(`${pendingSuggestions.length} schedule suggestion${pendingSuggestions.length === 1 ? '' : 's'} generated.`);
}));

document.addEventListener('click', (event) => {
  const target = event.target.closest('button[data-edit], button[data-delete], button[data-toggle-therapist], button[data-apply-suggestion], button[data-edit-suggestion], a.action');
  if (!target) return;
  const { edit: editId, delete: deleteId, toggleTherapist, applySuggestion, editSuggestion } = target.dataset;
  if (target.matches('a.action')) showFeedback(`${target.textContent.trim()} opened.`);
  if (editId) runAction('Patient loaded for editing.', () => fillForm(patients.find((patient) => patient.id === editId)));
  if (deleteId && confirm('Delete this patient?')) runAction('Patient deleted.', () => { patients = patients.filter((patient) => patient.id !== deleteId); savePatients(patients); render(); });
  if (toggleTherapist) runAction('Therapist status updated.', () => { therapists = therapists.map((therapist) => therapist.id === toggleTherapist ? { ...therapist, active: !therapist.active } : therapist); saveTherapists(therapists); render(); });
  if (applySuggestion !== undefined || editSuggestion !== undefined) runAction('Schedule suggestion applied.', () => {
    const suggestionIndex = Number(applySuggestion ?? editSuggestion);
    const option = pendingSuggestions[suggestionIndex];
    const patientId = optimizePatient.value;
    if (!patientId) throw new Error('Select a patient before applying a suggestion.');
    if (!option) throw new Error('That schedule suggestion is no longer available. Run Optimize Schedule again.');
    const time = editSuggestion !== undefined ? prompt('Edit suggested time (HH:MM)', option.time) || option.time : option.time;
    patients = patients.map((patient) => patient.id === patientId ? { ...patient, schedule: [...patient.schedule, { id: id('v'), day: option.day, time, status: 'scheduled', therapistId: option.therapistId, completedBy: '' }] } : patient);
    savePatients(patients); suggestions.innerHTML = '<p class="empty">Suggestion applied. Review the calendar and edit the patient if needed.</p>'; render();
  });
});

document.addEventListener('change', (event) => {
  const visitStatus = event.target.dataset.visitStatus;
  if (!visitStatus) return;
  runAction('Visit status updated.', () => {
    const [patientId, visitId] = visitStatus.split('|');
    patients = patients.map((patient) => patient.id === patientId ? { ...patient, schedule: patient.schedule.map((visit) => visit.id === visitId ? { ...visit, status: event.target.value, completedBy: event.target.value === 'completed' ? currentUser().id : visit.completedBy } : visit) } : patient);
    savePatients(patients); render();
  });
});

exportButton.addEventListener('click', () => runAction('Backup exported.', () => { const blob = new Blob([JSON.stringify({ patients, therapists }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `pt-scheduler-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href); }));

importInput.addEventListener('change', async () => { try { const file = importInput.files?.[0]; if (!file) return; const backup = JSON.parse(await file.text()); patients = Array.isArray(backup.patients) ? backup.patients : patients; therapists = Array.isArray(backup.therapists) ? backup.therapists : therapists; savePatients(patients); saveTherapists(therapists); importInput.value = ''; render(); showFeedback('Backup imported.'); } catch (error) { console.error('Import failed', error); showFeedback('Import failed. Choose a valid backup JSON file.', 'error'); } });

cancelEdit.addEventListener('click', () => runAction('Edit cancelled.', resetForm));
resetButton.addEventListener('click', () => runAction('Demo data reset.', () => { patients = initialPatients; therapists = initialTherapists; currentUserId = 't-admin'; savePatients(patients); saveTherapists(therapists); saveSession(currentUserId); pendingSuggestions = []; suggestions.innerHTML = ''; resetForm(); render(); }));

resetForm(); render();
