'use strict';

const Office = (() => {
  const B = Bioscan;
  let clientQuery = '';

  function clientRows(state, table) {
    const query = clientQuery.trim().toLowerCase();
    return table(['Client', 'Mobile number', 'Client ID', ''], state.profiles
      .filter(item => [item.fullName, item.mobile, item.id].some(value => value.toLowerCase().includes(query)))
      .slice().sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map(item => [B.safe(item.fullName), B.safe(item.mobile), B.safe(item.id),
        '<button type="button" class="button secondary small" data-office="client" data-id="' + B.safe(item.id) + '">View Profile</button>']),
    'No matching Client Profiles.');
  }

  function action(name, label, id = '') {
    return '<button type="button" class="button secondary small" data-office="' + name + '" data-id="' +
      B.safe(id) + '">' + label + '</button>';
  }

  function profiles(state, role, table) {
    return '<label>Search Client Profiles<input id="client-directory-search" type="search" value="' + B.safe(clientQuery) +
      '" placeholder="Name, mobile number, or Client ID"></label><div id="office-results">' + clientRows(state, table) + '</div>';
  }

  function closures(state, role, table, note) {
    const affected = state.reservations.filter(item => B.reservationStatus(item) === 'Confirmed' && B.reservationImpact(state, item).length);
    const windows = state.closures.map(item => [B.safe(item.serviceId ?
      B.services(state).find(service => service.id === item.serviceId)?.label ?? item.serviceId : 'Clinic closure'),
      B.stamp(item.start + ':00+08:00'), B.stamp(item.end + ':00+08:00'), B.safe(item.reason),
      action('remove-closure', 'Remove', item.id)]);
    const affectedRows = affected.map(item => [B.safe(item.code),
      B.safe(state.profiles.find(client => client.id === item.clientId)?.fullName),
      B.appointment(item.date, item.time), B.safe(B.reservationImpact(state, item).join(' · ')),
      action('notify-reservation', 'Send Notice', item.code)]);
    return '<div class="tool-heading">' + note('Schedule a clinic closure or make a service unavailable for a date and time range.') +
      action('add-closure', 'Schedule Unavailability') + '</div>' +
      table(['Scope', 'Starts', 'Ends', 'Reason', ''], windows, 'No scheduled closures or service interruptions.') +
      '<h3 class="management-subhead">Affected Reservations</h3>' +
      note('Send a simulated notice here. To change an appointment, open Reservations.') +
      table(['Reservation Code', 'Client', 'Appointment', 'Impact', ''], affectedRows, 'No Confirmed Reservations are affected.');
  }

  function issues(state, role, table, note) {
    return '<div class="tool-heading">' + note('Review failed payment checks, duplicate references, and backup conflicts.') +
      action('sync-conflict', 'Simulate Backup Conflict') + '</div>' +
      table(['Issue', 'Reference / Transaction', 'Reason', 'Status', ''], state.paymentIssues.map(item => [
        B.safe(item.type === 'Synchronization conflict' ? 'Backup conflict' : item.type) + '<small>' + B.stamp(item.at) + '</small>', B.safe(item.reference || item.transaction || '—'),
        B.safe(item.reason) + (item.resolution ? '<small>' + B.safe(item.resolution) + '</small>' : ''),
        B.status(item.status), item.status === 'Pending' ? action('resolve-issue', 'Review', item.id) : ''
      ]), 'No flagged payments or backup conflicts.');
  }

  function sms(state, role, table, note) {
    return note('This log contains simulated SMS dispatch results. Recipient numbers are masked.') +
      table(['Sent at', 'Type', 'Recipient', 'Reservation Code', 'Message', 'Result'], state.sms.map(item => [
        B.stamp(item.at), B.safe(item.type === 'Synchronization conflict' ? 'Backup conflict' : item.type), '•••• ' + B.safe(item.mobile.slice(-4)), B.safe(item.reservation || '—'),
        item.type === 'OTP' ? 'Verification code' : B.safe(item.message), B.status(item.status)
      ]), 'No simulated SMS dispatches yet.');
  }

  function clinic(state, role, table, note) {
    return '<div class="tool-heading">' + note('Publish clinic details on the public website.') +
      action('edit-clinic', 'Edit Clinic Information') + '</div>' +
      '<dl class="detail-list">' + Object.entries({ Address: state.clinic.address, 'Operating hours': state.clinic.hours,
        Landline: state.clinic.phone, Email: state.clinic.email, 'Facility photos': state.clinic.photos.length })
        .map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + B.safe(value) + '</dd></div>').join('') + '</dl>' +
      (state.clinic.photos.length ? '<div class="facility-grid">' + state.clinic.photos.map((photo, index) =>
        '<figure><img src="' + B.safe(photo.src) + '" alt="' + B.safe(photo.caption) + '"><figcaption>' +
        B.safe(photo.caption) + '</figcaption>' + action('remove-photo', 'Remove Photo', index) + '</figure>').join('') + '</div>' :
        note('Add a facility photo to preview the public gallery.'));
  }

  function settings(state, role, table, note) {
    return '<div class="tool-heading">' + note('Change appointment capacity and the simulation behavior.') +
      action('edit-settings', 'Edit System Settings') + '</div><dl class="detail-list">' +
      '<div><dt>Shared slot capacity</dt><dd>' + state.capacity + '</dd></div><div><dt>Simulated SMS delivery</dt><dd>' +
      (state.settings.smsAvailable ? 'Available' : 'Unavailable') + '</dd></div><div><dt>Automatic cloud backup</dt><dd>' +
      (state.settings.automaticSync ? 'Enabled' : 'Paused') + '</dd></div></dl>';
  }

  function corrections(state, role, table, note) {
    return note('Correct payment details on finalized sales. Each correction preserves the original payment and Transaction Number.') +
      table(['Transaction Number', 'Date and time', 'Payment method', 'Total paid', ''], state.sales.slice().reverse().map(sale => {
        const effective = B.effectiveSale(state, sale);
        return [B.safe(sale.id), B.stamp(sale.at), effective.method === 'cash' ? 'Cash' : B.safe(effective.provider),
          B.money(sale.due), action('correct-sale', 'Correct Payment', sale.id)];
      }), 'Finalized transactions will appear here.') + '<h3 class="management-subhead">Correction history</h3>' +
      table(['Transaction Number', 'Previous payment', 'Corrected payment', 'Reason', 'Authorized by'], state.corrections.map(item => [
        B.safe(item.saleId), paymentLabel(item.original), paymentLabel(item.payment), B.safe(item.reason),
        B.safe(item.actor) + (item.account ? '<small>' + B.safe(item.account) + '</small>' : '')
      ]), 'No payment corrections have been recorded.');
  }

  function paymentLabel(payment) {
    return payment.method === 'cash' ? 'Cash' : B.safe(payment.provider + ' · ' + payment.reference);
  }

  function roles(state, role, table, note) {
    const permissions = Object.entries(Staff.permissionLabels).map(([key, labels]) => [
      B.roles[key], Object.values(labels).map(B.safe).join('<br>')
    ]);
    permissions.push([B.roles.admin, 'Manage staff accounts, clinic information, system settings, and backups<br>' +
      'Maintain Client Profiles and review Audit Logs']);
    return note('Each staff account has one role. Permissions are assigned by role.') +
      table(['Role', 'Permissions'], permissions, '');
  }

  function filePhoto(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 500000)
      throw Error('Choose a PNG, JPEG, or WebP image under 500 KB.');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(Error('The photo could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  function field(name, label, value, type = 'text', required = true) {
    return '<label>' + label + '<input name="' + name + '" type="' + type + '" value="' + B.safe(value) + '"' +
      (required ? ' required' : '') + '></label>';
  }

  function check(name, label, checked) {
    return '<label class="check-row"><input type="checkbox" name="' + name + '"' + (checked ? ' checked' : '') +
      '><span>' + B.safe(label) + '</span></label>';
  }

  function bind(region, role, draw, announce, table) {
    const input = region.querySelector('#client-directory-search');
    if (input) input.oninput = () => {
      clientQuery = input.value;
      region.querySelector('#office-results').innerHTML = clientRows(B.read(), table);
    };
    region.onclick = event => {
      const button = event.target.closest('[data-office]');
      if (!button) return;
      const { office, id } = button.dataset;
      const state = B.read();
      const actor = B.roles[role];
      function change(title, body, update, label = 'Save') {
        Staff.dialog(title, body, async form => {
          const result = await update(new FormData(form), form);
          if (!Staff.validateSession()) { Staff.init(true); return; }
          draw(role);
          announce(result || title + ' saved.');
        }, { submitLabel: label });
      }
      if (office === 'client') {
        if (role !== 'admin' && !Staff.allowed('manager', 'profiles')) return;
        const client = state.profiles.find(item => item.id === id);
        if (!client) return;
        if (role !== 'admin') { Staff.dialog(client.fullName, B.clientSummary(state, client)); return; }
        change('Maintain Client Profile', B.clientSummary(state, client) + '<h3>Update contact details</h3>' +
          field('fullName', 'Full name', client.fullName) + field('mobile', 'Mobile number', client.mobile, 'tel') +
          '<label>Age<input name="age" type="number" min="0" max="125" value="' + B.safe(client.age) + '" required></label>' +
          '<label>Sex<select name="sex">' + ['Female', 'Male', 'Prefer not to say'].map(value =>
            '<option' + (client.sex === value ? ' selected' : '') + '>' + value + '</option>').join('') + '</select></label>',
          (_, form) => B.update(current => {
            const details = B.clientDetails(form);
            if (current.profiles.some(item => item.id !== id && item.mobile === details.mobile &&
                item.fullName.toLowerCase() === details.fullName.toLowerCase())) throw Error('This Client Profile already exists.');
            const record = current.profiles.find(item => item.id === id);
            if (!record) throw Error('This Client Profile is no longer available.');
            Object.assign(record, details);
            B.audit(current, actor, 'Client Profile updated', id);
          }), 'Save Client Profile');
      }
      if (office === 'add-closure') change('Schedule Unavailability',
        '<label>Scope<select name="serviceId"><option value="">Entire clinic</option>' + B.services(state).map(item =>
          '<option value="' + B.safe(item.id) + '">' + B.safe(item.label) + '</option>').join('') + '</select></label>' +
        '<p class="quiet">Use Philippine time.</p>' + field('start', 'Starts', B.day(1) + 'T07:00', 'datetime-local') +
        field('end', 'Ends', B.day(1) + 'T17:00', 'datetime-local') + field('reason', 'Reason', ''),
        data => B.update(current => {
          const start = data.get('start'), end = data.get('end'), reason = data.get('reason').trim();
          if (!reason || end <= start || new Date(end + ':00+08:00').getTime() <= Date.now())
            throw Error('Enter a reason and an end time after the start and current time.');
          current.closures.push({ id: B.uid('CLS'), start, end, reason, serviceId: data.get('serviceId') });
          B.audit(current, actor, 'Unavailability scheduled', reason);
          return 'Unavailability scheduled. Review affected Reservations below.';
        }), 'Save Schedule');
      if (office === 'remove-closure') change('Remove Scheduled Unavailability',
        '<p>The clinic or service will follow its regular availability.</p>', () => B.update(current => {
          current.closures = current.closures.filter(item => item.id !== id);
          B.audit(current, actor, 'Scheduled unavailability removed', id);
        }), 'Remove Schedule');
      if (office === 'notify-reservation') change('Send Reservation Notice',
        '<label>Message<textarea name="message" required maxlength="240">Your BioScan Reservation is affected by a change in availability. Please contact the clinic.</textarea></label>',
        data => B.update(current => {
          const item = current.reservations.find(entry => entry.code === id);
          const client = current.profiles.find(entry => entry.id === item?.clientId);
          const message = data.get('message').trim();
          if (!client || !message) throw Error('A Client and a message are required.');
          const result = B.notify(current, 'Availability notice', client.mobile, message, id);
          B.audit(current, actor, 'Reservation notice ' + result.toLowerCase(), id);
          return 'Simulated SMS: ' + result.toLowerCase() + '.';
        }), 'Send Simulated SMS');
      if (office === 'resolve-issue') change('Review Flagged Issue',
        '<p>' + B.safe(state.paymentIssues.find(item => item.id === id)?.reason) + '</p>' +
        '<label>Resolution notes<textarea name="resolution" required maxlength="240"></textarea></label>',
        data => B.update(current => {
          const item = current.paymentIssues.find(entry => entry.id === id);
          const resolution = data.get('resolution').trim();
          if (!item || item.status !== 'Pending' || !resolution) throw Error('Enter a resolution for an open issue.');
          Object.assign(item, { status: 'Resolved', resolution, resolvedAt: new Date().toISOString(), resolvedBy: actor });
          B.audit(current, actor, 'Flagged issue resolved', id);
        }), 'Mark Resolved');
      if (office === 'sync-conflict') change('Simulate Backup Conflict',
        '<label>Transaction<select name="saleId" required>' + state.sales.slice().reverse().map(sale =>
          '<option>' + B.safe(sale.id) + '</option>').join('') + '</select></label>' +
        '<p class="quiet">The next cloud backup will require this issue to be reviewed.</p>',
        data => B.update(current => {
          const id = data.get('saleId');
          if (!current.sales.some(sale => sale.id === id)) throw Error('Choose a finalized transaction.');
          if (current.paymentIssues.some(item => ['Backup conflict', 'Synchronization conflict'].includes(item.type) && item.saleId === id && item.status === 'Pending'))
            throw Error('This transaction already has a pending conflict.');
          B.paymentIssue(current, { type: 'Backup conflict', reason: 'Primary-cloud and backup-cloud records differ.', transaction: id, saleId: id });
          B.audit(current, actor, 'Backup conflict flagged', id);
        }), 'Create Conflict');
      if (office === 'correct-sale') {
        const sale = state.sales.find(item => item.id === id);
        if (!sale) return;
        const current = B.effectiveSale(state, sale);
        change('Correct Payment', '<p>Transaction ' + B.safe(id) + ' · ' + B.money(sale.due) + '</p>' +
          '<label>Payment method<select name="method"><option value="cash">Cash</option><option value="wallet"' +
          (current.method === 'wallet' ? ' selected' : '') + '>Manually Verified Static-QR E-Wallet</option></select></label>' +
          '<label>E-wallet provider<select name="provider"><option>GCash</option><option' +
          (current.provider === 'Maya' ? ' selected' : '') + '>Maya</option></select></label>' +
          field('reference', 'Reference number for e-wallet', current.reference || '', 'text', false) +
          '<label>Reason<textarea name="reason" required maxlength="240"></textarea></label>',
          data => B.update(db => {
            const original = db.sales.find(item => item.id === id);
            if (!original) throw Error('The transaction is no longer available.');
            const wallet = data.get('method') === 'wallet';
            const reason = data.get('reason').trim();
            const provider = wallet ? data.get('provider') : '';
            const reference = wallet ? data.get('reference').trim().toUpperCase() : '';
            if (!reason || (wallet && !reference)) throw Error('Enter a reason and an e-wallet reference when applicable.');
            if (wallet && db.sales.some(item => {
              const effective = B.effectiveSale(db, item);
              return item.id !== id && effective.provider === provider && effective.reference === reference;
            })) throw Error('That reference is already used by another transaction.');
            const before = B.effectiveSale(db, original);
            if (before.method === data.get('method') && before.provider === provider && before.reference === reference)
              throw Error('Change the payment method or e-wallet details before saving.');
            const payment = { method: data.get('method'), provider, reference, verified: wallet, received: original.due, change: 0 };
            const account = JSON.parse(sessionStorage.getItem('bioscan-prototype:v1:staff-identity') || 'null')?.username || '';
            db.corrections.unshift({ saleId: id, original: { method: before.method, provider: before.provider, reference: before.reference },
              payment, actor, account, reason, at: new Date().toISOString() });
            if (db.databaseRecovery) db.databaseRecovery.syncedIds = db.databaseRecovery.syncedIds.filter(saleId => saleId !== id);
            B.audit(db, actor, 'Transaction payment corrected', id + ' · ' + reason);
          }), 'Save Correction');
      }
      if (role !== 'admin') return;
      if (office === 'edit-clinic') change('Edit Clinic Information',
        field('address', 'Address', state.clinic.address) + field('hours', 'Operating hours', state.clinic.hours) +
        field('phone', 'Landline', state.clinic.phone, 'tel') + field('email', 'Email', state.clinic.email, 'email') +
        check('sample', 'Operating hours are example details', state.clinic.sample) +
        '<label>Add a facility photo<input name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>' +
        field('caption', 'Photo caption', '', 'text', false), async data => {
          const file = data.get('photo');
          const photo = file.size ? { src: await filePhoto(file), caption: data.get('caption').trim() || 'BioScan facility photo' } : null;
          return B.update(db => {
            for (const name of ['address', 'hours', 'phone', 'email']) {
              const value = data.get(name).trim();
              if (!value) throw Error('Complete the clinic contact details.');
              db.clinic[name] = value;
            }
            db.clinic.sample = data.has('sample');
            if (photo) {
              if (db.clinic.photos.length >= 4) throw Error('Remove a photo before adding another.');
              db.clinic.photos.push(photo);
            }
            B.audit(db, actor, 'Clinic Information updated', 'Public website');
          });
        }, 'Publish Details');
      if (office === 'remove-photo') change('Remove Facility Photo', '<p>The photo will be removed from the public website.</p>',
        () => B.update(db => {
          db.clinic.photos.splice(Number(id), 1);
          B.audit(db, actor, 'Facility photo removed', 'Public website');
        }), 'Remove Photo');
      if (office === 'edit-settings') change('Edit System Settings',
        '<label>Shared slot capacity<input name="capacity" type="number" min="1" max="30" value="' + state.capacity + '" required></label>' +
        check('sms', 'Simulated SMS delivery available', state.settings.smsAvailable) +
        check('sync', 'Automatically create cloud backups while the staff page is open', state.settings.automaticSync),
        data => B.update(db => {
          db.capacity = Number(data.get('capacity'));
          db.settings = { smsAvailable: data.has('sms'), automaticSync: data.has('sync') };
          B.audit(db, actor, 'System settings updated', 'Capacity, SMS, and cloud backup');
        }), 'Save Settings');
      if (office === 'edit-staff') {
        const account = state.staffAccounts.find(item => item.username === id);
        if (!account) return;
        change('Edit Staff Account', field('fullName', 'Full name', account.fullName) +
          '<label>Role<select name="role" required>' + Object.entries(B.roles).map(([key, label]) =>
            '<option value="' + key + '"' + (key === account.role ? ' selected' : '') + '>' + label + '</option>').join('') +
          '</select></label>' + Medtech.assignmentFields(account.serviceIds || []) + field('password', 'New password (optional)', '', 'password', false) +
          check('active', 'Account active', account.active !== false), (_, form) => Staff.updateStaffAccount(form, id), 'Save Account');
      }
    };
  }

  return { pages: { profiles, closures, issues, sms, clinic, settings, corrections, roles }, bind, reset: () => { clientQuery = ''; } };
})();
