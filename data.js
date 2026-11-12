'use strict';

const Bioscan = (() => {
  const name = 'BioScan Laboratories';
  const address = '6 Lanzones Street, Potrero, Metro Manila';
  const key = 'bioscan-prototype:v1:shared';
  const roles = { cashier: 'Cashier/Receptionist', manager: 'Clinic Manager', admin: 'System Administrator' };
  const times = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00'];
  const groups = {
    'Clinical Microscopy': [
      ['Routine Urinalysis', 100, 'urinalysis'], ['Pregnancy Test (Urine)', 180], ['Routine Stool', 150],
      ['Occult Blood', 150], ['Cotinine', 350]
    ],
    Hematology: [
      ['CBC with Platelet', 280, 'cbc'], ['HGB & HCT (Manual)', 100], ['ESR', 200], ['C.T. & B.T.', 120],
      ['Protime', 300], ['PTT', 370], ['Blood Typing / Rh', 170], ['Malarial Smear', 300], ['Reticulocyte Count', 300]
    ],
    Chemistry: [
      ['FBS', 120, 'fbs', 'Fasting Blood Sugar'], ['BUN', 150, '', 'Blood Urea Nitrogen'], ['Creatinine', 150],
      ['Uric Acid', 150], ['Cholesterol', 170], ['Triglyceride', 200], ['HDL / LDL', 300],
      ['SGOT', 200], ['SGPT', 200], ['Alkaline Phosphatase', 200], ['Total Protein TP/AG', 250],
      ['Bilirubin', 250], ['Sodium', 220], ['Potassium', 220], ['Calcium', 250], ['Chloride', 220],
      ['Phosphorus', 250], ['Magnesium', 350], ['HbA1c', 500], ['Amylase', 350], ['Lipase', 370],
      ['LDH', 350], ['CPK', 350], ['Ionized Calcium', 500], ['Iron', 500], ['Iron & TIBC', 1200], ['OGTT', 700]
    ],
    Serology: [
      ['VDRL', 200], ['RPR', 200], ['Pregnancy (Serum)', 250], ['RA Latex', 350], ['CRP', 350],
      ['Widal', 500], ['Weil-Felix', 500], ['HIV 1 & 2', 400], ['Typhidot IgM', 1300], ['NS1Ag', 1000],
      ['Semen Analysis', 300], ['Leptospirosis', 700]
    ],
    'Thyroid Function': [['T3', 350], ['T4', 350], ['TSH', 500], ['FT3', 450], ['FT4', 450]],
    'Hepatitis Profile': [
      ['HBsAg', 280], ['Anti-HBs', 320], ['Anti-HBc IgG', 400], ['Anti-HAV IgM', 500],
      ['HBeAg', 400], ['Anti-HBe', 400], ['Anti-HBc IgM', 500], ['Anti-HAV IgG', 500], ['Anti-HCV', 700]
    ],
    'X-ray': [
      ['Chest X-ray – PAL (2 Views)', 490], ['Chest X-ray – Spot View', 390],
      ['Chest X-ray – PA + Apicolordotic (2 Views)', 600], ['Skull X-ray – PA/AP', 450],
      ['Skull X-ray – Lateral', 450], ['Cervical X-ray – PAL/APL (2 Views)', 700],
      ['Shoulder X-ray – AP Adult', 450], ['Clavicle X-ray – AP', 350], ['Thoracic Spine X-ray – AP', 550],
      ['Lumbar Spine X-ray – AP', 550], ['Pelvic X-ray – AP', 500], ['Femur X-ray – AP', 430],
      ['Knee X-ray – AP', 430], ['Ankle X-ray – AP', 300], ['Foot X-ray – AP/Dorsoplantar', 330],
      ['Hand X-ray – PA', 330], ['Wrist X-ray – PAL', 600]
    ],
    Ultrasound: [
      ['Whole Abdomen Ultrasound', 1800], ['Upper Abdomen Ultrasound', 1100],
      ['Lower Abdomen Ultrasound (Male)', 850], ['Lower Abdomen Ultrasound (Female)', 850],
      ['KUB Ultrasound', 750], ['HBT Ultrasound', 800], ['Liver Ultrasound', 500],
      ['Gallbladder Ultrasound', 500], ['Kidneys Ultrasound', 500], ['Pancreas Ultrasound', 500],
      ['Spleen Ultrasound', 500], ['Aorta Ultrasound', 500], ['Thyroid Ultrasound', 900],
      ['Breast Ultrasound', 1200], ['Pelvic Ultrasound', 600]
    ],
    ECG: [['ECG (Regular)', 350]]
  };
  const catalog = Object.entries(groups).flatMap(([category, entries]) => entries.map(
    ([label, pesos, id, alias]) => ({
      id: id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''),
      label, price: pesos * 100, alias, category,
      eligible: ['urinalysis', 'cbc', 'fbs'].includes(id) || category === 'Ultrasound'
    })
  ));
  const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
  const money = cents => peso.format(cents / 100);
  const compactMoney = cents => cents % 100 ? money(cents) : money(cents).slice(0, -3);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const uid = prefix => prefix + '-' + Array.from(crypto.getRandomValues(new Uint8Array(5)),
    byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();

  const localDate = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Manila'
  });
  function dateKey(date) {
    const parts = Object.fromEntries(localDate.formatToParts(date)
      .map(({ type, value }) => [type, value]));
    return [parts.year, parts.month, parts.day].join('-');
  }
  const day = (offset = 0) => dateKey(new Date(Date.now() + offset * 86400000));
  function dateLabel(date) {
    return new Intl.DateTimeFormat('en-PH', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Manila' })
      .format(new Date(date + 'T12:00:00+08:00'));
  }
  function timeLabel(time) {
    const [hour, minute] = time.split(':').map(Number);
    return (hour % 12 || 12) + ':' + String(minute).padStart(2, '0') + (hour < 12 ? ' AM' : ' PM');
  }
  const stamp = date => new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila'
  }).format(new Date(date));
  const appointment = (date, time) => dateLabel(date) + ' · ' + timeLabel(time);

  function initial(staffAccounts = []) {
    return {
      generation: uid('DATA'), capacity: 3, serviceSettings: {}, customServices: [],
      profiles: [{ id: 'CL-1001', fullName: 'Mara Santos', mobile: '09170000001', age: 34, sex: 'Female' }],
      reservations: [], approvals: [], sales: [], audit: [], staffAccounts,
      coupons: [{ code: 'CARE10', label: 'Care 10', kind: 'percent', value: 10, active: true, start: day(-30),
        end: day(60), limit: 30, perClient: 1, serviceIds: ['cbc', 'fbs', 'urinalysis'] }]
    };
  }
  const clinicDefaults = {
    hours: 'Monday–Saturday, 7:00 AM–4:00 PM', phone: '(02) 8361-4295',
    email: 'bioscanlab@yahoo.com', sample: true
  };
  const clinicExterior = {
    src: 'assets/bioscan-clinic-exterior.png', caption: 'BioScan Clinical Laboratory exterior',
    width: 2048, height: 1365
  };

  function ensureSimulation(state) {
    state.clinic ??= { name, address, ...clinicDefaults, photos: [] };
    const clinic = state.clinic;
    let migrated = false;
    if (!clinic.contactVersion) {
      clinic.phone = clinicDefaults.phone;
      clinic.email = clinicDefaults.email;
      clinic.photos ??= [];
      if (!clinic.photos.some(photo => photo.src === clinicExterior.src)) clinic.photos.unshift(clinicExterior);
      clinic.contactVersion = 1;
      migrated = true;
    }
    if (Object.hasOwn(state, 'roleRestrictions')) {
      delete state.roleRestrictions;
      migrated = true;
    }
    for (const key of ['closures', 'sms', 'paymentIssues', 'corrections']) state[key] ??= [];
    state.settings ??= { smsAvailable: true, automaticSync: true };
    return migrated;
  }

  function notify(state, type, mobile, message, reservation = '', key = '') {
    if (key && state.sms.some(item => item.key === key && item.status === 'Delivered')) return;
    const status = state.settings.smsAvailable ? 'Delivered' : 'Failed';
    state.sms.unshift({ id: uid('SMS'), type, mobile, message, reservation, key, status, at: new Date().toISOString() });
    return status;
  }

  function advance(state) {
    let changed = false;
    for (const reservation of state.reservations) {
      if (reservation.status !== 'Confirmed') continue;
      if (reservation.date < day()) {
        reservation.status = 'No-Show';
        audit(state, 'System', 'Reservation marked No-Show', reservation.code);
        changed = true;
      } else {
        const at = new Date(reservation.date + 'T' + reservation.time + ':00+08:00').getTime();
        if (at <= Date.now() || at - Date.now() > 86400000) continue;
        const key = 'reminder:' + reservation.code + ':' + reservation.date + ':' + reservation.time;
        const client = state.profiles.find(item => item.id === reservation.clientId);
        if (client && !state.sms.some(item => item.key === key)) {
          notify(state, 'Appointment reminder', client.mobile,
            'Your BioScan appointment is ' + appointment(reservation.date, reservation.time) + '.', reservation.code, key);
          changed = true;
        }
      }
    }
    return changed;
  }

  function scheduleBlocks(state, date, time, serviceIds = []) {
    const at = date + 'T' + time;
    return state.closures.filter(item => item.start <= at && at < item.end &&
      (!item.serviceId || serviceIds.includes(item.serviceId)));
  }

  function reservationImpact(state, reservation) {
    const ids = reservation.items.map(item => item.id);
    return [
      ...scheduleBlocks(state, reservation.date, reservation.time, ids).map(item => item.reason),
      ...services(state).filter(item => !item.available && ids.includes(item.id)).map(item => item.label + ' is unavailable')
    ];
  }

  function effectiveSale(state, sale) {
    const correction = state.corrections.find(item => item.saleId === sale.id);
    return correction ? { ...sale, ...correction.payment } : sale;
  }

  function paymentIssue(state, { type, reason, provider = '', reference = '', transaction = '', saleId = '' }) {
    state.paymentIssues.unshift({ id: uid('ISS'), type, reason, provider, reference, transaction, saleId,
      status: 'Pending', at: new Date().toISOString() });
  }

  function clientSummary(state, client, limited = false) {
    const details = Object.entries({ 'Client ID': client.id, 'Mobile number': client.mobile, Age: client.age, Sex: client.sex })
      .map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + safe(value) + '</dd></div>').join('');
    const byDate = (a, b) => (b.date + b.time).localeCompare(a.date + a.time);
    const reservations = state.reservations.filter(item => item.clientId === client.id).sort(byDate);
    const sales = state.sales.filter(item => item.clientId === client.id).slice().reverse();
    const recent = list => limited ? list.slice(0, 5) : list;
    return '<dl class="detail-list">' + details + '</dl><h3>' + (limited ? 'Recent Reservations' : 'Reservations') + '</h3>' +
      (reservations.length ? '<ul class="history-list">' + recent(reservations).map(item => '<li><strong>' + safe(item.code) +
        '</strong> · ' + appointment(item.date, item.time) + ' · ' + safe(reservationStatus(item)) + '</li>').join('') +
        '</ul>' : '<p class="quiet">No Reservations.</p>') +
      '<h3>' + (limited ? 'Recent transactions' : 'Transactions') + '</h3>' +
      (sales.length ? '<ul class="history-list">' + recent(sales).map(sale => '<li><strong>' + safe(sale.id) +
        '</strong> · ' + stamp(sale.at) + ' · ' + money(sale.due) + '</li>').join('') + '</ul>' :
        '<p class="quiet">No finalized transactions.</p>');
  }

  function read() {
    const current = JSON.parse(localStorage.getItem(key) || 'null') ?? initial();
    current.staffAccounts ??= [];
    const migrated = ensureSimulation(current);
    const seeded = !current.sampleDataVersion;
    if (seeded) {
      current.customServices ??= [];
      SampleData.seed(current, { day, serviceLines, times, roles });
      current.sampleDataVersion = 1;
    }
    if (advance(current) || seeded || migrated) localStorage.setItem(key, JSON.stringify(current));
    return current;
  }
  function update(action) {
    const commit = () => {
      const state = read();
      const result = action(state);
      localStorage.setItem(key, JSON.stringify(state));
      return result;
    };
    return navigator.locks ? navigator.locks.request(key, commit) : Promise.resolve().then(commit);
  }
  function services(state = read()) {
    return [...catalog, ...state.customServices].map(item => ({ available: true, ...item, ...state.serviceSettings[item.id] }));
  }
  function serviceLines(ids, state = read()) {
    return services(state).filter(item => ids.includes(item.id)).map(({ id, label, price, eligible }) =>
      ({ id, label, price, eligible }));
  }
  function search(items, term, category = '') {
    const query = term.trim().toLowerCase();
    return items.filter(item => (!category || item.category === category) &&
      [item.label, item.category, item.alias].some(value => value?.toLowerCase().includes(query)));
  }
  function categoryOptions() {
    return '<option value="">All categories</option>' + Object.keys(groups)
      .map(category => '<option>' + safe(category) + '</option>').join('');
  }
  function validSlot(state, date, time, exceptCode, serviceIds = []) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= day() && date <= day(30) &&
      times.includes(time) && new Date(date + 'T' + time + ':00+08:00').getTime() > Date.now() &&
      !scheduleBlocks(state, date, time, serviceIds).length &&
      state.reservations.filter(r => r.date === date && r.time === time && r.code !== exceptCode &&
        ['Confirmed', 'Completed'].includes(r.status)).length < state.capacity;
  }
  function reservationStatus(reservation) {
    return reservation.status === 'Confirmed' && reservation.date < day() ? 'No-Show' : reservation.status;
  }
  function findOrCreateClient(state, details) {
    const match = state.profiles.find(item => item.mobile === details.mobile &&
      item.fullName.toLowerCase() === details.fullName.toLowerCase());
    if (match) return match;
    const profile = { id: uid('CL'), ...details };
    state.profiles.push(profile);
    return profile;
  }
  function clientFields() {
    return '<label>Full name<input name="fullName" required maxlength="90" autocomplete="off"></label>' +
      '<label>Mobile number<input name="mobile" required inputmode="tel" type="tel" maxlength="18" placeholder="09XX XXX XXXX" autocomplete="off"></label>' +
      '<label>Age<input name="age" required type="number" inputmode="numeric" min="0" max="125"></label>' +
      '<label>Sex<select name="sex" required><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label>';
  }
  function clientDetails(form) {
    const entries = new FormData(form);
    const fullName = entries.get('fullName').trim().replace(/\s+/g, ' ');
    const mobile = entries.get('mobile').replace(/[\s()-]/g, '').replace(/^\+63/, '0');
    if (!fullName || !/^09\d{9}$/.test(mobile)) throw Error('Enter a full name and a valid Philippine mobile number.');
    return { fullName, mobile, age: Number(entries.get('age')), sex: entries.get('sex') };
  }
  function audit(state, actor, action, detail, account) {
    const session = JSON.parse(sessionStorage.getItem('bioscan-prototype:v1:staff-identity') || 'null');
    state.audit.unshift({ actor, action, detail, account: account ?? (roles[session?.role] === actor ? session.username : ''),
      at: new Date().toISOString() });
  }
  function status(label) {
    const tone = ['Confirmed', 'Completed', 'Approved', 'Available', 'Active', 'Ready', 'Online', 'Successful', 'Verified', 'Delivered', 'Resolved'].includes(label) ? 'good' :
      ['Pending', 'On hold', 'In progress'].includes(label) ? 'pending' :
      ['Cancelled', 'Declined', 'No-Show', 'Offline', 'Failed'].includes(label) ? 'muted' : 'neutral';
    return '<span class="status ' + tone + '">' + safe(label) + '</span>';
  }
  function message(target, text, error = false) {
    target.textContent = text;
    target.classList.toggle('error', error);
  }
  return { name, address, key, roles, times, catalog, money, compactMoney, safe, uid, day, dateKey, dateLabel,
    timeLabel, stamp, appointment, read, update, services, serviceLines, search, categoryOptions, validSlot,
    reservationStatus, findOrCreateClient, clientFields, clientDetails, audit, status, message,
    notify, scheduleBlocks, reservationImpact, effectiveSale, paymentIssue, clientSummary };
})();

setInterval(() => Bioscan.read(), 60000);
