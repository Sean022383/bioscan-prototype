'use strict';

const Management = (() => {
  const B = Bioscan;
  let section = 'approvals';
  let reservationDate = '';
  let reservationStatus = '';
  let reservationQuery = '';
  let serviceQuery = '';
  let reportPeriod = '30';
  let reportDate = B.day();
  let reportStart = B.day(-29);
  let reportEnd = B.day();

  const tools = {
    manager: [['approvals', 'Pending Approvals'], ['care', 'Patient Care & Referrals'], ['reservations', 'Reservations'], ['services', 'Diagnostic Services'], ['bundles', 'Service Bundles'],
      ['profiles', 'Client Profiles'], ['closures', 'Availability & Closures'], ['sms', 'SMS Log'], ['issues', 'Payment & Backup Review'],
      ['coupons', 'Coupons'], ['reports', 'Financial and Discount Reports'], ['backup', 'Database Operations'],
      ['corrections', 'Transaction Corrections']],
    admin: [['approvals', 'Pending Approvals'], ['care', 'Patient Care & Referrals'], ['reservations', 'Reservations'], ['services', 'Diagnostic Services'], ['bundles', 'Service Bundles'],
      ['profiles', 'Client Profiles'], ['closures', 'Availability & Closures'], ['sms', 'SMS Log'], ['issues', 'Payment & Backup Review'],
      ['staff', 'Staff Accounts'], ['roles', 'Roles and Permissions'], ['clinic', 'Clinic Information'], ['settings', 'System Settings'],
      ['audit', 'Audit Log'], ['backup', 'Backup and Recovery'], ['corrections', 'Transaction Corrections']]
  };

  function reset() { section = 'approvals'; reservationDate = ''; reservationStatus = ''; reservationQuery = ''; serviceQuery = ''; reportPeriod = '30'; reportDate = B.day(); reportStart = B.day(-29); reportEnd = B.day(); Office.reset(); }

  function table(headers, rows, fallback) {
    if (!rows.length) return '<p class="empty">' + B.safe(fallback) + '</p>';
    return '<div class="table-wrap management-table" role="region" aria-label="Records" tabindex="0"><table><thead><tr>' +
      headers.map(label => '<th scope="col">' + B.safe(label) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(row => '<tr>' + row.map((value, index) => index === 0 ? '<th scope="row">' + value + '</th>' :
        '<td>' + value + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  function note(text) { return '<p class="quiet section-note">' + B.safe(text) + '</p>'; }
  const amount = value => '<span class="numeric">' + B.money(value) + '</span>';

  function render(role) {
    const available = tools[role];
    if (!available.some(([id]) => id === section)) section = 'approvals';
    Staff.app.innerHTML = '<div class="workspace-title management-title"><div><h1>' + B.roles[role] + '</h1>' +
      '<p>Clinic operations</p></div></div><div class="management-grid">' +
      '<nav class="panel management-nav" aria-label="Staff tools">' + available.map(([id, label]) =>
        '<button type="button" data-section="' + id + '"' + (section === id ? ' aria-current="page"' : '') +
        '>' + label + '</button>').join('') + '</nav><section class="panel management-content" id="management-content">' +
      '<h2 id="management-heading" tabindex="-1"></h2><p id="management-message" class="message" role="status"></p><div id="management-data"></div></section></div>';
    Staff.app.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', async () => {
      if (button.dataset.section === 'backup' && role === 'admin') {
        try { await B.update(state => { if (state.settings.automaticSync) Recovery.maintain(state); }); }
        catch (error) { announce(error.message, true); return; }
      }
      section = button.dataset.section;
      render(role);
      Staff.app.querySelector('#management-heading').focus();
    }));
    draw(role);
  }

  function draw(role) {
    const title = Staff.app.querySelector('#management-heading');
    const region = Staff.app.querySelector('#management-data');
    title.textContent = tools[role].find(([id]) => id === section)[1];
    const state = B.read();
    const pages = { approvals, reservations, services, coupons, reports, staff, audit, backup, care: state => Medtech.content(state, true), bundles: CatalogAdmin.page, ...Office.pages };
    region.innerHTML = pages[section](state, role, table, note);
    Office.bind(region, role, draw, announce, table);
    if (section === 'bundles') CatalogAdmin.bind(region, role, () => draw(role));
    if (section === 'care') Medtech.bind(region, true, () => draw(role));
    region.querySelectorAll('[data-db-action]').forEach(button => button.addEventListener('click', () => databaseAction(role, button.dataset.dbAction)));
    region.querySelectorAll('[data-restore-backup]').forEach(button => button.addEventListener('click', () => restoreBackup(role, button.dataset.restoreBackup)));
    region.querySelector('[data-create-service]')?.addEventListener('click', () => createService(role));
    region.querySelector('[data-create-coupon]')?.addEventListener('click', () => createCoupon(role));
    region.querySelectorAll('[data-edit-coupon]').forEach(button => button.addEventListener('click', () => createCoupon(role, button.dataset.editCoupon)));
    region.querySelectorAll('[data-report-export]').forEach(button => button.addEventListener('click', () => exportReport(button.dataset.reportExport)));
    for (const id of ['report-anchor', 'report-start', 'report-end']) region.querySelector('#' + id)?.addEventListener('change', event => {
      if (id === 'report-anchor') reportDate = event.target.value;
      if (id === 'report-start') reportStart = event.target.value;
      if (id === 'report-end') reportEnd = event.target.value;
      draw(role);
      region.querySelector('#' + id)?.focus();
    });
    region.querySelector('[data-create-staff]')?.addEventListener('click', () => createStaff(role));
    region.querySelectorAll('[data-review]').forEach(button => button.addEventListener('click', () => review(role, button.dataset.review)));
    region.querySelectorAll('[data-reschedule]').forEach(button => button.addEventListener('click', () => reschedule(role, button.dataset.reschedule)));
    region.querySelectorAll('[data-cancel]').forEach(button => button.addEventListener('click', () => cancelReservation(role, button.dataset.cancel)));
    region.querySelectorAll('#service-admin-list [data-service]').forEach(button => button.addEventListener('click', () => editService(role, button.dataset.service)));
    region.querySelector('[data-capacity]')?.addEventListener('click', () => editCapacity(role));
    region.querySelector('#reservation-filter')?.addEventListener('change', event => {
      reservationDate = event.target.value;
      draw(role);
      region.querySelector('#reservation-filter').focus();
    });
    region.querySelector('#reservation-status')?.addEventListener('change', event => {
      reservationStatus = event.target.value;
      draw(role);
      region.querySelector('#reservation-status').focus();
    });
    region.querySelector('#reservation-search')?.addEventListener('input', event => {
      reservationQuery = event.target.value;
      const cursor = event.target.selectionStart;
      draw(role);
      const input = region.querySelector('#reservation-search');
      input.focus({ preventScroll: true });
      input.setSelectionRange(cursor, cursor);
    });
    region.querySelector('#management-search')?.addEventListener('input', event => {
      serviceQuery = event.target.value;
      region.querySelector('#service-admin-list').innerHTML = serviceTable(B.read());
      region.querySelectorAll('#service-admin-list [data-service]').forEach(button => button.addEventListener('click', () => editService(role, button.dataset.service)));
    });
    region.querySelector('#report-period')?.addEventListener('change', event => {
      reportPeriod = event.target.value;
      draw(role);
      region.querySelector('#report-period').focus();
    });
  }

  function announce(text, error = false) { B.message(Staff.app.querySelector('#management-message'), text, error); }

  function sync(role) {
    if (!Staff.app.querySelector('#management-data')) return;
    if (section === 'services') {
      const search = Staff.app.querySelector('#management-search');
      if (search && document.activeElement === search) search.dispatchEvent(new Event('input'));
      else draw(role);
      return;
    }
    if (['bundles', 'care', 'approvals', 'reservations', 'audit', 'reports', 'corrections', 'coupons', 'staff', 'backup', 'profiles', 'closures', 'sms', 'issues', 'settings', 'clinic', 'roles'].includes(section)) {
      const active = document.activeElement;
      if (['reservation-filter', 'reservation-status', 'reservation-search', 'client-directory-search'].includes(active?.id)) return;
      draw(role);
    }
  }

  function approvals(state) {
    const items = state.approvals.filter(item => item.status === 'Pending' && item.path === 'dashboard');
    const decisions = state.approvals.filter(item => ['Approved', 'Declined'].includes(item.status)).slice().reverse();
    return note('Review Manual Discount Override requests sent by the front desk.') +
      '<div class="queue-label"><strong>' + items.length + '</strong> ' + (items.length === 1 ? 'request' : 'requests') + ' waiting</div>' +
      table(['Client', 'Requested amount', 'Status', 'Action'], items.map(item => [
        B.safe(item.client) + '<small>' + B.safe(item.reservation || item.saleId) + '</small>', amount(item.amount),
        B.status('Pending'), '<button class="button secondary small" data-review="' + item.id + '">Review Request</button>'
      ]), 'No requests are waiting for approval.') + '<h3 class="management-subhead">Recent decisions</h3>' +
      table(['Client', 'Amount', 'Decision', 'Authorized by'], decisions.slice(0, 12).map(item => [
        B.safe(item.client), amount(item.amount), B.status(item.status), B.roles[item.by]
      ]), 'Approval decisions will appear here.');
  }

  function review(role, id) {
    const item = B.read().approvals.find(entry => entry.id === id && entry.status === 'Pending');
    if (!item) return;
    Staff.dialog('Review Manual Discount Override',
      '<dl class="detail-list"><div><dt>Client</dt><dd>' + B.safe(item.client) + '</dd></div>' +
      '<div><dt>Sale</dt><dd>' + B.safe(item.saleId) + '</dd></div>' +
      '<div><dt>Diagnostic Services</dt><dd>' + B.safe(item.items.join(', ')) + '</dd></div>' +
      '<div><dt>Subtotal</dt><dd>' + B.money(item.subtotal) + '</dd></div>' +
      '<div><dt>Requested discount</dt><dd>' + B.money(item.amount) + '</dd></div>' +
      '<div><dt>Reason</dt><dd>' + B.safe(item.reason) + '</dd></div></dl>' +
      '<label>Decision<select name="decision" required><option value="">Choose a decision</option>' +
      '<option>Approved</option><option>Declined</option></select></label>', async form => {
      const decision = form.elements.decision.value;
      await Cashier.decide(id, role, decision, 'dashboard');
      draw(role);
      announce('Request ' + decision.toLowerCase() + '. The cashier can continue the sale.');
    }, { submitLabel: 'Record Decision' });
  }

  function reservations(state) {
    const records = B.filterReservations(state, reservationDate, reservationStatus, reservationQuery);
    return note('Filter Reservations by appointment date and status. Authorized staff can reschedule or cancel a Confirmed Reservation.') +
      '<label>Find reservation<input id="reservation-search" type="search" placeholder="Reservation code or client name" value="' + B.safe(reservationQuery) + '"></label><div class="reservation-filters"><label>Appointment date<input id="reservation-filter" type="date" value="' + B.safe(reservationDate) +
      '"></label><label>Status<select id="reservation-status"><option value="">All statuses</option>' + ['Cancelled', 'Completed', 'Confirmed', 'No-Show'].map(status => '<option' + (reservationStatus === status ? ' selected' : '') + '>' + status + '</option>').join('') + '</select></label></div>' +
      '<p class="quiet section-note" role="status">' + records.length + (records.length === 1 ? ' reservation' : ' reservations') + '</p>' + table(['Reservation Code', 'Client', 'Appointment', 'Status', 'Actions'], records.map(item => {
        const status = B.reservationStatus(item);
        const client = state.profiles.find(profile => profile.id === item.clientId);
        return [B.safe(item.code), B.safe(client?.fullName ?? ''), B.appointment(item.date, item.time), B.status(status),
          status === 'Confirmed' ? '<div class="inline-actions"><button class="button secondary small" data-reschedule="' + item.code +
          '">Reschedule</button><button class="link-button" data-cancel="' + item.code + '">Cancel</button></div>' : ''];
      }), 'No Reservations for this selection.');
  }

  function reschedule(role, code) {
    const item = B.read().reservations.find(record => record.code === code);
    Staff.dialog('Reschedule Reservation', '<p>Reservation Code <strong>' + code + '</strong></p>' +
      '<label>Appointment date<input type="date" name="date" min="' + B.day() + '" max="' + B.day(30) + '" value="' +
      item.date + '" required></label><label>Time slot<select name="time" required></select></label>', async form => {
      const { date, time } = Object.fromEntries(new FormData(form));
      await B.update(state => {
        const record = state.reservations.find(entry => entry.code === code);
        if (!record || B.reservationStatus(record) !== 'Confirmed') throw Error('This Reservation is no longer Confirmed.');
        if (!B.validSlot(state, date, time, code, record.items.map(item => item.id)) ||
            B.reservationImpact(state, { ...record, date, time }).length) throw Error('Choose an available time slot.');
        const original = B.appointment(record.date, record.time);
        Object.assign(record, { date, time });
        B.audit(state, B.roles[role], 'Reservation rescheduled', code + ' · ' + original + ' → ' + B.appointment(date, time));
        const client = state.profiles.find(item => item.id === record.clientId);
        if (client) B.notify(state, 'Reschedule notice', client.mobile, code + ' moved to ' + B.appointment(date, time) + '.', code);
      });
      draw(role);
      announce('Reservation ' + code + ' rescheduled.');
    }, { submitLabel: 'Save Appointment' });
    const form = Staff.modal.querySelector('form');
    function options() {
      const state = B.read();
      form.elements.time.innerHTML = '<option value="">Select an available time</option>' + B.times
        .filter(time => B.validSlot(state, form.elements.date.value, time, code, item.items.map(service => service.id)) &&
          !B.reservationImpact(state, { ...item, date: form.elements.date.value, time }).length)
        .map(time => '<option value="' + time + '"' + (time === item.time ? ' selected' : '') + '>' +
          B.timeLabel(time) + '</option>').join('');
    }
    form.elements.date.addEventListener('change', options);
    options();
  }

  function cancelReservation(role, code) {
    Staff.dialog('Cancel Reservation', '<p>Cancel <strong>' + code + '</strong> and release its appointment time?</p>', async () => {
      await B.update(state => {
        const record = state.reservations.find(entry => entry.code === code);
        if (!record || B.reservationStatus(record) !== 'Confirmed') throw Error('This Reservation is no longer Confirmed.');
        record.status = 'Cancelled';
        B.audit(state, B.roles[role], 'Reservation cancelled', code);
        const client = state.profiles.find(item => item.id === record.clientId);
        if (client) B.notify(state, 'Cancellation notice', client.mobile, 'Your Reservation ' + code + ' was cancelled.', code);
      });
      draw(role);
      announce('Reservation ' + code + ' cancelled.');
    }, { submitLabel: 'Cancel Reservation' });
  }

  function services(state, role) {
    return '<div class="tool-heading">' + note('Manage availability and Discount Eligibility for future transactions.') +
      '<button class="button primary" data-create-service>Create Diagnostic Service</button>' + '</div>' +
      '<div class="service-admin-tools"><label>Search services<input id="management-search" type="search" value="' + B.safe(serviceQuery) +
      '"></label><button class="button secondary" data-capacity>Slot capacity: ' + state.capacity + '</button></div>' +
      '<div id="service-admin-list">' + serviceTable(state) + '</div>';
  }

  function serviceTable(state) {
    return table(['Diagnostic Service', 'Price', 'Availability', 'Senior/PWD discount', 'Action'],
      B.search(B.services(state), serviceQuery).map(item => [
        B.safe(item.label) + '<small>' + B.safe(item.category) + '</small>', amount(item.price),
        B.status(item.available ? 'Available' : 'Unavailable'), '20%',
        '<button class="button secondary small" data-service="' + item.id + '" aria-label="Edit ' +
        B.safe(item.label) + '">Edit</button>'
      ]), 'No services match your search.');
  }

  function editService(role, id) { CatalogAdmin.serviceEditor(role, id, () => draw(role)); }

  function editCapacity(role) {
    Staff.dialog('Shared slot capacity', '<label>Reservations per Appointment Date and Time Slot<input name="capacity" type="number" min="1" max="30" value="' +
      B.read().capacity + '" required></label>', async form => {
      const capacity = Number(form.elements.capacity.value);
      await B.update(state => {
        state.capacity = capacity;
        B.audit(state, B.roles[role], 'Shared slot capacity updated', String(capacity));
      });
      draw(role);
      announce('Slot capacity updated.');
    });
  }

  function coupons(state) {
    return '<div class="tool-heading">' + note('Review Coupon rules and usage.') +
      '<button class="button primary" data-create-coupon>Create Coupon</button></div>' +
      table(['Coupon', 'Value', 'Validity', 'Eligible services', 'Uses', 'Status', ''], state.coupons.map(item => [
      B.safe(item.label) + '<small>' + B.safe(item.code) + '</small>', item.kind === 'percent' ? item.value + '%' : amount(item.value),
      B.dateLabel(item.start) + ' to ' + B.dateLabel(item.end), item.serviceIds ? item.serviceIds.length + ' selected' : 'All services',
      state.sales.filter(sale => sale.couponCode === item.code).length + ' / ' + item.limit + '<small>' + item.perClient + ' per Client</small>',
      B.status(item.active ? 'Active' : 'Inactive'),
      '<button type="button" class="button secondary small" data-edit-coupon="' + B.safe(item.code) + '">Edit Coupon</button>'
    ]), 'No Coupons are available.');
  }

  function reportRange(state) {
    const today = B.day();
    const anchor = reportDate || today;
    const asDate = new Date(anchor + 'T00:00:00Z');
    const iso = date => date.toISOString().slice(0, 10);
    if (reportPeriod === 'custom') return [reportStart, reportEnd];
    if (reportPeriod === 'day') return [anchor, anchor];
    if (reportPeriod === 'week') {
      const start = new Date(asDate);
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      return [iso(start), iso(end)];
    }
    if (reportPeriod === 'month') {
      const end = new Date(asDate);
      end.setUTCMonth(end.getUTCMonth() + 1, 0);
      return [anchor.slice(0, 7) + '-01', iso(end)];
    }
    if (reportPeriod === 'year') return [anchor.slice(0, 4) + '-01-01', anchor.slice(0, 4) + '-12-31'];
    if (reportPeriod === 'all') {
      const dates = state.sales.map(item => B.dateKey(new Date(item.at))).sort();
      return [dates[0] ?? today, dates.at(-1) ?? today];
    }
    return [B.day(1 - Number(reportPeriod)), today];
  }

  function reportData(state) {
    const [start, end] = reportRange(state);
    const sales = state.sales.map(sale => B.effectiveSale(state, sale)).filter(sale => {
      const date = B.dateKey(new Date(sale.at));
      return date >= start && date <= end;
    });
    const sum = (rows, key) => rows.reduce((total, item) => total + item[key], 0);
    const payments = [['Cash', 'cash'], ['E-wallet', 'wallet'], ['All payments', '']].map(([label, method]) => {
      const matching = method ? sales.filter(sale => sale.method === method) : sales;
      return [label, matching.length, sum(matching, 'subtotal'), sum(matching, 'amount'), sum(matching, 'due')];
    });
    const coupons = state.coupons.map(coupon => {
      const matching = sales.filter(sale => sale.couponCode === coupon.code);
      return [coupon.label, matching.length, sum(matching, 'amount')];
    });
    return { start, end, sales, payments, coupons };
  }

  function reportTables(data) {
    return table(['Payment method', 'Sales', 'Gross sales', 'Total discounts', 'Net sales'],
      data.payments.map(([label, count, ...amounts]) => [label, count, ...amounts.map(amount)]), '') +
      '<h3 class="management-subhead">Coupon usage</h3>' + table(['Coupon', 'Uses', 'Total discount'],
        data.coupons.map(([label, count, total]) => [B.safe(label), count, amount(total)]), 'No Coupons available.');
  }

  function reports(state) {
    const data = reportData(state);
    const periods = [['30', 'Last 30 days'], ['7', 'Last 7 days'], ['1', 'Today'], ['day', 'Specific day'],
      ['week', 'Calendar week'], ['month', 'Calendar month'], ['year', 'Calendar year'], ['custom', 'Custom dates'], ['all', 'All transactions']];
    const dateInput = (id, label, value) => '<label>' + label + '<input id="' + id + '" type="date" value="' + B.safe(value) + '"></label>';
    const rangeFields = reportPeriod === 'custom' ? dateInput('report-start', 'Start date', reportStart) +
      dateInput('report-end', 'End date', reportEnd) : ['day', 'week', 'month', 'year'].includes(reportPeriod) ?
      dateInput('report-anchor', 'Date in selected period', reportDate) : '';
    const valid = data.start && data.end && data.start <= data.end;
    const days = valid ? Math.round((Date.parse(data.end) - Date.parse(data.start)) / 86400000) + 1 : 0;
    const dates = days > 0 && days <= 42 ? Array.from({ length: days }, (_, index) =>
      new Date(Date.parse(data.start) + index * 86400000).toISOString().slice(0, 10)) : [];
    return '<div class="tool-heading"><div class="service-admin-tools"><label>Reporting period<select id="report-period">' +
      periods.map(([id, label]) => '<option value="' + id + '"' + (reportPeriod === id ? ' selected' : '') + '>' + label + '</option>').join('') +
      '</select></label>' + rangeFields + '</div><div class="actions">' +
      '<button type="button" class="button secondary small" data-report-export="pdf"' + (valid ? '' : ' disabled') + '>Export PDF</button>' +
      '<button type="button" class="button secondary small" data-report-export="csv"' + (valid ? '' : ' disabled') + '>Export CSV</button></div></div>' +
      (valid ? note(B.dateLabel(data.start) + ' to ' + B.dateLabel(data.end) + ' · Finalized transactions') +
        (dates.length ? salesChart(data.sales, dates) : '') + reportTables(data) :
        '<p class="notice">Choose a start date on or before the end date.</p>');
  }

  function exportReport(format) {
    const state = B.read();
    if (!Staff.allowed('manager', 'reports')) return;
    const data = reportData(state);
    if (!data.start || !data.end || data.start > data.end) return;
    if (format === 'pdf') {
      const print = document.querySelector('#receipt-print');
      print.innerHTML = '<article class="report-print"><h1>BioScan Laboratories</h1><h2>Financial and Discount Report</h2>' +
        '<p>' + B.dateLabel(data.start) + ' to ' + B.dateLabel(data.end) + '</p>' + reportTables(data) + '</article>';
      window.print();
      return;
    }
    const pesos = cents => (cents / 100).toFixed(2);
    const rows = [['Financial and Discount Report'], ['Start date', data.start], ['End date', data.end], [],
      ['Payment method', 'Sales', 'Gross sales (PHP)', 'Total discounts (PHP)', 'Net sales (PHP)'],
      ...data.payments.map(([label, count, ...amounts]) => [label, count, ...amounts.map(pesos)]), [],
      ['Coupon', 'Uses', 'Total discount (PHP)'], ...data.coupons.map(([label, count, total]) => [label, count, pesos(total)])];
    const csv = rows.map(row => row.map(value => {
      const cell = String(value);
      return '"' + (/^[=+\-@\t\r]/.test(cell) ? "'" + cell : cell).replaceAll('"', '""') + '"';
    }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bioscan-report-' + data.start + '-to-' + data.end + '.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function createService(role) { CatalogAdmin.serviceEditor(role, null, () => draw(role)); }

  function createCoupon(role, existingCode) {
    const initial = B.read();
    if (role !== 'manager' || !Staff.allowed(role, 'coupons')) return;
    const existing = initial.coupons.find(item => item.code === existingCode);
    if (existingCode && !existing) return;
    const current = existing ?? { label: '', code: '', kind: 'percent', value: '', start: B.day(), end: B.day(30),
      limit: 25, perClient: 1, serviceIds: null, active: true };
    const field = (label, name, type, value, attributes = '') => '<label>' + label + '<input name="' + name + '" type="' +
      type + '" value="' + B.safe(value) + '" ' + attributes + ' required></label>';
    const check = (label, name, selected) => '<label class="check-row"><input name="' + name + '" type="checkbox"' +
      (selected ? ' checked' : '') + '><span>' + label + '</span></label>';
    const rows = B.services(initial).map(item => '<label class="check-row"><input type="checkbox" name="service" value="' + item.id +
      '"' + (current.serviceIds?.includes(item.id) ? ' checked' : '') + '><span>' + B.safe(item.label) + '</span></label>').join('');
    Staff.dialog(existing ? 'Edit Coupon' : 'Create Coupon',
      '<div class="form-grid">' + field('Coupon name', 'label', 'text', current.label, 'maxlength="60"') +
      field('Coupon code', 'code', 'text', current.code, existing ? 'readonly' : 'maxlength="20"') + '</div>' +
      '<div class="form-grid"><label>Discount type<select name="kind"><option value="percent">Percentage</option>' +
      '<option value="fixed"' + (current.kind === 'fixed' ? ' selected' : '') + '>Fixed amount (₱)</option></select></label>' +
      field(current.kind === 'fixed' ? 'Value (₱)' : 'Value (%)', 'value', 'number',
        current.kind === 'fixed' ? current.value / 100 : current.value, 'min="0.01" step="0.01" max="' +
        (current.kind === 'fixed' ? 100000 : 100) + '"') + '</div><div class="form-grid">' +
      field('Start date', 'start', 'date', current.start) + field('End date', 'end', 'date', current.end) +
      '</div><div class="form-grid">' + field('Total usage limit', 'limit', 'number', current.limit, 'min="1" max="10000"') +
      field('Uses per Client', 'perClient', 'number', current.perClient, 'min="1" max="10000"') + '</div>' +
      check('Apply to all Diagnostic Services', 'all', !current.serviceIds) +
      '<fieldset class="coupon-services"' + (!current.serviceIds ? ' hidden' : '') + '><legend>Eligible services</legend>' +
      '<label>Search eligible services<input type="search" data-coupon-search></label><div>' + rows + '</div></fieldset>' +
      check('Active', 'active', current.active), async form => {
        const data = new FormData(form);
        const label = data.get('label').trim(), code = data.get('code').trim().toUpperCase();
        const kind = data.get('kind'), value = Number(data.get('value'));
        const start = data.get('start'), end = data.get('end');
        const limit = Number(data.get('limit')), perClient = Number(data.get('perClient'));
        const serviceIds = data.has('all') ? null : data.getAll('service');
        if (!label) throw Error('Enter a Coupon name.');
        if (!/^[A-Z0-9][A-Z0-9_-]{2,19}$/.test(code))
          throw Error('Use 3 to 20 letters, numbers, hyphens, or underscores for the Coupon code.');
        if (start > end) throw Error('The end date must be on or after the start date.');
        if (perClient > limit) throw Error('Uses per Client cannot exceed the total usage limit.');
        if (serviceIds && !serviceIds.length) throw Error('Choose at least one eligible service.');
        await B.update(state => {
          if (!Staff.allowed(role, 'coupons')) throw Error('Coupon management is unavailable for this role.');
          const saved = state.coupons.find(item => item.code === code);
          if (existing ? !saved || existingCode !== code : Boolean(saved))
            throw Error(existing ? 'This Coupon changed. Reopen it to continue.' : 'Choose a unique Coupon code.');
          const values = { label, code, kind, value: kind === 'fixed' ? Math.round(value * 100) : value,
            start, end, limit, perClient, serviceIds, active: data.has('active') };
          if (saved) Object.assign(saved, values);
          else state.coupons.push(values);
          B.audit(state, B.roles[role], saved ? 'Coupon updated' : 'Coupon created', code);
        });
        draw(role);
        announce('Coupon ' + code + (existing ? ' updated.' : ' created.'));
      }, { submitLabel: existing ? 'Save Coupon' : 'Create Coupon' });
    const form = Staff.modal.querySelector('form');
    const scope = form.querySelector('.coupon-services');
    form.elements.kind.addEventListener('change', () => {
      const fixed = form.elements.kind.value === 'fixed';
      form.elements.value.max = fixed ? '100000' : '100';
      form.elements.value.parentElement.firstChild.textContent = fixed ? 'Value (₱)' : 'Value (%)';
    });
    form.elements.all.addEventListener('change', () => { scope.hidden = form.elements.all.checked; });
    scope.querySelector('[data-coupon-search]').addEventListener('input', event => {
      const query = event.target.value.trim().toLowerCase();
      scope.querySelectorAll('.check-row').forEach(row => {
        row.hidden = !row.textContent.toLowerCase().includes(query) && !row.querySelector('input').checked;
      });
    });
  }

  function salesChart(sales, dates) {
    const daily = new Map(dates.map(date => [date, { cash: 0, wallet: 0 }]));
    for (const sale of sales) {
      const bucket = daily.get(B.dateKey(new Date(sale.at)));
      if (bucket) bucket[sale.method] += sale.due;
    }
    const peak = Math.max(0, ...[...daily.values()].map(item => item.cash + item.wallet));
    const rough = peak / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rough || 100));
    const increment = magnitude * [1, 2, 2.5, 5, 10].find(value => value * magnitude >= rough);
    const top = Math.max(increment * 4, 400);
    const height = value => (value / top * 100).toFixed(3) + '%';
    const tickInterval = Math.max(1, Math.ceil(dates.length / 5));
    const points = [...daily].map(([date, item], index) => {
      const description = B.dateLabel(date) + ': ' + B.money(item.cash + item.wallet) +
        ' net, ' + B.money(item.cash) + ' cash, ' + B.money(item.wallet) + ' e-wallet';
      const tick = index === dates.length - 1 || (index % tickInterval === 0 && dates.length - 1 - index > tickInterval / 2);
      return '<div class="chart-day"><div class="chart-column" title="' + B.safe(description) + '">' +
        '<span class="chart-cash" style="height:' + height(item.cash) + '"></span><span class="chart-wallet" style="height:' +
        height(item.wallet) + '"></span></div><span class="chart-date">' + (tick ? Number(date.slice(-2)) : '') + '</span></div>';
    }).join('');
    const rows = [...daily].map(([date, item]) => [B.dateLabel(date), amount(item.cash), amount(item.wallet), amount(item.cash + item.wallet)]);
    return '<figure class="report-chart" aria-labelledby="daily-sales-title"><div class="chart-heading"><div>' +
      '<h3 id="daily-sales-title">Daily net sales</h3><p>' + B.dateLabel(dates[0]) +
      (dates.length > 1 ? ' – ' + B.dateLabel(dates.at(-1)) : '') + '</p></div>' +
      '<div class="chart-legend"><span>Cash</span><span>E-wallet</span></div></div>' +
      '<div class="chart-grid" aria-hidden="true"><div class="chart-axis">' + [1, .75, .5, .25, 0].map(value =>
        '<span>' + B.compactMoney(Math.round(value * top)) + '</span>').join('') + '</div><div class="chart-bars">' +
      points + '</div></div><details><summary>View daily figures</summary>' +
      table(['Date', 'Cash', 'E-wallet', 'Net sales'], rows, 'No sales in this period.') + '</details></figure>';
  }

  function staff(state) {
    const rows = state.staffAccounts.map(account => [
      B.safe(account.fullName), B.safe(account.username), B.roles[account.role] + (account.role === 'medtech' ? '<small>' + B.safe(B.services(state).filter(s => (account.serviceIds || []).includes(s.id)).map(s => s.label).join(', ') || 'No services assigned') + '</small>' : ''), B.status(account.active === false ? 'Inactive' : 'Active'),
      '<button type="button" class="button secondary small" data-office="edit-staff" data-id="' + B.safe(account.username) + '">Edit Account</button>'
    ]);
    return '<div class="tool-heading">' + note('Manage staff accounts and MedTech service assignments.') +
      '<button class="button primary" data-create-staff>Create Staff Account</button></div>' +
      table(['Full name', 'Login username', 'Role', 'Status', ''], rows, 'No staff accounts yet.');
  }

  function createStaff(role) {
    if (role !== 'admin') return;
    Staff.dialog('Create Staff Account',
      '<label>Full name<input name="fullName" maxlength="90" required></label>' +
      '<label>Login username<input name="username" maxlength="60" autocapitalize="none" spellcheck="false" autocomplete="off" required></label>' +
      '<label>Password<input name="password" type="password" maxlength="128" autocomplete="new-password" required></label>' +
      '<label>Role<select name="role" required><option value="">Choose a staff role</option>' +
      Staff.roleOptions(Object.keys(B.roles)) + '</select></label>' + Medtech.assignmentFields(),
      async form => {
        const name = await Staff.createStaffAccount(form);
        Staff.close();
        draw(role);
        announce('Staff account created for ' + name + '.');
        Staff.app.querySelector('[data-create-staff]').focus();
        return false;
      }, { submitLabel: 'Create Account' });
  }

  function audit(state) {
    return note('Review Reservation, approval, payment, and receipt activity.') + table(['Date and time', 'Role', 'Staff account', 'Action', 'Record'],
      state.audit.map(item => [B.stamp(item.at), B.safe(item.actor), B.safe(item.account || '—'), B.safe(item.action), B.safe(item.detail)]),
      'No activity has been recorded.');
  }

  function backup(state, role) {
    const db = Recovery.info(state);
    const pending = Recovery.pending(state, db).length;
    const online = value => B.status(value ? 'Online' : 'Offline');
    return note('Cloud connections, backup copies, and restores are simulated in this prototype.') +
      '<div class="database-status-grid"><div><h3>Primary Cloud (Supabase)</h3>' + online(db.online.cloud) + '</div>' +
      '<div><h3>Cloud Backup</h3>' + online(db.online.backup) + '</div><div><h3>Backup protection</h3>' + B.status(db.result === 'Failed' ? 'Failed' : pending ? 'Pending' : db.lastSuccess ? 'Successful' : 'Not run') + '</div></div>' +
      '<section class="recovery-section"><div class="tool-heading"><h3>Cloud operations</h3><div class="actions"><button class="button secondary" data-db-action="backup"' + (!db.online.cloud || !db.online.backup || db.review ? ' disabled' : '') + '>Back Up Now</button>' +
      (role === 'admin' ? '<button class="button secondary" data-db-action="connections">Simulate Connections</button>' : '') + '</div></div>' +
      '<p>Transactions and reservations use the primary cloud database. The separate cloud backup stores recovery copies.</p>' +
      '<p class="quiet">A primary-cloud outage pauses processing. A backup-cloud outage leaves primary processing available, with backups pending.</p>' +
      '<dl class="detail-list"><div><dt>Last successful backup</dt><dd>' + (db.lastSuccess ? B.stamp(db.lastSuccess) : 'No successful backup yet') + '</dd></div>' +
      '<div><dt>Transactions awaiting backup</dt><dd>' + pending + '</dd></div></dl></section>' + reviewPanel(state, db) + backupHistory(db, role);
  }

  function reviewPanel(state, db) {
    const review = db.review;
    if (!review) return '';
    const restored = new Set(review.restored.map(s => s.id));
    const current = new Set(state.sales.map(s => s.id));
    const differences = [...review.restored.filter(s => !current.has(s.id)).map(s => [s, 'Recover from cloud backup']),
      ...state.sales.filter(s => !restored.has(s.id)).map(s => [s, 'Preserve current record'])];
    return '<section class="recovery-section recovery-review" aria-label="Reconciliation"><div class="tool-heading"><h3>Cloud restore review</h3>' + B.status('Pending') + '</div>' +
      '<p>Backup date: ' + B.dateLabel(review.date) + '. Review recovered and current records before resuming primary-cloud processing.</p>' +
      '<details><summary>View transactions to reconcile</summary>' + table(['Transaction Number', 'Amount paid', 'Action'], differences.map(([sale, action]) => [B.safe(sale.id), B.money(sale.due), action]), 'No differences to reconcile.') + '</details>' +
      '<button class="button primary" data-db-action="approve"' + (!db.online.cloud ? ' disabled' : '') + '>Approve Reconciliation</button></section>';
  }

  function backupHistory(db, role) {
    const restored = db.lastRestored ? '<p class="quiet">Last approved restore · ' + B.dateLabel(db.lastRestored.date) + '</p>' : '';
    const rows = db.backups.backup.map(copy => [B.dateLabel(copy.date), B.stamp(copy.capturedAt), copy.ids.length,
      B.status(copy.ids.every(id => db.archive[id]) ? 'Verified' : 'Unavailable'), role === 'admin' ? '<button class="button secondary small" data-restore-backup="' + copy.date + '"' +
        (db.review || !db.online.cloud || !db.online.backup || copy.ids.some(id => !db.archive[id]) ? ' disabled' : '') + '>Restore to Primary Cloud</button>' : 'Administrator restore only']);
    return '<section class="recovery-section"><h3>Cloud backup history</h3><p class="quiet">Daily recovery copies with rolling seven-day retention. Restore access is limited to the Administrator.</p>' +
      table(['Backup date', 'Captured', 'Transactions', 'Status', ''], rows, 'No verified cloud backup yet. Use Back Up Now to create one.') + restored + '</section>';
  }

  async function runRecovery(role, action) {
    const message = await B.update(action);
    draw(role);
    announce(message);
  }

  function confirmRecovery(role, title, detail, acknowledgement, action, submitLabel) {
    Staff.dialog(title, '<p>' + B.safe(detail) + '</p><label class="check-row"><input type="checkbox" required><span>' +
      B.safe(acknowledgement) + '</span></label>', async () => {
      await runRecovery(role, action);
    }, { submitLabel });
  }

  function databaseAction(role, action) {
    const db = Recovery.info(B.read());
    if (action === 'backup') runRecovery(role, state => Recovery.synchronize(state, role) ? 'Cloud backup completed.' :
      'Backup failed. Check cloud connections and pending recovery issues.').catch(error => announce(error.message, true));
    if (action === 'connections') {
      Staff.dialog('Simulate Cloud Connections', '<label>Primary Cloud (Supabase)<select name="cloud">' + connectionOptions(db.online.cloud) + '</select></label>' +
        '<label>Cloud Backup<select name="backup">' + connectionOptions(db.online.backup) + '</select></label>', async form => {
        await runRecovery(role, state => {
          Recovery.setConnections(state, role, { cloud: form.elements.cloud.value === 'online', backup: form.elements.backup.value === 'online' });
          return 'Cloud connection status updated.';
        });
      }, { submitLabel: 'Save Status' });
    }
    if (action === 'approve') confirmRecovery(role, 'Approve Cloud Restore',
      'Review the restored transactions and current records before resuming primary-cloud processing.',
      'I reviewed the records and approve resuming processing.', state => {
        Recovery.approve(state, role, db.review?.id);
        return 'Reconciliation approved. Primary-cloud processing can resume.';
      }, 'Approve Reconciliation');
  }

  function connectionOptions(online) {
    return '<option value="online"' + (online ? ' selected' : '') + '>Online</option>' +
      '<option value="offline"' + (!online ? ' selected' : '') + '>Offline</option>';
  }

  function restoreBackup(role, date) {
    confirmRecovery(role, 'Restore Cloud Backup', 'Cloud Backup · ' + B.dateLabel(date) +
      '. The recovered records will be reviewed before primary-cloud processing resumes.',
      'I am authorized to restore this cloud backup.', state => {
        Recovery.restore(state, role, 'backup', date);
        return 'Cloud backup staged for reconciliation.';
      }, 'Restore Backup');
  }

  return { render, sync, reset };
})();
