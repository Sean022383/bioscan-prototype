'use strict';

const Cashier = (() => {
  const B = Bioscan;
  const draftKey = 'bioscan-prototype:v1:cashier-draft';
  const lastKey = 'bioscan-prototype:v1:last-receipt';
  let draft;
  let query = '';
  let category = '';

  const sum = items => items.reduce((total, item) => total + item.price, 0);
  const approval = state => state.approvals.find(item => item.id === draft?.approvalId && item.saleId === draft.id);
  const locked = state => ['Pending', 'Approved'].includes(approval(state)?.status);
  const pending = state => approval(state)?.status === 'Pending';
  const activeReservation = state => state.reservations.find(item => item.code === draft?.reservation);
  const blocked = state => Boolean(draft?.reservation &&
    B.reservationStatus(activeReservation(state) ?? { status: 'Unavailable' }) !== 'Confirmed');

  function newDraft(state, profile, reservation) {
    return { generation: state.generation, id: B.uid('SALE'), clientId: profile.id, reservation: reservation?.code ?? '',
      items: reservation?.items ?? [], discount: null, approvalId: '' };
  }

  function save() { sessionStorage.setItem(draftKey, JSON.stringify(draft)); }
  function hydrate(state) {
    draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
    if (draft && (draft.generation !== state.generation || state.sales.some(item => item.draftId === draft.id))) {
      draft = null;
      save();
    }
  }

  function totals(state) {
    const subtotal = sum(draft.items);
    const eligible = sum(draft.items.filter(item => item.eligible));
    const decision = approval(state);
    let amount = 0;
    let label = '';
    let couponCode = '';
    if (decision?.status === 'Approved') {
      amount = decision.amount;
      label = 'Manual Discount Override';
    } else if (['senior', 'pwd'].includes(draft.discount?.kind)) {
      amount = Math.round(eligible * 0.2);
      label = draft.discount.kind === 'senior' ? 'Senior Citizen' : 'PWD';
    } else if (draft.discount?.kind === 'coupon') {
      const code = draft.discount.code;
      const coupon = state.coupons.find(item => item.code === code);
      const uses = state.sales.filter(sale => sale.couponCode === code);
      const base = coupon ? sum(draft.items.filter(item => !coupon.serviceIds || coupon.serviceIds.includes(item.id))) : 0;
      if (!coupon?.active || B.day() < coupon.start || B.day() > coupon.end || !base ||
          uses.length >= coupon.limit || uses.filter(sale => sale.clientId === draft.clientId).length >= coupon.perClient) {
        return { subtotal, eligible, amount: 0, due: subtotal, label: '', invalidCoupon: true };
      }
      amount = coupon.kind === 'percent' ? Math.round(base * coupon.value / 100) : Math.min(base, coupon.value);
      label = 'Coupon · ' + coupon.label;
      couponCode = coupon.code;
    }
    return { subtotal, eligible, amount, due: subtotal - amount, label, couponCode };
  }

  function open() {
    hydrate(B.read());
    Staff.app.innerHTML = '<div class="workspace-title"><div><h1>Point of Sale</h1>' +
      '<p>Retrieve a Reservation or start a walk-in transaction.</p></div><div class="actions desk-actions">' +
      '<button class="button secondary" data-action="find">Find Reservation</button>' +
      '<button class="button secondary" data-action="receipt">Find Receipt</button>' +
      '<button class="button primary" data-action="walk-in">New Walk-In</button></div></div>' +
      '<p id="cashier-message" class="message desk-message" role="status"></p>' +
      '<p id="cashier-database-status" class="notice" role="status" hidden></p>' +
      '<div class="pos-grid"><section class="panel pos-services" aria-labelledby="pos-services-title">' +
      '<div class="panel-head"><div><h2 id="pos-services-title">Diagnostic Services</h2>' +
      '<p>Select services for the current sale.</p></div><button class="button secondary small" data-action="profile">Find Client</button></div>' +
      '<div class="search-tools"><label>Search services<input id="pos-search" type="search" placeholder="Search by service name"></label>' +
      '<label>Category<select id="pos-category">' + B.categoryOptions() + '</select></label></div>' +
      '<div id="pos-catalog" class="pos-catalog" aria-label="Service results"></div></section>' +
      '<section class="panel sale-panel" id="sale" aria-label="Current sale"></section></div>';
    const input = Staff.app.querySelector('#pos-search');
    const select = Staff.app.querySelector('#pos-category');
    input.value = query;
    select.value = category;
    input.addEventListener('input', () => { query = input.value; drawCatalog(B.read()); });
    select.addEventListener('change', () => { category = select.value; drawCatalog(B.read()); });
    Staff.app.onclick = handleAction;
    Staff.app.onchange = event => { if (event.target.id === 'discount-type') chooseDiscount(event.target.value); };
    refresh();
    const atStation = approval(B.read());
    if (atStation?.status === 'Pending' && atStation.path === 'station') authorizeAtStation(atStation);
  }

  function say(text, error = false) { B.message(Staff.app.querySelector('#cashier-message'), text, error); }

  function refresh(focusAction) {
    const state = B.read();
    const db = Recovery.info(state);
    const blocked = Recovery.checkoutBlock(state);
    const banner = Staff.app.querySelector('#cashier-database-status');
    const status = blocked || (!db.online.backup ? 'Cloud backup is offline. Primary-cloud processing is available; backup copies are pending.' : '');
    banner.textContent = status;
    banner.hidden = !status;
    Staff.app.querySelector('[data-action="find"]').disabled = Boolean(Recovery.checkoutBlock(state, true));
    Staff.app.querySelector('[data-action="profile"]').hidden = !Staff.allowed('cashier', 'profiles');
    Staff.app.querySelector('[data-action="receipt"]').hidden = !Staff.allowed('cashier', 'receipts');
    drawCatalog(state);
    drawSale(state);
    if (focusAction) Staff.app.querySelector(focusAction)?.focus();
  }

  function sync() {
    if (!Staff.app.querySelector('#sale')) return;
    hydrate(B.read());
    refresh();
  }

  function drawCatalog(state) {
    const disabled = locked(state) || blocked(state);
    const items = B.search(B.offerings(state).filter(item => item.available), query, category);
    const catalog = Staff.app.querySelector('#pos-catalog');
    const top = catalog.scrollTop;
    catalog.innerHTML = '<div class="pos-row pos-table-head"><span>Service</span><span class="numeric">Price</span><span></span></div>' +
      (items.map(item => {
        const inSale = draft?.items.some(line => B.expandIds([item.id], state).includes(line.id));
        return '<div class="pos-row"><span><strong>' + B.safe(item.label) + '</strong><small>' +
          B.safe(item.category) + '</small></span><span class="numeric">' + B.money(item.price) + '</span>' +
          '<button type="button" class="button secondary small" data-action="add" data-id="' + item.id +
          '" aria-label="Add ' + B.safe(item.label) + '"' + (disabled || inSale ? ' disabled' : '') + '>' +
          (inSale ? 'Added' : 'Add') + '</button></div>';
      }).join('') || '<p class="empty">No services match your search.</p>');
    catalog.scrollTop = top;
  }

  function discountControl(decision, unavailable) {
    if (decision?.status === 'Pending') return '<div class="notice hold" role="status"><strong>Manual Discount Override pending</strong>' +
      '<span>' + B.money(decision.amount) + ' requested. Payment resumes after a decision.</span></div>';
    const info = decision?.status === 'Declined' ? '<p class="notice" role="status">Override declined by ' + B.roles[decision.by] + '.</p>' :
      decision?.status === 'Approved' ? '<p class="notice" role="status"><strong>Override approved</strong> by ' + B.roles[decision.by] + '.</p>' : '';
    const value = decision?.status === 'Approved' ? 'override' : draft.discount?.kind || 'none';
    const options = [['none', 'No discount'], ['senior', 'Senior Citizen'], ['pwd', 'PWD'], ['coupon', 'Coupon'],
      ['override', 'Manual Discount Override']];
    return info + '<label class="discount-field">Discount<select id="discount-type"' +
      (!draft.items.length || unavailable ? ' disabled' : '') + '>' +
      options.map(([key, text]) => '<option value="' + key + '"' + (value === key ? ' selected' : '') + '>' + text +
        '</option>').join('') + '</select></label>';
  }

  function drawSale(state) {
    const panel = Staff.app.querySelector('#sale');
    const last = state.sales.find(item => item.id === sessionStorage.getItem(lastKey));
    if (!draft) {
      panel.innerHTML = '<div class="panel-head"><h2>Current sale</h2>' + B.status('Awaiting client') + '</div>' +
        '<div class="sale-empty"><h3>Start a transaction</h3><p>Find a Reservation, look up a Client Profile, or register a walk-in.</p></div>' +
        '<div class="sale-bottom"><div class="amount-due"><span>Amount due</span><strong>' + B.money(0) +
        '</strong></div><button class="button primary" disabled>Take Payment</button>' +
        (last && Staff.allowed('cashier', 'receipts') ? '<button class="button secondary" data-action="last-receipt">View last Transaction Receipt</button>' : '') + '</div>';
      return;
    }
    const client = state.profiles.find(item => item.id === draft.clientId);
    const linked = activeReservation(state);
    const checkoutHold = Recovery.checkoutBlock(state, Boolean(draft.reservation));
    const unavailable = blocked(state);
    const decision = approval(state);
    const total = totals(state);
    const label = unavailable ? (linked ? B.reservationStatus(linked) : 'Unavailable') :
      pending(state) ? 'On hold' : !draft.items.length ? 'Awaiting services' : total.invalidCoupon ? 'Review Coupon' : 'Ready';
    panel.innerHTML = '<div class="panel-head"><h2>Current sale</h2>' + B.status(label) + '</div>' +
      '<div class="sale-client"><strong>' + B.safe(client?.fullName ?? 'Client') + '</strong><span>' +
      (draft.reservation ? 'Reservation · ' + B.safe(draft.reservation) : 'Walk-in · ' + B.safe(draft.clientId)) + '</span>' +
      (linked ? '<span>' + B.appointment(linked.date, linked.time) + ' · ' + B.safe(B.reservationStatus(linked)) + '</span>' : '') + '</div>' +
      (unavailable ? '<p class="notice">This Reservation is unavailable for payment. Start another transaction.</p>' : '') +
      (checkoutHold && !Recovery.checkoutBlock(state) ? '<p class="notice">' + B.safe(checkoutHold) + '</p>' : '') +
      '<div class="sale-lines">' + (draft.items.map(item => '<div class="sale-line"><span>' + B.safe(item.label) + (item.bundleLabel ? '<small>Part of ' + B.safe(item.bundleLabel) + '</small>' : '') +
        '</span><strong class="numeric">' + B.money(item.price) + '</strong>' +
        (locked(state) || unavailable ? '' : '<button class="link-button remove-item" data-action="remove" data-id="' + item.id +
          '" aria-label="Remove ' + B.safe(item.bundleLabel || item.label) + '">' + (item.bundleId ? 'Remove bundle' : 'Remove') + '</button>') + '</div>').join('') ||
        '<p class="quiet">Select a Diagnostic Service to add it to this sale.</p>') + '</div>' +
      discountControl(decision, unavailable) +
      '<div class="sale-bottom"><dl class="totals"><div><dt>Subtotal</dt><dd>' + B.money(total.subtotal) +
      '</dd></div><div><dt>' + B.safe(total.label || 'Discount') + '</dt><dd>' + (total.amount ? '−' : '') +
      B.money(total.amount) + '</dd></div></dl>' +
      (total.invalidCoupon ? '<p class="message error">Coupon unavailable. Choose a different discount.</p>' : '') +
      '<div class="amount-due"><span>Amount due</span><strong>' + B.money(total.due) + '</strong></div>' +
      '<button class="button primary" data-action="pay"' +
      (!Staff.allowed('cashier', 'payment') || !draft.items.length || pending(state) || unavailable || checkoutHold || total.invalidCoupon ? ' disabled' : '') +
      '>Take Payment <span class="arrow" aria-hidden="true"></span></button></div>';
  }

  function startDialog(title, body, onSubmit, submitLabel) {
    if (pending(B.read())) { say('Resolve the pending approval before starting another sale.', true); return; }
    const replace = draft ? '<label class="check-row"><input name="replace" type="checkbox" required>' +
      '<span>Replace the unfinished sale</span></label>' : '';
    Staff.dialog(title, body + replace, onSubmit, { submitLabel });
  }

  function findReservation() {
    const hold = Recovery.checkoutBlock(B.read(), true);
    if (hold) { say(hold, true); return; }
    startDialog('Find Reservation', '<label>Reservation Code<input name="code" placeholder="BS-…" required autocomplete="off"></label>',
      form => {
        const state = B.read();
        const hold = Recovery.checkoutBlock(state, true);
        if (hold) throw Error(hold);
        const code = form.elements.code.value.trim().toUpperCase();
        const reservation = state.reservations.find(item => item.code === code);
        if (!reservation) throw Error('Reservation Code not found. Check the code and try again.');
        const status = B.reservationStatus(reservation);
        if (status !== 'Confirmed') throw Error('This Reservation is ' + status + '. Appointment: ' + B.appointment(reservation.date, reservation.time) + '.');
        const profile = state.profiles.find(item => item.id === reservation.clientId);
        draft = newDraft(state, profile, reservation);
        save();
        say('Reservation retrieved for ' + profile.fullName + '.');
        refresh();
      }, 'Retrieve Reservation');
  }

  function walkIn(serviceId) {
    startDialog('Add Client · New Walk-In', '<div class="form-grid">' + B.clientFields(true) + '</div>' +
      '<label class="check-row"><input type="checkbox" name="walkInConsent" required><span>I confirmed the client’s agreement to use their supplied information for registration and selected services.</span></label>', async form => {
      const details = B.clientDetails(form);
      draft = await B.update(state => {
        const profile = B.findOrCreateClient(state, details);
        B.audit(state, B.roles.cashier, 'Walk-in registered', profile.id);
        const transaction = newDraft(state, profile);
        if (serviceId && B.offerings(state).some(item => item.id === serviceId && item.available)) {
          transaction.items = B.serviceLines([serviceId], state);
        }
        return transaction;
      });
      save();
      say('Walk-in registered for ' + details.fullName + '.');
      refresh();
    }, 'Register Walk-In');
  }

  function lookupProfile() {
    if (!Staff.allowed('cashier', 'profiles')) return;
    startDialog('Find Client', '<label>Search by name, full mobile number, or Client ID<input name="query" type="search" required></label>' +
      '<p class="quiet">Enter at least three letters for a name search.</p><div class="profile-results" id="profile-results"></div>', form => {
      const query = form.elements.query.value.trim().toLowerCase();
      const mobile = query.replace(/[\s()-]/g, '').replace(/^\+63/, '0');
      const phoneSearch = /^\+?\d/.test(query);
      const idSearch = query.startsWith('cl-');
      if (phoneSearch ? !/^09\d{9}$/.test(mobile) : !idSearch && (query.match(/\p{L}/gu) ?? []).length < 3)
        throw Error(phoneSearch ? 'Enter the full mobile number.' : 'Enter at least three letters, a full mobile number, or a Client ID.');
      const state = B.read();
      const results = state.profiles.filter(item => phoneSearch ? item.mobile === mobile : idSearch ? item.id.toLowerCase() === query :
        query.split(/\s+/).every(part => item.fullName.toLowerCase().split(/\s+/).some(word => word.startsWith(part))));
      const region = form.querySelector('#profile-results');
      if (results.length > 10) throw Error('Several Clients match. Enter more of the name or the full mobile number.');
      region.innerHTML = results.map(item => '<button type="button" class="profile-result" data-id="' + B.safe(item.id) +
        '"><strong>' + B.safe(item.fullName) + '</strong><span>' + B.safe(item.id) + ' · ' + B.safe(item.mobile) +
        '</span><span>View profile</span></button>').join('') || '<p class="quiet">No matching Client Profiles.</p>';
      region.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
        if (!form.reportValidity() || !Staff.allowed('cashier', 'profiles')) return;
        const profile = results.find(item => item.id === button.dataset.id);
        Staff.dialog(profile.fullName, B.clientSummary(B.read(), profile, true), () => {
          const current = B.read();
          if (!Staff.allowed('cashier', 'profiles')) throw Error('Client Profile lookup is unavailable for this role.');
          const latest = current.profiles.find(item => item.id === profile.id);
          if (!latest) throw Error('This Client Profile is no longer available.');
          draft = newDraft(current, latest);
          save();
          say('Client Profile retrieved for ' + latest.fullName + '.');
          refresh();
        }, { submitLabel: 'Start Walk-In Sale' });
      }));
      region.querySelector('button')?.focus();
      return false;
    }, 'Search Client Profiles');
  }

  function findReceipt() {
    if (!Staff.allowed('cashier', 'receipts')) return;
    Staff.dialog('Find Transaction Receipt',
      '<label>Transaction Number<input name="number" required autocomplete="off" placeholder="TX-…"></label>', form => {
        const state = B.read();
        const number = form.elements.number.value.trim().toUpperCase();
        const sale = state.sales.find(item => item.id === number);
        if (!sale) throw Error('No finalized transaction matches that number.');
        receipt(B.effectiveSale(state, sale));
        return false;
      }, { submitLabel: 'Open Receipt' });
  }

  function editItem(id, remove) {
    if (!draft) { walkIn(id); return; }
    const state = B.read();
    if (locked(state) || blocked(state)) return;
    if (remove) {
      const target = draft.items.find(item => item.id === id);
      draft.items = draft.items.filter(item => target?.bundleId ? item.bundleId !== target.bundleId : item.id !== id);
    }
    else {
      const item = B.offerings(state).find(entry => entry.id === id && entry.available);
      if (item) {
        const lines = B.serviceLines([id], state);
        if (lines.some(line => draft.items.some(entry => entry.id === line.id))) { say('A service in this bundle is already in the sale. Remove the overlapping selection first.', true); return; }
        draft.items.push(...lines);
      }
    }
    if (!draft.items.length || (!draft.items.some(item => item.eligible) && ['senior', 'pwd'].includes(draft.discount?.kind))) draft.discount = null;
    save();
    refresh(remove ? '[data-action="add"][data-id="' + id + '"]' : undefined);
    if (!remove) {
      const add = Staff.app.querySelector('[data-action="add"][data-id="' + id + '"]');
      const next = add?.closest('.pos-row').nextElementSibling?.querySelector('button:not(:disabled)');
      (next ?? Staff.app.querySelector('#pos-search')).focus({ preventScroll: true });
    }
  }

  function applyDiscount(discount) {
    draft.discount = discount;
    draft.approvalId = '';
    save();
    refresh('#discount-type');
  }

  function chooseDiscount(value) {
    const state = B.read();
    if (!draft?.items.length || pending(state) || blocked(state)) return;
    if (value === 'none') { applyDiscount(null); return; }
    if (value === 'override' && approval(state)?.status === 'Approved') return;
    refresh('#discount-type');
    if (value === 'senior' || value === 'pwd') {
      if (!draft.items.some(item => item.eligible)) {
        say('Select a Discount Eligible service before applying this discount.', true);
        return;
      }
      Staff.dialog(value === 'senior' ? 'Senior Citizen discount' : 'PWD discount',
        '<p>Apply 20% to the Discount Eligible services in this sale.</p>' +
        '<label class="check-row"><input type="checkbox" required><span>I checked the Client’s eligibility.</span></label>',
        () => applyDiscount({ kind: value }), { submitLabel: 'Apply Discount' });
    }
    if (value === 'coupon') {
      Staff.dialog('Apply Coupon', '<label>Coupon code<input name="code" required autocomplete="off"></label>', form => {
        const previous = draft.discount;
        const previousId = draft.approvalId;
        const code = form.elements.code.value.trim().toUpperCase();
        draft.discount = { kind: 'coupon', code };
        draft.approvalId = '';
        const valid = !totals(B.read()).invalidCoupon;
        draft.discount = previous;
        draft.approvalId = previousId;
        if (!valid) throw Error('This Coupon is unavailable for the Client or selected services.');
        applyDiscount({ kind: 'coupon', code });
      }, { submitLabel: 'Apply Coupon' });
    }
    if (value === 'override') requestOverride();
  }

  function requestOverride() {
    Staff.dialog('Request Manual Discount Override',
      '<p>Current subtotal <strong>' + B.money(sum(draft.items)) + '</strong></p><label>Requested discount amount (₱)' +
      '<input type="number" name="amount" min="0.01" max="' + (sum(draft.items) / 100) + '" step="0.01" required></label>' +
      '<label>Reason<textarea name="reason" rows="3" required maxlength="160"></textarea></label>' +
      '<label>Approval path<select name="path"><option value="station">At the cashier station</option>' +
      '<option value="dashboard">From another workstation</option></select></label>',
      async form => {
        const data = new FormData(form);
        const amount = Math.round(Number(data.get('amount')) * 100);
        const reason = data.get('reason').trim();
        const path = data.get('path');
        if (!draft || !reason || amount < 1 || amount > sum(draft.items)) throw Error('Enter a reason and an amount within the subtotal.');
        const request = await B.update(state => {
          if (!draft || draft.generation !== state.generation || blocked(state) || pending(state))
            throw Error('This sale is unavailable for an override.');
          const profile = state.profiles.find(item => item.id === draft.clientId);
          const item = { id: B.uid('APR'), saleId: draft.id, reservation: draft.reservation, client: profile.fullName,
            items: draft.items.map(service => service.label), subtotal: sum(draft.items), amount, reason, path,
            status: 'Pending', at: new Date().toISOString() };
          state.approvals.push(item);
          B.audit(state, B.roles.cashier, 'Manual Discount Override requested', item.id);
          return item;
        });
        draft.approvalId = request.id;
        save();
        refresh();
        if (path === 'station') { authorizeAtStation(request); return false; }
        say('Request sent to Pending Approvals.');
      }, { submitLabel: 'Request Approval' });
  }

  function authorizeAtStation(request) {
    Staff.dialog('Authorize Manual Discount Override', '<p>Approve ' + B.money(request.amount) + ' for <strong>' +
      B.safe(request.client) + '</strong>.</p><label>Decision<select name="decision"><option>Approved</option><option>Declined</option></select></label>' + Staff.credentialFields() +
      '<p class="quiet">Enter a Clinic Manager or System Administrator account to record the decision.</p>', async form => {
      const identity = await Staff.authenticate(form);
      const by = identity.role;
      if (!['manager', 'admin'].includes(by)) throw Error('Use a Clinic Manager or System Administrator account to approve this request.');
      const decision = form.elements.decision.value;
      await decide(request.id, by, decision, 'station', identity.username);
      form.reset();
      say('Manual Discount Override ' + decision.toLowerCase() + '. Continue this sale.');
      refresh();
    }, { submitLabel: 'Record Decision', cancel: async () => {
      try {
        await decide(request.id, 'cashier', 'Withdrawn', 'station');
        say('Authorization closed. You can request approval again.');
      } catch (error) { say(error.message, true); }
      refresh();
    } });
  }

  async function decide(id, by, status, path, account) {
    return B.update(state => {
      const item = state.approvals.find(request => request.id === id && request.path === path);
      if (!item || item.status !== 'Pending') throw Error('This request already has a decision.');
      if (!(['manager', 'admin'].includes(by) || (by === 'cashier' && status === 'Withdrawn' && path === 'station')))
        throw Error('An authorized role is required.');
      Object.assign(item, { by, status, decidedAt: new Date().toISOString() });
      B.audit(state, B.roles[by], 'Manual Discount Override ' + status.toLowerCase(), item.id, account);
      return item;
    });
  }

  function payment() {
    const state = B.read();
    const hold = Recovery.checkoutBlock(state, Boolean(draft.reservation));
    if (hold) { say(hold, true); return; }
    const databaseSource = Recovery.info(state).active;
    const snapshot = totals(state);
    const draftId = draft.id;
    Staff.dialog('Take Payment', '<div class="checkout-due"><span>Amount due</span><strong>' + B.money(snapshot.due) +
      '</strong></div><label>Payment method<select name="method"><option value="cash">Cash</option>' +
      '<option value="wallet">Manually Verified Static-QR E-Wallet</option></select></label><div id="payment-fields"></div>',
      async form => {
        const data = new FormData(form);
        const method = data.get('method');
        const result = await B.update(current => {
          if (!Staff.allowed('cashier', 'payment')) throw Error('Sale finalization is unavailable for this role.');
          const hold = Recovery.checkoutBlock(current, Boolean(draft?.reservation));
          if (hold) throw Error(hold);
          if (Recovery.info(current).active !== databaseSource) throw Error('The POS database changed. Reopen payment to continue.');
          if (!draft || draft.id !== draftId || draft.generation !== current.generation || pending(current) ||
              current.sales.some(item => item.draftId === draft.id)) throw Error('This transaction cannot be finalized.');
          const linked = activeReservation(current);
          if (blocked(current) || (linked && current.sales.some(item => item.reservation === linked.code)))
            throw Error('This Reservation already has a finalized sale or is unavailable.');
          const total = totals(current);
          if (total.invalidCoupon || total.due !== snapshot.due || total.label !== snapshot.label)
            throw Error('The amount due changed. Close payment and review the sale.');
          const cash = method === 'cash';
          const received = cash ? Math.round(Number(data.get('received')) * 100) : total.due;
          const reference = cash ? '' : data.get('reference').trim().toUpperCase();
          const provider = cash ? '' : data.get('provider');
          if (cash && (!Number.isSafeInteger(received) || received < total.due))
            throw Error('Enter cash received of at least ' + B.money(total.due) + '.');
          if (!cash) {
            const duplicate = current.sales.map(sale => B.effectiveSale(current, sale))
              .find(item => item.provider === provider && item.reference === reference);
            const reason = !reference || !data.get('verified') ? 'Payment could not be independently verified.' :
              duplicate ? 'Duplicate E-Wallet Transaction Reference Number for this provider.' : '';
            if (reason) {
              B.paymentIssue(current, { type: 'E-wallet payment', reason, provider, reference,
                transaction: draft.id, saleId: duplicate?.id });
              B.audit(current, B.roles.cashier, 'E-wallet payment flagged', draft.id + ' · ' + reason);
              return { failure: reason };
            }
          }
          const client = current.profiles.find(item => item.id === draft.clientId);
          const sale = { ...total, id: B.uid('TX'), draftId: draft.id, clientId: draft.clientId,
            client: client.fullName, reservation: draft.reservation, items: draft.items, method, received,
            change: received - total.due, reference, provider, verified: !cash, at: new Date().toISOString(), prints: 0, source: databaseSource };
          current.sales.push(sale);
          if (!cash) B.audit(current, B.roles.cashier, 'E-wallet payment verified', sale.id + ' · ' + provider);
          B.audit(current, B.roles.cashier, 'Transaction finalized', sale.id);
          if (linked) {
            linked.status = 'Completed';
            B.audit(current, B.roles.cashier, 'Reservation completed', linked.code);
          }
          return sale;
        });
        if (result.failure) throw Error(result.failure);
        draft = null;
        save();
        sessionStorage.setItem(lastKey, result.id);
        say('Payment recorded. Transaction ' + result.id + ' finalized.');
        refresh();
        receipt(result);
        return false;
      }, { submitLabel: 'Finalize & Issue Receipt' });
    const form = Staff.modal.querySelector('form');
    const area = form.querySelector('#payment-fields');
    function fields() {
      area.innerHTML = form.elements.method.value === 'cash' ?
        '<label>Cash received (₱)<input name="received" type="number" inputmode="decimal" min="0" step="0.01" required></label>' +
        '<p class="quiet" id="change-estimate" role="status">Change: ' + B.money(0) + '</p>' :
        '<p>Check that payment via the clinic’s static QR was received on the clinic device.</p>' +
        '<label>E-wallet provider<select name="provider"><option>GCash</option><option>Maya</option></select></label>' +
        '<label>E-Wallet Transaction Reference Number<input name="reference" required maxlength="45" autocomplete="off"></label>' +
        '<label class="check-row"><input name="verified" type="checkbox"><span>I verified the amount and reference on the clinic device.</span></label>';
      form.elements.received?.addEventListener('input', event => {
        area.querySelector('#change-estimate').textContent = 'Change: ' +
          B.money(Math.max(0, Math.round(Number(event.target.value) * 100) - snapshot.due));
      });
    }
    form.elements.method.addEventListener('change', fields);
    fields();
  }

  function receiptMarkup(sale) {
    const line = (label, value) => '<div><dt>' + B.safe(label) + '</dt><dd>' + B.safe(value) + '</dd></div>';
    return '<article class="receipt"><header><strong>' + B.name + '</strong><h3>Non-BIR Transaction Receipt</h3>' +
      (sale.prints ? '<p class="reprint">REPRINT</p>' : '') + '</header><dl>' +
      line('Transaction Number', sale.id) + line('Date and time', B.stamp(sale.at)) + line('Client', sale.client) +
      (sale.reservation ? line('Reservation Code', sale.reservation) : '') +
      '</dl><ul>' + sale.items.map(item => '<li><span>' + B.safe(item.label) + (item.bundleLabel ? '<small>Part of ' + B.safe(item.bundleLabel) + '</small>' : '') + '</span><strong>' +
        B.money(item.price) + '</strong></li>').join('') + '</ul><dl>' +
      line('Subtotal', B.money(sale.subtotal)) + line(sale.label || 'Discount', B.money(sale.amount)) +
      line('Total paid', B.money(sale.due)) +
      line('Payment method', sale.method === 'cash' ? 'Cash' : 'Manually Verified Static-QR E-Wallet') +
      (sale.method === 'cash' ? line('Cash received', B.money(sale.received)) + line('Change', B.money(sale.change)) :
        line('E-wallet provider', sale.provider) + line('Reference number', sale.reference) + line('Verification', 'Verified')) +
      line('Issued by', 'Cashier/Receptionist · Front Desk') + '</dl></article>';
  }

  function receipt(sale) {
    Staff.dialog('Transaction Receipt', '<div id="receipt-preview">' + receiptMarkup(sale) + '</div>' +
      '<p class="message" role="status"></p><button class="button primary" id="print-receipt" type="button">Print Receipt</button>');
    const button = Staff.modal.querySelector('#print-receipt');
    button.disabled = !Staff.allowed('cashier', 'receipts');
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const printable = await B.update(state => {
          if (!Staff.allowed('cashier', 'receipts')) throw Error('Receipt printing is unavailable for this role.');
          const record = state.sales.find(item => item.id === sale.id);
          if (!record) throw Error('Transaction Receipt unavailable.');
          const snapshot = { ...B.effectiveSale(state, record) };
          record.prints += 1;
          B.audit(state, B.roles.cashier, snapshot.prints ? 'Transaction Receipt reprinted' : 'Transaction Receipt printed', record.id);
          return snapshot;
        });
        document.querySelector('#receipt-print').innerHTML = receiptMarkup(printable);
        window.print();
        Staff.modal.querySelector('#receipt-preview').innerHTML = receiptMarkup(printable);
      } catch (error) { B.message(Staff.modal.querySelector('.message'), error.message, true); }
      finally { button.disabled = false; }
    });
  }

  function handleAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    switch (button.dataset.action) {
      case 'find': findReservation(); break;
      case 'walk-in': walkIn(); break;
      case 'profile': lookupProfile(); break;
      case 'receipt': findReceipt(); break;
      case 'add': editItem(button.dataset.id, false); break;
      case 'remove': editItem(button.dataset.id, true); break;
      case 'pay': payment(); break;
      case 'last-receipt': {
        const state = B.read();
        const last = state.sales.find(item => item.id === sessionStorage.getItem(lastKey));
        if (last && Staff.allowed('cashier', 'receipts')) receipt(B.effectiveSale(state, last));
        break;
      }
    }
  }

  return { open, sync, decide };
})();
