'use strict';

const Medtech = (() => {
  const B = Bioscan;
  let tab = 'Ready';
  let query = '';
  let categoryFilter = '';
  let serviceFilter = '';
  let managementRefresh;
  const identity = () => JSON.parse(sessionStorage.getItem('bioscan-prototype:v1:staff-identity') || 'null');
  function account(state) {
    const user = identity();
    return state.staffAccounts.find(item => item.username === user?.username && item.active !== false && item.role === user.role);
  }
  function canSee(state, serviceId) {
    const user = account(state);
    return user && (['admin', 'manager'].includes(user.role) || (user.role === 'medtech' && (user.serviceIds || []).includes(serviceId)));
  }
  function paidRows(state) {
    return state.sales.flatMap(sale => sale.items.filter(item => canSee(state, item.id)).map(item => {
      const care = state.careRecords.find(row => row.saleId === sale.id && row.serviceId === item.id);
      return { saleId: sale.id, serviceId: item.id, service: item.label, clientId: sale.clientId,
        client: state.profiles.find(p => p.id === sale.clientId)?.fullName || sale.client,
        reservation: sale.reservation, at: sale.at, status: care?.status || 'Ready', care };
    })).sort((a, b) => b.at.localeCompare(a.at));
  }
  function incomingRows(state) {
    return state.reservations.filter(r => r.status === 'Confirmed' && r.date >= B.day() && !state.sales.some(s => s.reservation === r.code))
      .flatMap(r => r.items.filter(item => canSee(state, item.id)).map(item => ({
        reservation: r.code, clientId: r.clientId, client: state.profiles.find(p => p.id === r.clientId)?.fullName || 'Client',
        serviceId: item.id, service: item.label, at: r.date + 'T' + r.time + ':00+08:00', status: 'Awaiting payment'
      }))).sort((a, b) => a.at.localeCompare(b.at));
  }
  function referrals(state) {
    return state.referrals.filter(r => canSee(state, r.serviceId)).slice().sort((a, b) => b.at.localeCompare(a.at));
  }
  const matches = row => [row.client, row.service, row.reservation, row.saleId].some(value => String(value || '').toLowerCase().includes(query.trim().toLowerCase()));
  function visibleRows(state) {
    const allowed = B.services(state).filter(s => canSee(state, s.id)).sort((a, b) => B.alphabetical(a.label, b.label));
    if (!allowed.some(s => s.category === categoryFilter)) categoryFilter = '';
    const options = allowed.filter(s => !categoryFilter || s.category === categoryFilter);
    if (!options.some(s => s.id === serviceFilter)) serviceFilter = '';
    const ids = new Set(options.filter(s => !serviceFilter || s.id === serviceFilter).map(s => s.id));
    const filter = rows => rows.filter(r => ids.has(r.serviceId) && matches(r));
    return { paid: filter(paidRows(state)), incoming: filter(incomingRows(state)), referred: filter(referrals(state)), allowed, options };
  }
  function table(headers, rows, empty) {
    return rows.length ? '<div class="table-wrap care-table"><table><thead><tr>' + headers.map(h => '<th scope="col">' + h + '</th>').join('') +
      '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' : '<p class="empty">' + empty + '</p>';
  }
  function viewButton(row) {
    return '<button type="button" class="button secondary small" data-care-view data-sale="' + B.safe(row.saleId || '') + '" data-reservation="' + B.safe(row.reservation || '') + '" data-care-service="' + B.safe(row.serviceId) + '">View Client</button>';
  }
  function content(state, management = false) {
    const { paid, incoming, referred, allowed, options } = visibleRows(state);
    const counts = { Ready: paid.filter(r => r.status === 'Ready').length, Incoming: incoming.length,
      Completed: paid.filter(r => r.status === 'Completed').length, Referrals: referred.length };
    const intro = management ? 'Review paid-service progress and MedTech referrals across the clinic.' : 'You share these lists with other MedTechs assigned to the same services. Incoming reservations become ready after payment.';
    let rows;
    if (tab === 'Referrals') {
      rows = table(['Client / service', 'Referral', 'Reason', 'Return / destination', 'Recorded by', 'Status', ''], referred.filter(matches).map(row => {
        const care = state.careRecords.find(c => c.saleId === row.saleId && c.serviceId === row.serviceId);
        return ['<strong>' + B.safe(row.client) + '</strong><small>' + B.safe(row.service) + '</small>', B.safe(row.type) + '<small>' + B.stamp(row.at) + '</small>',
          B.safe(row.reason), (row.returnDate ? B.dateLabel(row.returnDate) : 'No return date') + (row.clinic ? '<small>' + B.safe(row.clinic) + '</small>' : ''),
          B.safe(row.by), B.status(care?.status === 'Completed' ? 'Completed' : 'Referred'), viewButton(row)];
      }), 'No referrals match this view.');
    } else {
      const list = tab === 'Incoming' ? incoming : paid.filter(r => r.status === tab);
      rows = table(['Client', 'Service', tab === 'Incoming' ? 'Appointment' : 'Payment recorded', 'Status', ''], list.filter(matches).map(row => [
        '<strong>' + B.safe(row.client) + '</strong><small>' + B.safe(row.reservation || row.saleId) + '</small>',
        B.safe(row.service), B.stamp(row.at), B.status(row.status), viewButton(row)
      ]), tab === 'Ready' ? 'No paid services are waiting. Patients appear here after cashier checkout.' : 'No patients match this view.');
    }
    return '<p class="quiet">' + intro + '</p><div class="care-tabs" role="group" aria-label="Patient lists">' + Object.entries(counts).map(([label, count]) =>
      '<button type="button" class="button ' + (tab === label ? 'primary' : 'secondary') + '" data-care-tab="' + label + '" aria-pressed="' + (tab === label) + '">' + label + ' <span>' + count + '</span></button>').join('') +
      '</div><div class="care-filters"><label>Category<select id="care-category"><option value="">All categories</option>' + [...new Set(allowed.map(s => s.category))].sort(B.alphabetical).map(c => '<option' + (c === categoryFilter ? ' selected' : '') + '>' + B.safe(c) + '</option>').join('') + '</select></label>' +
      '<label>Service<select id="care-service"><option value="">All services</option>' + options.map(s => '<option value="' + B.safe(s.id) + '"' + (s.id === serviceFilter ? ' selected' : '') + '>' + B.safe(s.label) + '</option>').join('') + '</select></label>' +
      '<label>Find a patient or reference<input id="care-search" type="search" value="' + B.safe(query) + '" placeholder="Name, service, or reference"></label></div>' +
      '<p class="care-scroll-hint quiet">Swipe the table sideways to see all details and actions.</p><div id="care-rows">' + rows + '</div>';
  }
  function bind(region, management = false, refresh = render) {
    region.querySelectorAll('[data-care-tab]').forEach(button => button.addEventListener('click', () => {
      tab = button.dataset.careTab;
      refresh();
      Staff.app.querySelector('[data-care-tab="' + tab + '"]')?.focus();
    }));
    region.querySelector('#care-search')?.addEventListener('input', event => {
      query = event.target.value;
      const position = event.target.selectionStart;
      refresh();
      const field = Staff.app.querySelector('#care-search');
      field.focus({ preventScroll: true });
      field.setSelectionRange(position, position);
    });
    for (const id of ['care-category', 'care-service']) region.querySelector('#' + id)?.addEventListener('change', event => {
      if (id === 'care-category') { categoryFilter = event.target.value; serviceFilter = ''; }
      else serviceFilter = event.target.value;
      refresh();
      Staff.app.querySelector('#' + id)?.focus({ preventScroll: true });
    });
    bindViews(region, management);
    if (management) managementRefresh = refresh;
  }
  function bindViews(region, management) {
    region.querySelectorAll('[data-care-view]').forEach(button => {
      button.onclick = () => showClient(button.dataset.sale, button.dataset.reservation, button.dataset.careService, management);
    });
  }
  function healthMarkup(health = {}) { return B.healthSummary(health); }
  function showClient(saleId, reservationCode, serviceId, management = false) {
    const state = B.read();
    if (!canSee(state, serviceId)) return;
    const row = (saleId ? paidRows(state) : incomingRows(state)).find(r => r.serviceId === serviceId && (saleId ? r.saleId === saleId : r.reservation === reservationCode));
    if (!row) return;
    const profile = state.profiles.find(p => p.id === row.clientId);
    const reservation = state.reservations.find(r => r.code === row.reservation);
    if (!profile) return;
    Staff.dialog(row.client, '<div class="care-context"><div><strong>' + B.safe(row.service) + '</strong><small>' + B.safe(row.saleId || row.reservation) + '</small></div>' + B.status(row.status) + '</div>' +
      B.clientSummary(state, profile, false, management ? null : account(state).serviceIds || []) +
      (reservation?.health ? '<details class="profile-record"><summary>Health information submitted for this appointment</summary><div class="profile-record-body">' + healthMarkup(reservation.health) + '</div></details>' : '') +
      (row.care?.completedAt ? '<p>Completed by ' + B.safe(row.care.by) + ' · ' + B.stamp(row.care.completedAt) + '</p>' : '') +
      (reservation?.consent ? '<p class="quiet">Data consent and preparation acknowledgment recorded ' + B.stamp(reservation.consent.at) + '.</p>' : '') +
      '<h3>Referral history for this service</h3>' + (state.referrals.filter(r => r.saleId === saleId && r.serviceId === serviceId).map(r =>
        '<p><strong>' + B.safe(r.type) + '</strong> · ' + B.safe(r.reason) + (r.returnDate ? '<br>Return: ' + B.dateLabel(r.returnDate) : '') +
        (r.clinic ? '<br>Clinic: ' + B.safe(r.clinic) : '') + '<br><small>' + B.safe(r.by) + ' · ' + B.stamp(r.at) + '</small></p>').join('') || '<p class="quiet">No referrals recorded.</p>') +
      '<p class="message" id="care-message" role="status"></p>' +
      (!management && saleId && row.status !== 'Completed' ? '<div class="actions"><button type="button" class="button primary" data-complete-service>Mark service complete</button>' +
        (row.status === 'Ready' ? '<button type="button" class="button secondary" data-refer-service>Record referral</button>' : '') + '</div>' : '') +
      (!saleId ? '<p class="quiet">Awaiting cashier payment. Completion and referrals become available after payment.</p>' : ''));
    Staff.modal.querySelector('[data-complete-service]')?.addEventListener('click', () => {
      Staff.dialog('Complete ' + row.service, '<p>Confirm that ' + B.safe(row.client) + ' has completed this service. Other services in the same sale keep their own status.</p>', async () => {
        await complete(saleId, serviceId);
        refresh(management);
      }, { submitLabel: 'Confirm completion' });
    });
    Staff.modal.querySelector('[data-refer-service]')?.addEventListener('click', () => referralForm(row, management));
  }
  function editable(state, saleId, serviceId) {
    const user = account(state);
    if (user?.role !== 'medtech' || !canSee(state, serviceId)) throw Error('This service is not assigned to your MedTech account.');
    const row = paidRows(state).find(r => r.saleId === saleId && r.serviceId === serviceId);
    if (!row || row.status === 'Completed') throw Error('This service is unavailable or already completed. Refresh the patient list.');
    return { user, row };
  }
  async function complete(saleId, serviceId) {
    return B.update(state => {
      const { user } = editable(state, saleId, serviceId);
      const care = state.careRecords.find(r => r.saleId === saleId && r.serviceId === serviceId);
      const entry = { saleId, serviceId, status: 'Completed', completedAt: new Date().toISOString(), by: user.username };
      if (care) Object.assign(care, entry); else state.careRecords.push(entry);
      B.audit(state, B.roles.medtech, 'Service completed', saleId + ' · ' + serviceId, user.username);
    });
  }
  function referralForm(row, management) {
    Staff.dialog('Record referral', '<p>' + B.safe(row.client) + ' · ' + B.safe(row.service) + '</p>' +
      '<label>Referral type<select name="referralType"><option>Return to BioScan</option><option>Another clinic</option></select></label>' +
      '<label>Reason<textarea name="reason" maxlength="500" required></textarea></label>' +
      '<label id="referral-date-label">Return date<input name="returnDate" type="date" min="' + B.day() + '" required></label>' +
      '<label id="referral-clinic-label" hidden>Receiving clinic<input name="clinic" maxlength="150" disabled></label>', async form => {
        await refer(row.saleId, row.serviceId, { type: form.elements.referralType.value, reason: form.elements.reason.value.trim(),
          returnDate: form.elements.returnDate.value, clinic: form.elements.clinic.value.trim() });
        refresh(management);
      }, { submitLabel: 'Save referral' });
    const form = Staff.modal.querySelector('form');
    form.elements.referralType.addEventListener('change', () => {
      const external = form.elements.referralType.value === 'Another clinic';
      Staff.modal.querySelector('#referral-clinic-label').hidden = !external;
      form.elements.clinic.required = external;
      form.elements.clinic.disabled = !external;
      form.elements.returnDate.required = !external;
      Staff.modal.querySelector('#referral-date-label').firstChild.textContent = external ? 'Return date (optional)' : 'Return date';
    });
  }
  async function refer(saleId, serviceId, values) {
    return B.update(state => {
      const { user, row } = editable(state, saleId, serviceId);
      if (row.status !== 'Ready') throw Error('A referral has already been recorded for this service. Refresh the patient list.');
      if (!['Return to BioScan', 'Another clinic'].includes(values.type) || !values.reason || values.reason.length > 500)
        throw Error('Choose a referral type and enter a reason (up to 500 characters).');
      if ((values.type === 'Return to BioScan' && !values.returnDate) || (values.returnDate && (!/^\d{4}-\d{2}-\d{2}$/.test(values.returnDate) || values.returnDate < B.day())))
        throw Error('Choose a return date of today or later.');
      if (values.type === 'Another clinic' && !values.clinic) throw Error('Enter the receiving clinic.');
      state.referrals.push({ ...values, clinic: values.type === 'Another clinic' ? values.clinic.slice(0, 150) : '',
        id: B.uid('REF'), saleId, serviceId, clientId: row.clientId, client: row.client, service: row.service, reservation: row.reservation,
        at: new Date().toISOString(), by: user.username });
      state.careRecords.push({ saleId, serviceId, status: 'Referred', by: user.username });
      B.audit(state, B.roles.medtech, 'Service referral recorded', saleId + ' · ' + serviceId + ' · ' + values.type, user.username);
    });
  }
  function refresh(management) {
    if (management) managementRefresh?.(); else render();
  }
  function render() {
    const state = B.read();
    const user = account(state);
    if (user?.role !== 'medtech') return;
    const services = B.services(state).filter(s => (user.serviceIds || []).includes(s.id));
    Staff.app.innerHTML = '<div class="workspace-title"><div><h1>MedTech workspace</h1><p>' + B.safe(user.fullName) + '</p></div>' +
      '<button type="button" class="button secondary" data-care-refresh>Refresh lists</button></div>' +
      '<section class="panel care-workspace"><details class="assigned-summary"><summary>Your assigned services (' + services.length + ')</summary><p>' +
      B.safe(services.map(s => s.label).join(', ') || 'No services assigned. Ask the Administrator to update your account.') + '</p></details>' + content(state) + '</section>';
    bind(Staff.app);
    Staff.app.querySelector('[data-care-refresh]').addEventListener('click', render);
  }
  function reset() { tab = 'Ready'; query = ''; categoryFilter = ''; serviceFilter = ''; }
  function setFilters(category = '', service = '') { categoryFilter = category; serviceFilter = service; }
  function assignmentFields(selected = []) {
    return '<fieldset class="service-assignments" id="medtech-assignments"><legend>MedTech service assignments</legend><p class="quiet">MedTech accounts see only patients who reserved or paid for these services. Assign at least one service to a MedTech.</p><div class="assignment-list">' +
      B.services().map(s => '<label class="check-row"><input type="checkbox" name="assignedService" value="' + s.id + '"' + (selected.includes(s.id) ? ' checked' : '') + '><span>' + B.safe(s.label) + '</span></label>').join('') + '</div></fieldset>';
  }
  function bindAssignments(form) {
    const fieldset = form.querySelector('#medtech-assignments');
    if (!fieldset) return;
    const update = () => { fieldset.hidden = form.elements.role.value !== 'medtech'; fieldset.disabled = fieldset.hidden; };
    form.elements.role.addEventListener('change', update);
    update();
  }
  return { render, content, bind, reset, setFilters, visibleRows, complete, refer, paidRows, incomingRows, assignmentFields, bindAssignments };
})();
