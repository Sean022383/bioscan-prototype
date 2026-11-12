'use strict';

(() => {
  const B = Bioscan;
  const work = document.querySelector('#reservation-work');
  const summary = document.querySelector('#reservation-summary');
  const steps = document.querySelector('#steps');
  const chosen = new Set();
  let step = 0;
  let details;
  let date = B.day(1);
  let time = '';
  let otpExpires = 0;
  let otp = "";
  let otpStatus = "";
  let confirmation;
  let submitting = false;
  const stepTitles = ['Select Diagnostic Services', 'Enter Client details', 'Appointment Date and Time Slot',
    'Verify your mobile number', 'Reservation confirmed'];

  function renderSummary() {
    const lines = confirmation?.items ?? B.serviceLines([...chosen]);
    summary.innerHTML = '<h2>Reservation summary</h2>' + (lines.length
      ? '<ul class="summary-list">' + lines.map(item => '<li><span>' + B.safe(item.label) + '</span><strong>' +
        B.compactMoney(item.price) + '</strong></li>').join('') + '</ul><div class="summary-total"><span>Estimated total</span><strong>' +
        B.money(lines.reduce((total, line) => total + line.price, 0)) + '</strong></div>'
      : '<p class="quiet">Selected services and estimated prices will appear here.</p>') +
      (time ? '<dl class="summary-appointment"><dt>Appointment Date and Time Slot</dt><dd>' +
        B.appointment(date, time) + '</dd></dl>' : '');
  }

  function serviceStep() {
    return '<div class="search-tools"><label>Search services<input id="pick-search" type="search" placeholder="Search by test name"></label>' +
      '<label>Category<select id="pick-category">' + B.categoryOptions() + '</select></label></div>' +
      '<div id="pick-list" class="pick-list" aria-label="Available Diagnostic Services"></div>' +
      '<p id="pick-count" class="quiet" role="status"></p>';
  }

  function slotStep() {
    return '<label class="date-field">Appointment date<input name="date" type="date" min="' + B.day() + '" max="' + B.day(30) +
      '" value="' + B.safe(date) + '" required></label><fieldset class="slot-field"><legend>Time slot <span class="quiet">(Philippine time)</span></legend>' +
      '<div class="slot-grid" id="slots"></div></fieldset>';
  }

  async function issueOtp() {
    otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    otpExpires = Date.now() + 300000;
    otpStatus = await B.update(state => B.notify(state, 'OTP', details.mobile, 'BioScan verification code: ' + otp));
  }

  function verificationStep() {
    return '<p>Verification for the mobile number ending in <strong>' + B.safe(details.mobile.slice(-4)) + '</strong>.</p>' +
      (otpStatus === 'Delivered' ? '<details class="notice"><summary>View simulated SMS</summary><p>Verification code <strong>' +
        B.safe(otp) + '</strong> · valid for 5 minutes</p></details>' :
        '<p class="notice">SMS delivery failed. Request a new code to continue.</p>') +
      '<label class="date-field">Verification code<input name="otp" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"></label>' +
      '<button type="button" class="link-button" id="resend">Get a new verification code</button>';
  }

  function confirmationStep() {
    const state = B.read();
    const record = state.reservations.find(item => item.code === confirmation.code) ?? confirmation;
    const messages = state.sms.filter(item => item.reservation === record.code && item.status === 'Delivered');
    return '<p>Present this Reservation Code at the front desk when you arrive.</p>' +
      '<div class="code-sheet"><span>Reservation Code</span><strong id="confirmed-code">' + B.safe(confirmation.code) + '</strong>' +
      '<button class="button secondary" id="copy-code" type="button">Copy code</button></div>' +
      '<dl class="detail-list"><div><dt>Appointment Date and Time Slot</dt><dd>' + B.appointment(record.date, record.time) + '</dd></div>' +
      '<div><dt>Status</dt><dd>' + B.status(record.status) + '</dd></div><div><dt>Confirmation SMS</dt><dd>' +
      B.status(confirmation.smsStatus) + '</dd></div></dl>' +
      (messages.length ? '<details class="notice"><summary>View simulated SMS messages</summary><ul class="history-list">' +
        messages.map(item => '<li>' + B.safe(item.message) + '</li>').join('') + '</ul></details>' : '') +
      '<p id="step-message" role="status" class="message"></p>' +
      '<div class="actions"><a class="button primary" href="index.html">Back to home</a><a class="text-link" href="reservation.html">Make another Reservation</a></div>';
  }

  function render(focus = true) {
    [...steps.children].forEach((item, index) => {
      item.classList.toggle('finished', index < step);
      if (index === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    const content = [serviceStep, () => '<div class="form-grid">' + B.clientFields() + '</div>', slotStep, verificationStep, confirmationStep][step]();
    const heading = '<h2 id="step-title" tabindex="-1">' + stepTitles[step] + '</h2>';
    work.innerHTML = heading + (step === 4 ? content : '<form id="reservation-form">' + content +
      '<p class="message" id="step-message" role="status"></p><div class="step-actions">' +
      (step ? '<button type="button" class="button secondary" id="step-back">Back</button>' : '') +
      '<button type="submit" class="button primary">' + ['Continue', 'Continue', 'Continue to verification', 'Confirm Reservation'][step] +
      '</button></div></form>');
    renderSummary();
    if (step < 4) wireForm();
    if (step === 4) wireConfirmation();
    if (focus) {
      const title = work.querySelector('#step-title');
      title.focus({ preventScroll: true });
      title.scrollIntoView({ block: 'nearest' });
    }
  }

  function drawOptions() {
    const query = work.querySelector('#pick-search');
    const category = work.querySelector('#pick-category');
    const list = work.querySelector('#pick-list');
    const options = B.search(B.services().filter(item => item.available), query.value, category.value);
    list.innerHTML = options.map(item => '<label class="pick-row"><input type="checkbox" value="' + item.id +
      '"' + (chosen.has(item.id) ? ' checked' : '') + '><span><strong>' + B.safe(item.label) +
      '</strong><small>' + B.safe(item.category) + '</small></span><span class="numeric">' +
      B.compactMoney(item.price) + '</span></label>').join('') || '<p class="empty">No available services match your search.</p>';
    work.querySelector('#pick-count').textContent = chosen.size + ' selected';
  }

  function drawSlots() {
    const slots = work.querySelector('#slots');
    const state = B.read();
    slots.innerHTML = date ? B.times.map(value => {
      const available = B.validSlot(state, date, value, undefined, [...chosen]);
      return '<label class="slot-option"><input type="radio" name="time" value="' + value + '"' +
        (time === value && available ? ' checked' : '') + (available ? '' : ' disabled') +
        '><span>' + B.timeLabel(value) + (available ? '' : '<small>Unavailable</small>') + '</span></label>';
    }).join('') : '<p class="quiet">Choose a date to see time slots.</p>';
  }

  function wireForm() {
    const form = work.querySelector('form');
    const msg = work.querySelector('#step-message');
    work.querySelector('#step-back')?.addEventListener('click', () => {
      if (step === 1) {
        try { details = B.clientDetails(form); } catch { /* Keep the last valid Client details. */ }
      }
      step -= 1;
      render();
    });
    if (step === 0) {
      drawOptions();
      work.querySelector('#pick-search').addEventListener('input', drawOptions);
      work.querySelector('#pick-category').addEventListener('change', drawOptions);
      work.querySelector('#pick-list').addEventListener('change', event => {
        const item = event.target;
        if (item.checked) chosen.add(item.value); else chosen.delete(item.value);
        work.querySelector('#pick-count').textContent = chosen.size + ' selected';
        B.message(msg, '');
        renderSummary();
      });
    }
    if (step === 1 && details) {
      for (const [name, value] of Object.entries(details)) form.elements[name].value = value;
    }
    if (step === 2) {
      drawSlots();
      form.addEventListener('change', event => {
        if (event.target.name === 'date') {
          date = event.target.value;
          time = '';
          drawSlots();
        }
        if (event.target.name === 'time') time = event.target.value;
        B.message(msg, '');
        renderSummary();
      });
    }
    work.querySelector('#resend')?.addEventListener('click', async event => {
      event.target.disabled = true;
      try { await issueOtp(); render(false); work.querySelector('form').elements.otp.focus(); }
      catch (error) { B.message(msg, error.message, true); event.target.disabled = false; }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submitting) return;
      try {
        if (step === 0 && !chosen.size) throw Error('Select at least one Diagnostic Service.');
        if (step === 1) details = B.clientDetails(form);
        if (step === 2) {
          time = new FormData(form).get('time') || '';
          if (!B.validSlot(B.read(), date, time, undefined, [...chosen])) { drawSlots(); throw Error('Choose an available time slot.'); }
          submitting = true;
          try { await issueOtp(); } finally { submitting = false; }
        }
        if (step === 3) {
          if (Date.now() > otpExpires) throw Error('This code has expired. Get a new verification code.');
          if (otpStatus !== 'Delivered' || form.elements.otp.value !== otp) throw Error('Enter the six-digit code from the simulated SMS.');
          submitting = true;
          try {
            confirmation = await B.update(state => {
              if (!B.validSlot(state, date, time, undefined, [...chosen])) throw Error('That time slot is full or has passed. Go back and choose another.');
              const available = B.services(state).filter(item => item.available);
              if ([...chosen].some(id => !available.some(item => item.id === id)))
                throw Error('A selected service became unavailable. Go back to update your selections.');
              const profile = B.findOrCreateClient(state, details);
              if (state.reservations.some(item => item.clientId === profile.id && item.date === date && item.time === time &&
                ['Confirmed', 'Completed'].includes(item.status))) throw Error('This Client already has a Reservation for that appointment slot.');
              const record = { code: B.uid('BS'), clientId: profile.id, date, time, status: 'Confirmed',
                items: B.serviceLines([...chosen], state) };
              record.smsStatus = B.notify(state, 'Reservation confirmation', profile.mobile,
                'Your Reservation ' + record.code + ' is confirmed for ' + B.appointment(date, time) + '.', record.code);
              state.reservations.push(record);
              B.audit(state, 'Client', 'Reservation confirmed', record.code);
              return record;
            });
          } finally { submitting = false; }
        }
        step += 1;
        render();
      } catch (error) { B.message(msg, error.message, true); }
    });
  }

  function wireConfirmation() {
    work.querySelector('#copy-code').addEventListener('click', async () => {
      const msg = work.querySelector('#step-message');
      try {
        await navigator.clipboard.writeText(confirmation.code);
        B.message(msg, 'Reservation Code copied.');
      } catch {
        const range = document.createRange();
        range.selectNodeContents(work.querySelector('#confirmed-code'));
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        B.message(msg, 'Code selected. Use your browser’s copy command.');
      }
    });
  }

  const updateFooter = () => { document.querySelector('#reservation-footer-address').textContent = B.read().clinic.address; };
  updateFooter();
  addEventListener('storage', event => {
    if (event.key !== B.key) return;
    updateFooter();
    if (step === 4) { render(false); return; }
    if (step === 0) {
      const available = new Set(B.services().filter(item => item.available).map(item => item.id));
      for (const id of chosen) if (!available.has(id)) chosen.delete(id);
      drawOptions();
    }
    if (step === 2) drawSlots();
    renderSummary();
  });
  render(false);
})();
