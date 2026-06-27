import {
  LOW_VISIT_WARNING_THRESHOLD,
  VISIT_STATUSES,
  VISIT_STATUS_LABELS,
  WEEK_DAYS,
  buildReports,
  buildScheduleSuggestions,
  createVisitLog,
  filterVisits,
  getAdminVisitSummary,
  getAuthorizationStatus,
  getLastSeenDate,
  getVisitLogHistory,
  getNeedsToBeSeenPatients,
  getNextScheduledVisit,
  getTodaysVisits,
  getVisiblePatients,
  getTherapistProductivity,
  getWeeklySchedule,
  groupPatientsByArea,
  initialPatients,
  initialTherapists,
  loadPatients,
  loadVisitLogs,
  loadSession,
  loadTherapists,
  savePatients,
  saveSession,
  saveTherapists,
  saveVisitLogs,
  upsertVisitLog,
} from './storage.js';
import { deletePatientShared, deleteTherapistShared, getSession, isSupabaseConfigured, loadSharedData, savePatientImportShared, savePatientShared, saveTherapistShared, saveVisitLogShared, signIn, signOut, signUp, supabaseClient } from './supabaseClient.js';

let patients = loadPatients();
let therapists = loadTherapists();
let visitLogs = loadVisitLogs();
let currentUserId = loadSession();
let editingId = null;
let editingTherapistId = null;
let editingAppointment = null;
let activePage = localStorage.getItem('home-health-pt-active-page-v1') || 'dashboard';
let pendingSuggestions = [];
let sharedMode = isSupabaseConfigured;
let authSession = null;

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
const backupSection = $('#backup-section');
const importInput = $('#import-data');
const resetButton = $('#reset-demo');
const formTitle = $('#form-title');
const cancelEdit = $('#cancel-edit');
const userSelect = $('#user-select');
const authForm = $('#auth-form');
const signupButton = $('#signup-button');
const logoutButton = $('#logout-button');
const roleNote = $('#role-note');
const therapistAdmin = $('#therapist-admin');
const therapistList = $('#therapist-list');
const optimizePatient = $('#optimize-patient');
const optimizeButton = $('#optimize-button');
const suggestions = $('#suggestions');
const adminDashboard = $('#admin-dashboard');
const adminStats = $('#admin-stats');
const visitFilters = $('#visit-filters');
const visitFilterList = $('#visit-filter-list');
const needsSeenList = $('#needs-seen-list');
const patientImportSection = $('#patient-import-section');
const patientImportFile = $('#patient-import-file');
const patientImportErrors = $('#patient-import-errors');
const patientImportPreview = $('#patient-import-preview');
const confirmPatientImport = $('#confirm-patient-import');
const clearPatientImport = $('#clear-patient-import');
const sampleImport = $('#sample-import');
const generateNextWeek = $('#generate-next-week');
const applyAllSuggestions = $('#apply-all-suggestions');
const scheduleFilters = $('#schedule-filters');
const dailyView = $('#daily-view');
const reportsSummary = $('#reports-summary');
const exportReportCsv = $('#export-report-csv');
const patientSearch = $('#patient-search');
const photoImport = $('#photo-import');
const exportPatientsCsv = $('#export-patients-csv');
const exportPatientsExcel = $('#export-patients-excel');
const pageSections = [...document.querySelectorAll('[data-page]')];
const navLinks = [...document.querySelectorAll('[data-page-target]')];
const appointmentForm = $('#appointment-form');
const appointmentFormTitle = $('#appointment-form-title');
const cancelAppointmentEdit = $('#cancel-appointment-edit');
const therapistSubmit = $('#therapist-submit');
const cancelTherapistEdit = $('#cancel-therapist-edit');
let pendingPatientImport = [];

const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;


function setActivePage(page) {
  activePage = pageSections.some((section) => section.dataset.page === page) ? page : 'dashboard';
  localStorage.setItem('home-health-pt-active-page-v1', activePage);
  pageSections.forEach((section) => { section.hidden = section.dataset.page !== activePage; });
  navLinks.forEach((link) => {
    const active = link.dataset.pageTarget === activePage;
    link.classList.toggle('active', active);
    link.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function resetAppointmentForm() {
  editingAppointment = null;
  appointmentForm.reset();
  appointmentFormTitle.textContent = '➕ Add appointment';
  cancelAppointmentEdit.hidden = true;
}

function fillAppointmentForm(patientId, visitId) {
  const patient = patients.find((item) => item.id === patientId);
  const visit = patient?.schedule.find((item) => item.id === visitId);
  if (!patient || !visit) return;
  editingAppointment = { patientId, visitId };
  appointmentForm.elements.patientId.value = patientId;
  appointmentForm.elements.therapistId.value = visit.therapistId || patient.therapistId;
  appointmentForm.elements.day.value = visit.day;
  appointmentForm.elements.time.value = visit.time || '';
  appointmentForm.elements.status.value = visit.status || 'scheduled';
  appointmentFormTitle.textContent = `✏️ Edit ${patient.name} appointment`;
  cancelAppointmentEdit.hidden = false;
  setActivePage('schedule');
  appointmentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetTherapistForm() {
  editingTherapistId = null;
  therapistForm.reset();
  therapistForm.elements.active.checked = true;
  therapistSubmit.textContent = 'Add therapist';
  cancelTherapistEdit.hidden = true;
}

function fillTherapistForm(therapistId) {
  const therapist = therapists.find((item) => item.id === therapistId);
  if (!therapist) return;
  editingTherapistId = therapistId;
  ['name', 'phone', 'email', 'role', 'availability'].forEach((field) => { therapistForm.elements[field].value = therapist[field] || ''; });
  therapistForm.elements.serviceAreas.value = (therapist.serviceAreas || []).join(', ');
  therapistForm.elements.active.checked = therapist.active !== false;
  therapistSubmit.textContent = 'Save therapist';
  cancelTherapistEdit.hidden = false;
  setActivePage('therapists');
}

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
    if (result && typeof result.then === 'function') {
      return result.then((value) => { if (label) showFeedback(label); return value; }).catch((error) => {
        console.error(`Action failed: ${label || 'unlabeled action'}`, error);
        showFeedback(error.message || 'Something went wrong. Please try again.', 'error');
        return undefined;
      });
    }
    if (label) showFeedback(label);
    return result;
  } catch (error) {
    console.error(`Action failed: ${label || 'unlabeled action'}`, error);
    showFeedback(error.message || 'Something went wrong. Please try again.', 'error');
    return undefined;
  }
}
const currentUser = () => therapists.find((therapist) => therapist.id === currentUserId) || therapists[0] || { id: '', role: 'therapist', name: 'Signed out' };
const persistPatient = async (patient) => { savePatients(patients); if (sharedMode) await savePatientShared(patient); };
const persistTherapist = async (therapist) => { saveTherapists(therapists); if (sharedMode) await saveTherapistShared(therapist); };
const persistVisitLog = async (log) => { saveVisitLogs(visitLogs); if (sharedMode && log) await saveVisitLogShared(log); };
const syncPatients = () => { savePatients(patients); if (sharedMode) Promise.allSettled(patients.map(savePatientShared)).then((results) => { if (results.some((result) => result.status === 'rejected')) showFeedback('Saved locally; Supabase sync needs attention.', 'error'); }); };
const syncTherapists = () => { saveTherapists(therapists); if (sharedMode) Promise.allSettled(therapists.map(saveTherapistShared)); };
async function refreshSharedData() { if (!sharedMode) return; const shared = await loadSharedData(); patients = shared.patients; therapists = shared.therapists; visitLogs = shared.visitLogs; savePatients(patients); saveTherapists(therapists); saveVisitLogs(visitLogs); }
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

function statusOptions(selected = 'scheduled') {
  return VISIT_STATUSES.map((status) => `<option value="${status}" ${status === selected ? 'selected' : ''}>${VISIT_STATUS_LABELS[status]}</option>`).join('');
}

function scheduleFields(schedule = []) {
  return WEEK_DAYS.map((day) => {
    const visit = schedule.find((item) => item.day === day) || {};
    return `<label class="check-row"><input type="checkbox" name="scheduleDay" value="${day}" ${visit.day ? 'checked' : ''}/> <span>${day}</span><input type="time" name="time-${day}" value="${escapeHtml(visit.time || '')}" /><select name="status-${day}">${statusOptions(visit.status)}</select></label>`;
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

const IMPORT_COLUMNS = ['Patient Name', 'Address', 'Phone', 'Area/City', 'Visits Remaining', 'Frequency', 'Authorization Expiration', 'Preferred Days', 'Preferred Time', 'Assigned Therapist', 'Notes'];
const SAMPLE_CSV = `Patient Name,Address,Phone,Area/City,Visits Remaining,Frequency,Authorization Expiration,Preferred Days,Preferred Time,Assigned Therapist,Notes
Sample Import Patient,"123 Test Ave, North Valley",(555) 010-9999,North Valley,6,2x/week,2026-08-15,"Monday; Thursday",Morning,"Amy Nguyen, PT",Sample CSV import row`;

function normalizeHeader(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value); if (row.some((cell) => String(cell).trim())) rows.push(row); row = []; value = '';
    } else value += char;
  }
  row.push(value); if (row.some((cell) => String(cell).trim())) rows.push(row);
  return rows;
}

function csvEscape(value = '') {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowsToPatients(rows) {
  const headers = rows[0]?.map(normalizeHeader) || [];
  const aliases = {
    name: ['patientname', 'name', 'patient'], address: ['address'], phone: ['phone', 'phonenumber'], area: ['areacity', 'area', 'city'],
    visitsRemaining: ['visitsremaining', 'visits', 'remainingvisits'], frequency: ['frequency'], authExpiration: ['authorizationexpiration', 'authexpiration', 'authorizationexpires'],
    preferredDays: ['preferreddays', 'days'], preferredTimes: ['preferredtime', 'preferredtimes', 'time'], therapist: ['assignedtherapist', 'therapist'], notes: ['notes', 'note'],
  };
  const columnIndex = (keys) => keys.map((key) => headers.indexOf(key)).find((index) => index >= 0);
  const indexes = Object.fromEntries(Object.entries(aliases).map(([key, keys]) => [key, columnIndex(keys)]));
  const seenKeys = new Set(patients.map(duplicateKey));
  return rows.slice(1).map((row, rowIndex) => {
    const read = (key) => indexes[key] >= 0 ? String(row[indexes[key]] || '').trim() : '';
    const therapistText = read('therapist');
    const therapist = therapists.find((item) => item.name.toLowerCase() === therapistText.toLowerCase()) || therapists.find((item) => item.name.toLowerCase().includes(therapistText.toLowerCase()) && therapistText);
    const preferredDays = read('preferredDays').split(/[;,|]/).map((day) => day.trim()).filter(Boolean).map((day) => WEEK_DAYS.find((known) => known.toLowerCase().startsWith(day.toLowerCase())) || day);
    const patient = { id: id('p'), name: read('name'), address: read('address'), phone: read('phone'), area: read('area'), visitsRemaining: Number(read('visitsRemaining') || 0), frequency: read('frequency') || '1x/week', authExpiration: read('authExpiration'), preferredDays, preferredTimes: read('preferredTimes'), therapistId: therapist?.id || '', notes: read('notes'), agency: '', schedule: [] };
    const errors = [];
    if (!patient.name) errors.push('Missing Patient Name');
    if (!patient.address) errors.push('Missing Address');
    if (!patient.area) errors.push('Missing Area/City');
    const key = duplicateKey(patient);
    const duplicate = seenKeys.has(key);
    if (key !== '|') seenKeys.add(key);
    return { rowNumber: rowIndex + 2, patient, errors, duplicate };
  });
}

function duplicateKey(patient) {
  return `${String(patient.name || '').trim().toLowerCase()}|${String(patient.address || '').trim().toLowerCase()}`;
}

function renderPatientImportPreview(items = pendingPatientImport) {
  const errors = items.flatMap((item) => item.errors.map((error) => `Row ${item.rowNumber}: ${error}`));
  const duplicateCount = items.filter((item) => item.duplicate).length;
  patientImportErrors.innerHTML = [
    ...errors.map((error) => `<div class="error-item">${escapeHtml(error)}</div>`),
    ...(duplicateCount ? [`<div class="warning-item">${duplicateCount} duplicate patient${duplicateCount === 1 ? '' : 's'} detected by name + address and will be skipped.</div>`] : []),
  ].join('');
  patientImportPreview.innerHTML = items.length ? `<table class="preview-table"><thead><tr>${IMPORT_COLUMNS.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}<th>Status</th></tr></thead><tbody>${items.map(({ patient, errors: rowErrors, duplicate }) => `<tr class="${rowErrors.length ? 'has-error' : duplicate ? 'is-duplicate' : ''}"><td>${escapeHtml(patient.name)}</td><td>${escapeHtml(patient.address)}</td><td>${escapeHtml(patient.phone)}</td><td>${escapeHtml(patient.area)}</td><td>${escapeHtml(patient.visitsRemaining)}</td><td>${escapeHtml(patient.frequency)}</td><td>${escapeHtml(patient.authExpiration)}</td><td>${escapeHtml(patient.preferredDays.join(', '))}</td><td>${escapeHtml(patient.preferredTimes)}</td><td>${escapeHtml(therapistName(patient.therapistId))}</td><td>${escapeHtml(patient.notes)}</td><td>${escapeHtml(rowErrors.join('; ') || (duplicate ? 'Duplicate - skipped' : 'Ready'))}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">No patient import preview yet.</p>';
  confirmPatientImport.disabled = !items.length || errors.length > 0 || !items.some((item) => !item.duplicate);
}

async function parsePatientImportFile(file) {
  if (file.name.toLowerCase().endsWith('.xlsx')) {
    if (!globalThis.XLSX) throw new Error('Excel import needs the SheetJS parser to load first. Check your connection and try again.');
    const workbook = globalThis.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return globalThis.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
  }
  return parseCsv(await file.text());
}

function exportPatients(format) {
  const rows = [IMPORT_COLUMNS, ...patients.map((patient) => [patient.name, patient.address, patient.phone, patient.area, patient.visitsRemaining, patient.frequency, patient.authExpiration, patient.preferredDays?.join('; ') || '', patient.preferredTimes, therapistName(patient.therapistId), patient.notes])];
  if (format === 'xlsx' && globalThis.XLSX) {
    const workbook = globalThis.XLSX.utils.book_new();
    globalThis.XLSX.utils.book_append_sheet(workbook, globalThis.XLSX.utils.aoa_to_sheet(rows), 'Patients');
    globalThis.XLSX.writeFile(workbook, `pt-patients-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return;
  }
  const blob = new Blob([rows.map((row) => row.map(csvEscape).join(',')).join('\n')], { type: 'text/csv' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `pt-patients-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
}

function renderVisitControls(patient, visit) {
  return `<div class="visit-controls">
    <button type="button" class="primary" data-visit-action="done" data-patient-id="${patient.id}" data-visit-id="${visit.id}">Done</button>
    <button type="button" data-visit-action="missed" data-patient-id="${patient.id}" data-visit-id="${visit.id}">Missed</button>
    <button type="button" data-visit-action="cancelled" data-patient-id="${patient.id}" data-visit-id="${visit.id}">Cancel</button>
    <button type="button" data-visit-action="rescheduled" data-patient-id="${patient.id}" data-visit-id="${visit.id}">Reschedule</button>
    <small>Completed by: ${escapeHtml(visit.completedBy ? therapistName(visit.completedBy) : '—')}${visit.completedAt ? ` · ${escapeHtml(visit.completedAt)}` : ''}</small>
  </div>`;
}

function renderPatient(patient) {
  const auth = getAuthorizationStatus(patient);
  const history = getVisitLogHistory(patient, visitLogs);
  const lastSeen = getLastSeenDate(patient, visitLogs) || 'Never';
  const nextVisit = getNextScheduledVisit(patient);
  const lowWarning = Number(patient.visitsRemaining || 0) > 0 && Number(patient.visitsRemaining || 0) <= LOW_VISIT_WARNING_THRESHOLD;
  const schedule = patient.schedule?.length ? patient.schedule.map((visit) => `<li><span>${escapeHtml(visit.day)} at ${escapeHtml(formatTime(visit.time))} · ${escapeHtml(VISIT_STATUS_LABELS[visit.status] || visit.status)} · ${escapeHtml(therapistName(visit.therapistId))}</span>${renderVisitControls(patient, visit)}</li>`).join('') : '<li>Not scheduled</li>';
  const historyHtml = history.length ? history.slice(0, 5).map((log) => `<li>${escapeHtml(log.date)} · ${escapeHtml(log.completedTime || '—')} · ${escapeHtml(log.therapistName)} · ${escapeHtml(VISIT_STATUS_LABELS[log.status] || log.status)}${log.note ? ` · ${escapeHtml(log.note)}` : ''}</li>`).join('') : '<li>No completed visit logs yet</li>';
  return `<article class="card patient-card">
    <div class="patient-header"><div><h3>${escapeHtml(patient.name)}</h3><p><span class="pill neutral">${escapeHtml(patient.status || 'Active')}</span> ${escapeHtml(patient.agency || 'No agency')} · ${escapeHtml(patient.frequency)} · ${Number(patient.visitsRemaining || 0)} visits left</p><p>Auth: ${Number(patient.approvedVisits || 0)} approved · ${Number(patient.usedVisits || 0)} used · ${Number(patient.visitsRemaining || 0)} remaining</p></div><span class="pill ${auth.level}">${escapeHtml(auth.label)}</span></div>
    ${lowWarning ? '<p class="warning-text">⚠️ Low visits remaining. Request authorization soon.</p>' : ''}<p>👩‍⚕️ ${escapeHtml(therapistName(patient.therapistId))}</p><p>👀 Last seen: ${escapeHtml(lastSeen)} · Next: ${nextVisit ? `${escapeHtml(nextVisit.day)} ${escapeHtml(formatTime(nextVisit.time))}` : 'None scheduled'}</p><p>📍 ${escapeHtml(patient.area)} · ${escapeHtml(patient.address)}</p><p>📱 ${escapeHtml(patient.phone || 'No phone listed')}</p>
    <div><strong>📅 Weekly schedule</strong><ul>${schedule}</ul></div>
    <p>⭐ Prefers ${escapeHtml(patient.preferredDays?.join(', ') || 'any day')} ${patient.preferredTimes ? `· ${escapeHtml(patient.preferredTimes)}` : ''}</p>
    <div><strong>📋 Visit history</strong><ul>${historyHtml}</ul></div>${patient.notes ? `<p>📝 ${escapeHtml(patient.notes)}</p>` : ''}${patientActions(patient)}
  </article>`;
}

function renderToday() {
  const visits = getTodaysVisits(visiblePatients());
  todayList.innerHTML = visits.length ? visits.map((visit) => `<article class="visit ${visit.status}"><strong>${escapeHtml(formatTime(visit.time))}</strong><span>${escapeHtml(visit.patient.name)}</span><small>${escapeHtml(visit.patient.area)} · ${escapeHtml(therapistName(visit.therapistId))} · ${escapeHtml(VISIT_STATUS_LABELS[visit.status] || visit.status)}</small>${renderVisitControls(visit.patient, visit)}${patientActions(visit.patient)}</article>`).join('') : '<p class="empty">No visits scheduled today.</p>';
}

function renderCalendar() {
  const shown = visiblePatients();
  appointmentForm.elements.patientId.innerHTML = shown.map((patient) => `<option value="${patient.id}">${escapeHtml(patient.name)}</option>`).join('');
  appointmentForm.elements.therapistId.innerHTML = therapistOptions(appointmentForm.elements.therapistId.value);
  appointmentForm.elements.day.innerHTML = WEEK_DAYS.map((day) => `<option value="${day}">${day}</option>`).join('');
  appointmentForm.elements.status.innerHTML = statusOptions(appointmentForm.elements.status.value || 'scheduled');
  scheduleFilters.elements.therapistId.innerHTML = '<option value="">All therapists</option>' + therapistOptions(scheduleFilters.elements.therapistId.value);
  scheduleFilters.elements.status.innerHTML = '<option value="">All statuses</option>' + statusOptions(scheduleFilters.elements.status.value);
  const filters = Object.fromEntries(new FormData(scheduleFilters).entries());
  const filteredDaily = filterVisits(shown, filters, visitLogs).filter((visit) => !filters.area || String(visit.patient.area || '').toLowerCase().includes(String(filters.area).toLowerCase()));
  dailyView.innerHTML = filters.date || filters.therapistId || filters.status || filters.area ? (filteredDaily.length ? filteredDaily.map((visit) => `<article class="visit ${visit.status}"><strong>${escapeHtml(visit.date)} · ${escapeHtml(formatTime(visit.time))}</strong><span>${escapeHtml(visit.patient.name)}</span><small>${escapeHtml(visit.patient.area)} · ${escapeHtml(therapistName(visit.therapistId))}</small>${renderVisitControls(visit.patient, visit)}${patientActions(visit.patient)}</article>`).join('') : '<p class="empty">No appointments match these filters.</p>') : '<p class="empty">Use filters above for daily view by therapist, date, status, or area.</p>';
  const week = getWeeklySchedule(shown);
  calendar.innerHTML = WEEK_DAYS.map((day) => `<section class="day"><h3>${day}</h3>${week[day].length ? week[day].map((visit) => `<div class="slot ${visit.status}"><strong>${escapeHtml(formatTime(visit.time))}</strong><span>${escapeHtml(visit.patient.name)}</span><small>${escapeHtml(visit.patient.area)} · ${escapeHtml(therapistName(visit.therapistId))} · ${escapeHtml(VISIT_STATUS_LABELS[visit.status] || visit.status)}</small><div class="visit-controls"><button type="button" data-edit-appointment="${visit.patient.id}|${visit.id}">Edit</button><button type="button" class="danger" data-delete-appointment="${visit.patient.id}|${visit.id}">Delete</button></div>${renderVisitControls(visit.patient, visit)}${patientActions(visit.patient)}</div>`).join('') : '<p>No visits</p>'}</section>`).join('');
}

function renderTherapists() {
  userSelect.innerHTML = therapists.map((therapist) => `<option value="${therapist.id}" ${therapist.id === currentUserId ? 'selected' : ''}>${therapist.name} (${therapist.role})</option>`).join('');
  userSelect.hidden = sharedMode;
  const user = currentUser();
  roleNote.textContent = sharedMode ? (authSession ? `${user.role === 'admin' ? 'Admin' : 'Therapist'} shared Supabase account: ${user.name || authSession.user.email}` : 'Supabase is configured. Log in to sync shared team data.') : 'Demo mode: Supabase is not configured, so data is stored locally on this device.';
  therapistAdmin.hidden = user.role !== 'admin';
  patientImportSection.hidden = user.role !== 'admin';
  backupSection.hidden = user.role !== 'admin';
  therapistList.innerHTML = therapists.map((therapist) => { const assigned = patients.filter((patient) => patient.therapistId === therapist.id); const productivity = getTherapistProductivity(patients, [therapist], visitLogs)[0]; return `<article class="therapist-row"><strong>${escapeHtml(therapist.name)}</strong><span>${escapeHtml(therapist.phone || 'No phone')}</span><span>${assigned.length} patient${assigned.length === 1 ? '' : 's'} · ${productivity.completedToday} done today · ${productivity.pending} pending · ${escapeHtml((therapist.serviceAreas || []).join(', ') || 'No areas')}</span><div class="actions-inline"><button data-edit-therapist="${therapist.id}" type="button">Edit</button><button data-toggle-therapist="${therapist.id}" type="button">${therapist.active ? 'Active' : 'Inactive'}</button><button class="danger" data-delete-therapist="${therapist.id}" type="button">Delete</button></div></article>`; }).join('');
  form.elements.therapistId.innerHTML = therapistOptions(user.role === 'therapist' ? user.id : '');
  form.elements.therapistId.disabled = user.role !== 'admin';
}

function renderOptimize() {
  const shown = visiblePatients();
  optimizePatient.innerHTML = shown.length
    ? '<option value="">Select patient to optimize…</option>' + shown.map((patient) => `<option value="${patient.id}">${escapeHtml(patient.name)} · ${escapeHtml(patient.area)} · ${escapeHtml(therapistName(patient.therapistId))}</option>`).join('')
    : '<option value="">No visible patients</option>';
}


function renderAdminDashboard() {
  const user = currentUser();
  adminDashboard.hidden = user.role !== 'admin';
  if (user.role !== 'admin') return;
  const summary = getAdminVisitSummary(patients, visitLogs);
  const reports = buildReports(patients, therapists, visitLogs);
  const todayTotal = getTodaysVisits(patients).length;
  adminStats.innerHTML = `
    <div><strong>${todayTotal}</strong><small>scheduled today</small></div>
    <div><strong>${summary.completedToday}</strong><small>completed today</small></div>
    <div><strong>${summary.notCompletedToday}</strong><small>pending today</small></div>
    <div><strong>${summary.missed}</strong><small>missed visits</small></div>
    <div><strong>${summary.cancelled}</strong><small>cancelled visits</small></div>
    <div><strong>${summary.overduePatients}</strong><small>overdue patients</small></div>
    <div><strong>${reports.lowAuthorization.length}</strong><small>low auth visits</small></div>
    <div><strong>${reports.expiringAuthorization.length}</strong><small>auth expiring soon</small></div>
    <div><strong>${reports.weeklyVisitTotal}</strong><small>visits this week</small></div>
    <div><strong>${reports.productivity.map((item) => `${escapeHtml(item.therapist.name)} ${item.completedToday}/${item.pending}`).join('<br>')}</strong><small>productivity done/pending</small></div>`;
  visitFilters.elements.therapistId.innerHTML = '<option value="">All therapists</option>' + therapistOptions(visitFilters.elements.therapistId.value);
  visitFilters.elements.patientId.innerHTML = '<option value="">All patients</option>' + patients.map((patient) => `<option value="${patient.id}" ${visitFilters.elements.patientId.value === patient.id ? 'selected' : ''}>${escapeHtml(patient.name)}</option>`).join('');
  visitFilters.elements.status.innerHTML = '<option value="">All statuses</option>' + statusOptions(visitFilters.elements.status.value);
  const filters = Object.fromEntries(new FormData(visitFilters).entries());
  const filtered = filterVisits(patients, filters, visitLogs);
  visitFilterList.innerHTML = filtered.length ? filtered.map((visit) => `<article class="visit ${visit.status}"><strong>${escapeHtml(visit.date)} · ${escapeHtml(formatTime(visit.time))}</strong><span>${escapeHtml(visit.patient.name)}</span><small>${escapeHtml(therapistName(visit.therapistId))} · ${escapeHtml(VISIT_STATUS_LABELS[visit.status] || visit.status)}</small></article>`).join('') : '<p class="empty">No visits match these filters.</p>';
}

function renderNeedsSeen() {
  const items = getNeedsToBeSeenPatients(visiblePatients(), visitLogs);
  needsSeenList.innerHTML = items.length ? items.map(({ patient, reasons, lastSeen, nextScheduled }) => `<article class="visit warning"><strong>${escapeHtml(patient.name)}</strong><span>${reasons.map(escapeHtml).join(' · ')}</span><small>Last seen: ${escapeHtml(lastSeen || 'Never')} · Next: ${nextScheduled ? `${escapeHtml(nextScheduled.day)} ${escapeHtml(formatTime(nextScheduled.time))}` : 'None scheduled'}</small></article>`).join('') : '<p class="empty">No patients need attention right now.</p>';
}


function renderReports() {
  if (!reportsSummary) return;
  const reports = buildReports(patients, therapists, visitLogs);
  const card = (title, body) => `<article class="report-card"><strong>${escapeHtml(title)}</strong>${body}</article>`;
  reportsSummary.innerHTML = [
    card('Therapist productivity', `<ul>${reports.productivity.map((item) => `<li>${escapeHtml(item.therapist.name)}: ${item.completedToday} today · ${item.completedThisWeek} week · ${item.pending} pending · ${item.missed} missed · ${item.patientsAssigned} patients</li>`).join('')}</ul>`),
    card('Pending visits', `<p>${reports.pendingVisits.length}</p>`),
    card('Patients not seen this week', `<ul>${reports.patientsNotSeenThisWeek.map((patient) => `<li>${escapeHtml(patient.name)}</li>`).join('') || '<li>None</li>'}</ul>`),
    card('Overdue patients', `<ul>${reports.overdue.map((item) => `<li>${escapeHtml(item.patient.name)} — ${item.reasons.map(escapeHtml).join(' · ')}</li>`).join('') || '<li>None</li>'}</ul>`),
    card('Low authorization', `<ul>${reports.lowAuthorization.map((patient) => `<li>${escapeHtml(patient.name)} — ${patient.visitsRemaining} remaining</li>`).join('') || '<li>None</li>'}</ul>`),
    card('Expiring authorization', `<ul>${reports.expiringAuthorization.map((patient) => `<li>${escapeHtml(patient.name)} — ${escapeHtml(patient.authExpiration)}</li>`).join('') || '<li>None</li>'}</ul>`),
    card('Weekly visit total', `<p>${reports.weeklyVisitTotal}</p>`),
  ].join('');
}

function render() {
  const search = String(patientSearch?.value || '').toLowerCase();
  const shown = visiblePatients().filter((patient) => !search || [patient.name, patient.area, patient.address, patient.phone, patient.agency].some((value) => String(value || '').toLowerCase().includes(search)));
  patientCount.textContent = shown.length;
  visitCount.textContent = shown.reduce((sum, patient) => sum + Number(patient.visitsRemaining || 0), 0);
  scheduledCount.textContent = shown.reduce((sum, patient) => sum + patient.schedule.filter((visit) => visit.status === 'scheduled').length, 0);
  const groupedPatients = groupPatientsByArea(shown);
  areas.innerHTML = Object.entries(groupedPatients).map(([area, areaPatients]) => `<div class="area"><h2>${escapeHtml(area)}</h2>${areaPatients.map(renderPatient).join('')}</div>`).join('');
  renderTherapists(); renderOptimize(); renderToday(); renderCalendar(); renderAdminDashboard(); renderNeedsSeen(); renderReports(); setActivePage(activePage);
}

function readPatientFromForm() {
  const data = new FormData(form);
  const existing = patients.find((patient) => patient.id === editingId);
  const therapistId = currentUser().role === 'admin' ? data.get('therapistId') : currentUser().id;
  const schedule = data.getAll('scheduleDay').map((day) => {
    const oldVisit = existing?.schedule?.find((visit) => visit.day === day);
    return { id: oldVisit?.id || id('v'), day, time: data.get(`time-${day}`) || '', status: data.get(`status-${day}`) || 'scheduled', therapistId, completedBy: oldVisit?.completedBy || '', completedAt: oldVisit?.completedAt || '', note: oldVisit?.note || '' };
  });
  return { id: editingId || id('p'), name: data.get('name'), area: data.get('area'), address: data.get('address'), phone: data.get('phone'), agency: data.get('agency'), status: data.get('status'), approvedVisits: Number(data.get('approvedVisits') || 0), usedVisits: Number(data.get('usedVisits') || 0), therapistId, visitsRemaining: Number(data.get('visitsRemaining') || 0), frequency: data.get('frequency'), preferredDays: data.getAll('preferredDay'), preferredTimes: data.get('preferredTimes'), authExpiration: data.get('authExpiration'), notes: data.get('notes'), schedule };
}

function fillForm(patient) {
  editingId = patient.id; formTitle.textContent = `✏️ Edit ${patient.name}`; cancelEdit.hidden = false;
  ['name', 'area', 'address', 'phone', 'agency', 'status', 'frequency', 'authExpiration', 'notes', 'preferredTimes'].forEach((field) => { form.elements[field].value = patient[field] || ''; });
  form.elements.approvedVisits.value = patient.approvedVisits || 0;
  form.elements.usedVisits.value = patient.usedVisits || 0;
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

form.addEventListener('submit', async (event) => { event.preventDefault(); try { const patient = readPatientFromForm(); patients = editingId ? patients.map((item) => (item.id === editingId ? patient : item)) : [...patients, patient]; await persistPatient(patient); resetForm(); resetTherapistForm(); resetAppointmentForm(); renderPatientImportPreview(); render(); showFeedback(editingId ? 'Patient updated.' : 'Patient saved.'); } catch (error) { console.error(error); showFeedback(error.message || 'Patient save failed.', 'error'); } });

therapistForm.addEventListener('submit', async (event) => { event.preventDefault(); try { const data = new FormData(therapistForm); const therapist = { id: editingTherapistId || id('t'), name: data.get('name'), phone: data.get('phone'), email: data.get('email'), role: data.get('role') === 'admin' ? 'admin' : 'therapist', serviceAreas: String(data.get('serviceAreas') || '').split(',').map((area) => area.trim()).filter(Boolean), availability: data.get('availability'), active: data.get('active') === 'on' }; therapists = editingTherapistId ? therapists.map((item) => (item.id === editingTherapistId ? therapist : item)) : [...therapists, therapist]; await persistTherapist(therapist); resetTherapistForm(); render(); showFeedback('Therapist saved. Create or invite the matching Supabase Auth user from your Supabase dashboard.'); } catch (error) { console.error(error); showFeedback(error.message || 'Therapist save failed.', 'error'); } });


appointmentForm.addEventListener('submit', (event) => { event.preventDefault(); runAction(editingAppointment ? 'Appointment updated.' : 'Appointment added.', () => {
  const data = new FormData(appointmentForm);
  const patientId = data.get('patientId');
  const visit = { id: editingAppointment?.visitId || id('v'), day: data.get('day'), time: data.get('time'), status: data.get('status') || 'scheduled', therapistId: data.get('therapistId'), completedBy: '', completedAt: '', note: '' };
  patients = patients.map((patient) => {
    if (patient.id !== patientId && patient.id !== editingAppointment?.patientId) return patient;
    if (editingAppointment && patient.id === editingAppointment.patientId && patient.id !== patientId) return { ...patient, schedule: patient.schedule.filter((item) => item.id !== editingAppointment.visitId) };
    const withoutOld = editingAppointment ? patient.schedule.filter((item) => item.id !== editingAppointment.visitId) : patient.schedule;
    return { ...patient, therapistId: patient.therapistId || visit.therapistId, schedule: [...withoutOld, visit] };
  });
  syncPatients(); resetAppointmentForm(); render();
}); });

navLinks.forEach((link) => link.addEventListener('click', () => setActivePage(link.dataset.pageTarget)));
cancelAppointmentEdit.addEventListener('click', () => runAction('Appointment edit cancelled.', resetAppointmentForm));
cancelTherapistEdit.addEventListener('click', () => runAction('Therapist edit cancelled.', resetTherapistForm));

userSelect.addEventListener('change', () => runAction('User view changed.', () => { currentUserId = userSelect.value; saveSession(currentUserId); resetForm(); renderPatientImportPreview(); render(); }));
visitFilters.addEventListener('change', () => renderAdminDashboard());
scheduleFilters.addEventListener('change', () => renderCalendar());
scheduleFilters.addEventListener('input', () => renderCalendar());
patientSearch.addEventListener('input', () => render());

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
  applyAllSuggestions.disabled = !pendingSuggestions.length;
  suggestions.innerHTML = pendingSuggestions.length ? pendingSuggestions.map((option, index) => `<article class="suggestion"><strong>${escapeHtml(option.day)} at ${escapeHtml(formatTime(option.time))}</strong><span>${escapeHtml(option.reason)}</span><div class="button-row"><button class="primary" data-apply-suggestion="${index}" type="button">Apply Suggestion</button><button data-edit-suggestion="${index}" type="button">Edit & Apply</button></div></article>`).join('') : '<p class="empty error">No suggestion available for this patient.</p>';
  showFeedback(`${pendingSuggestions.length} schedule suggestion${pendingSuggestions.length === 1 ? '' : 's'} generated.`);
}));

generateNextWeek.addEventListener('click', () => runAction('Next week suggestions generated.', () => {
  pendingSuggestions = visiblePatients().flatMap((patient) => buildScheduleSuggestions(patient, patients, therapists).slice(0, 1).map((option) => ({ ...option, patientId: patient.id })));
  applyAllSuggestions.disabled = !pendingSuggestions.length;
  suggestions.innerHTML = pendingSuggestions.length ? pendingSuggestions.map((option, index) => `<article class="suggestion"><strong>${escapeHtml(therapistName(option.therapistId))} · ${escapeHtml(option.day)} at ${escapeHtml(formatTime(option.time))}</strong><span>${escapeHtml(option.reason)}</span><button class="primary" data-apply-suggestion="${index}" type="button">Apply Suggestion</button></article>`).join('') : '<p class="empty error">No next week suggestions available.</p>';
}));
applyAllSuggestions.addEventListener('click', () => runAction('All suggestions applied.', () => {
  patients = patients.map((patient) => ({ ...patient, schedule: [...patient.schedule, ...pendingSuggestions.filter((option) => (option.patientId || optimizePatient.value) === patient.id).map((option) => ({ id: id('v'), day: option.day, time: option.time, status: 'scheduled', therapistId: option.therapistId, completedBy: '', completedAt: '', note: '' }))] }));
  syncPatients(); pendingSuggestions = []; applyAllSuggestions.disabled = true; suggestions.innerHTML = '<p class="empty">All suggestions applied.</p>'; render();
}));
exportReportCsv.addEventListener('click', () => runAction('Report CSV exported.', () => {
  const reports = buildReports(patients, therapists, visitLogs);
  const rows = [['Report','Name','Value'], ...reports.productivity.map((item) => ['Therapist productivity', item.therapist.name, `${item.completedThisWeek} completed; ${item.pending} pending; ${item.missed} missed`]), ['Weekly visit total', '', reports.weeklyVisitTotal]];
  const blob = new Blob([rows.map((row) => row.map(csvEscape).join(',')).join('\n')], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `pt-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
}));

document.addEventListener('click', (event) => {
  const target = event.target.closest('button[data-edit], button[data-delete], button[data-toggle-therapist], button[data-delete-therapist], button[data-edit-therapist], button[data-edit-appointment], button[data-delete-appointment], button[data-apply-suggestion], button[data-edit-suggestion], button[data-visit-action], button[data-apply-all-suggestions], a.action');
  if (!target) return;
  const { edit: editId, delete: deleteId, toggleTherapist, deleteTherapist, editTherapist, editAppointment, deleteAppointment, applySuggestion, editSuggestion, visitAction, patientId: actionPatientId, visitId: actionVisitId } = target.dataset;
  if (target.matches('a.action')) showFeedback(`${target.textContent.trim()} opened.`);
  if (visitAction) runAction(`Visit marked ${VISIT_STATUS_LABELS[visitAction]}.`, () => {
    const note = visitAction === 'done' ? (prompt('Optional completion note') || '') : '';
    const completedAt = new Date();
    const therapist = currentUser();
    let nextLog = null;
    patients = patients.map((patient) => {
      if (patient.id !== actionPatientId) return patient;
      let shouldReduceRemaining = false;
      const schedule = patient.schedule.map((visit) => {
        if (visit.id !== actionVisitId) return visit;
        shouldReduceRemaining = visitAction === 'done' && visit.status !== 'done';
        const updated = { ...visit, status: visitAction, completedBy: visitAction === 'done' ? therapist.id : visit.completedBy, completedAt: visitAction === 'done' ? completedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : visit.completedAt, note };
        if (visitAction === 'done') nextLog = createVisitLog({ patient, visit: updated, therapist, status: 'done', note, completedAt });
        return updated;
      });
      return {
        ...patient,
        usedVisits: shouldReduceRemaining ? Number(patient.usedVisits || 0) + 1 : Number(patient.usedVisits || 0),
        visitsRemaining: shouldReduceRemaining ? Math.max(0, Number(patient.visitsRemaining || 0) - 1) : Number(patient.visitsRemaining || 0),
        schedule,
      };
    });
    if (nextLog) { visitLogs = upsertVisitLog(visitLogs, nextLog); persistVisitLog(nextLog); }
    syncPatients(); render();
  });
  if (editId) runAction('Patient loaded for editing.', () => fillForm(patients.find((patient) => patient.id === editId)));
  if (deleteId && confirm('Delete this patient?')) runAction('Patient deleted.', async () => { patients = patients.filter((patient) => patient.id !== deleteId); savePatients(patients); if (sharedMode) await deletePatientShared(deleteId); render(); });
  if (editTherapist) runAction('Therapist loaded for editing.', () => fillTherapistForm(editTherapist));
  if (deleteTherapist && confirm('Delete this therapist? Patients will become unassigned.')) runAction('Therapist deleted.', async () => { therapists = therapists.filter((therapist) => therapist.id !== deleteTherapist); patients = patients.map((patient) => patient.therapistId === deleteTherapist ? { ...patient, therapistId: '' } : patient); saveTherapists(therapists); syncPatients(); if (sharedMode) await deleteTherapistShared(deleteTherapist); render(); });
  if (toggleTherapist) runAction('Therapist status updated.', () => { therapists = therapists.map((therapist) => therapist.id === toggleTherapist ? { ...therapist, active: !therapist.active } : therapist); syncTherapists(); render(); });
  if (editAppointment) runAction('Appointment loaded for editing.', () => { const [patientId, visitId] = editAppointment.split('|'); fillAppointmentForm(patientId, visitId); });
  if (deleteAppointment && confirm('Delete this appointment?')) runAction('Appointment deleted.', () => { const [patientId, visitId] = deleteAppointment.split('|'); patients = patients.map((patient) => patient.id === patientId ? { ...patient, schedule: patient.schedule.filter((visit) => visit.id !== visitId) } : patient); syncPatients(); render(); });
  if (applySuggestion !== undefined || editSuggestion !== undefined) runAction('Schedule suggestion applied.', () => {
    const suggestionIndex = Number(applySuggestion ?? editSuggestion);
    const option = pendingSuggestions[suggestionIndex];
    const patientId = option.patientId || optimizePatient.value;
    if (!patientId) throw new Error('Select a patient before applying a suggestion.');
    if (!option) throw new Error('That schedule suggestion is no longer available. Run Optimize Schedule again.');
    const time = editSuggestion !== undefined ? prompt('Edit suggested time (HH:MM)', option.time) || option.time : option.time;
    patients = patients.map((patient) => patient.id === patientId ? { ...patient, schedule: [...patient.schedule, { id: id('v'), day: option.day, time, status: 'scheduled', therapistId: option.therapistId, completedBy: '', completedAt: '', note: '' }] } : patient);
    syncPatients(); suggestions.innerHTML = '<p class="empty">Suggestion applied. Review the calendar and edit the patient if needed.</p>'; render();
  });
});

document.addEventListener('change', (event) => {
  const visitStatus = event.target.dataset.visitStatus;
  if (!visitStatus) return;
  runAction('Visit status updated.', () => {
    const [patientId, visitId] = visitStatus.split('|');
    patients = patients.map((patient) => patient.id === patientId ? { ...patient, schedule: patient.schedule.map((visit) => visit.id === visitId ? { ...visit, status: event.target.value, completedBy: event.target.value === 'done' ? currentUser().id : visit.completedBy } : visit) } : patient);
    syncPatients(); render();
  });
});

exportPatientsCsv.addEventListener('click', () => runAction('Patients CSV exported.', () => exportPatients('csv')));
exportPatientsExcel.addEventListener('click', () => runAction('Patients Excel exported.', () => exportPatients('xlsx')));
photoImport.addEventListener('click', () => showFeedback('Photo import will require OCR later and is coming soon.', 'error'));
clearPatientImport.addEventListener('click', () => runAction('Import preview cleared.', () => { pendingPatientImport = []; patientImportFile.value = ''; renderPatientImportPreview(); }));
sampleImport.addEventListener('click', () => runAction('Sample CSV parsed.', () => { pendingPatientImport = rowsToPatients(parseCsv(SAMPLE_CSV)); renderPatientImportPreview(); }));
patientImportFile.addEventListener('change', async () => { try { const file = patientImportFile.files?.[0]; if (!file) return; pendingPatientImport = rowsToPatients(await parsePatientImportFile(file)); renderPatientImportPreview(); showFeedback('Patient import preview ready.'); } catch (error) { console.error('Patient import failed', error); showFeedback(error.message || 'Patient import failed.', 'error'); } });
confirmPatientImport.addEventListener('click', () => runAction('Patients imported.', async () => { if (currentUser().role !== 'admin') throw new Error('Only admins can import patients.'); const incoming = pendingPatientImport.filter((item) => !item.duplicate && !item.errors.length).map((item) => item.patient); patients = [...patients, ...incoming]; syncPatients(); if (sharedMode && incoming.length) await savePatientImportShared({ fileName: patientImportFile.files?.[0]?.name || 'manual/sample import', importedBy: currentUserId, rowCount: pendingPatientImport.length, importedCount: incoming.length, errorCount: pendingPatientImport.filter((item) => item.errors.length).length, rows: pendingPatientImport }); pendingPatientImport = []; patientImportFile.value = ''; renderPatientImportPreview(); render(); }));

exportButton.addEventListener('click', () => runAction('Backup exported.', () => { const blob = new Blob([JSON.stringify({ patients, therapists, visitLogs }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `pt-scheduler-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href); }));

importInput.addEventListener('change', async () => { try { const file = importInput.files?.[0]; if (!file) return; const backup = JSON.parse(await file.text()); patients = Array.isArray(backup.patients) ? backup.patients : patients; therapists = Array.isArray(backup.therapists) ? backup.therapists : therapists; visitLogs = Array.isArray(backup.visitLogs) ? backup.visitLogs : visitLogs; saveVisitLogs(visitLogs); syncPatients(); syncTherapists(); importInput.value = ''; render(); showFeedback('Backup imported.'); } catch (error) { console.error('Import failed', error); showFeedback('Import failed. Choose a valid backup JSON file.', 'error'); } });

cancelEdit.addEventListener('click', () => runAction('Edit cancelled.', resetForm));
authForm.addEventListener('submit', async (event) => { event.preventDefault(); if (!sharedMode) return showFeedback('Demo mode is active. Add Supabase keys to enable login.', 'error'); try { const data = new FormData(authForm); await signIn(data.get('email'), data.get('password')); await initApp(); showFeedback('Logged in.'); } catch (error) { console.error(error); showFeedback(error.message || 'Login failed.', 'error'); } });
signupButton.addEventListener('click', async () => { if (!sharedMode) return showFeedback('Demo mode is active. Add Supabase keys to enable accounts.', 'error'); try { const data = new FormData(authForm); await signUp(data.get('email'), data.get('password'), data.get('name')); showFeedback('Account created. Check email if confirmation is enabled, then log in.'); } catch (error) { console.error(error); showFeedback(error.message || 'Signup failed.', 'error'); } });
logoutButton.addEventListener('click', async () => { if (sharedMode) await signOut(); authSession = null; render(); showFeedback('Logged out.'); });

resetButton.addEventListener('click', () => runAction('Demo data reset.', () => { patients = initialPatients; therapists = initialTherapists; visitLogs = []; currentUserId = 't-admin'; savePatients(patients); saveTherapists(therapists); saveVisitLogs(visitLogs); saveSession(currentUserId); pendingSuggestions = []; suggestions.innerHTML = ''; resetForm(); renderPatientImportPreview(); render(); }));

async function initApp() { try { authSession = sharedMode ? await getSession() : null; logoutButton.hidden = !authSession; authForm.hidden = Boolean(authSession); if (sharedMode && authSession) { currentUserId = authSession.user.id; await refreshSharedData(); } } catch (error) { console.error('Supabase unavailable, using cache', error); sharedMode = false; showFeedback('Supabase unavailable. Using local cache fallback.', 'error'); } resetForm(); renderPatientImportPreview(); render(); }
if (supabaseClient) supabaseClient.auth.onAuthStateChange(() => initApp());
initApp();
