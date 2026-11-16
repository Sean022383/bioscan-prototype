'use strict';

const Bioscan = (() => {
  const name = 'BioScan Laboratories';
  const address = '6 Lanzones Street, Potrero, Metro Manila';
  const key = 'bioscan-prototype:v1:shared';
  const roles = { cashier: 'Cashier/Receptionist', manager: 'Clinic Manager', admin: 'System Administrator', medtech: 'Medical Technologist' };
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

  function clientSummary(state, client, limited = false, serviceIds = null) {
    const details = Object.entries({ 'Client ID': client.id, 'Mobile number': client.mobile, Age: client.age, Sex: client.sex })
      .map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + safe(value) + '</dd></div>').join('');
    const scoped = Array.isArray(serviceIds);
    const visible = items => (items || []).filter(item => !scoped || serviceIds.includes(item.id));
    const byDate = (a, b) => (b.date + b.time).localeCompare(a.date + a.time);
    const reservations = state.reservations.filter(item => item.clientId === client.id && visible(item.items).length).sort(byDate);
    const sales = state.sales.filter(item => item.clientId === client.id && visible(item.items).length).map(sale => effectiveSale(state, sale)).sort((a, b) => b.at.localeCompare(a.at));
    const recent = list => limited ? list.slice(0, 5) : list;
    const field = (label, value) => '<div><dt>' + safe(label) + '</dt><dd>' + safe(value ?? 'Not recorded') + '</dd></div>';
    const sum = items => items.reduce((total, item) => total + item.price, 0);
    const lineTable = items => '<div class="table-wrap"><table><thead><tr><th scope="col">Service</th><th scope="col" class="numeric">Amount</th></tr></thead><tbody>' + items.map(item =>
      '<tr><td>' + safe(item.label) + (item.bundleLabel ? '<small>Part of ' + safe(item.bundleLabel) + '</small>' : '') + '</td><td class="numeric">' + money(item.price) + '</td></tr>').join('') + '</tbody></table></div>';
    const transactions = recent(sales).map(sale => {
      const items = visible(sale.items);
      const subtotal = sale.subtotal ?? sum(sale.items);
      const due = sale.due ?? subtotal;
      const amount = scoped ? sum(items) : due;
      const actor = state.audit.find(a => a.action === 'Transaction finalized' && a.detail === sale.id)?.account;
      return '<details class="profile-record"><summary><strong>' + safe(sale.id) + '</strong><span>' + stamp(sale.at) + '</span><span class="profile-record-amount">' + money(amount) + '</span></summary><div class="profile-record-body">' +
        lineTable(items) + '<dl class="detail-list">' + (scoped ? field('Listed services subtotal (before discounts)', money(amount)) :
        field('Subtotal', money(subtotal)) + field(sale.label || 'Discount', money(sale.amount || 0)) + field('Total paid', money(due))) +
        field('Payment method', sale.method === 'cash' ? 'Cash' : sale.method === 'wallet' ? 'E-wallet · ' + (sale.provider || '') : 'Not recorded') +
        (!scoped && sale.method === 'cash' ? field('Cash received', sale.received == null ? null : money(sale.received)) + field('Change', sale.change == null ? null : money(sale.change)) : '') +
        (!scoped && sale.method === 'wallet' ? field('Reference number', sale.reference) + field('Verification', sale.verified ? 'Verified' : 'Not recorded') : '') +
        field('Reservation', sale.reservation || 'Walk-in') + field('Recorded by', actor || 'Not recorded') + '</dl></div></details>';
    }).join('');
    const bookings = recent(reservations).map(reservation => {
      const items = visible(reservation.items);
      const linked = sales.find(s => s.reservation === reservation.code);
      return '<details class="profile-record"><summary><strong>' + safe(reservation.code) + '</strong><span>' + appointment(reservation.date, reservation.time) + '</span>' + status(reservationStatus(reservation)) + '</summary><div class="profile-record-body">' +
        lineTable(items) + '<dl class="detail-list">' + field('Estimated service total', money(sum(items))) +
        field('Appointment date', dateLabel(reservation.date)) + field('Time slot', timeLabel(reservation.time)) +
        field('Confirmation SMS', reservation.smsStatus || 'Not recorded') + field('Linked transaction', linked?.id || 'No finalized payment') +
        field('Data consent / preparation acknowledgment', reservation.consent ? stamp(reservation.consent.at) : 'Not recorded') + '</dl>' +
        (reservation.health ? '<details class="profile-health-history"><summary>Health information for this reservation</summary>' + healthSummary(reservation.health) + '</details>' : '') + '</div></details>';
    }).join('');
    return '<div class="client-profile-view"><div class="profile-overview"><section><h3>Client information</h3><dl class="detail-list">' + details + '</dl>' +
      (client.consent ? '<p class="quiet">Data-use agreement recorded ' + stamp(client.consent.at) + '.</p>' : '') + '</section><section>' + healthSummary(client.health) + '</section></div>' +
      (scoped ? '<p class="quiet profile-scope">History below includes only services assigned to your MedTech account. Listed amounts are service subtotals before transaction discounts.</p>' : '') +
      '<div class="profile-history"><section><h3>' + (limited ? 'Recent transactions' : 'Transaction history') + ' <span class="quiet">(' + sales.length + ')</span></h3><p class="quiet">Expand a transaction to view services and payment details.</p>' +
      (transactions || '<p class="empty">No finalized transactions.</p>') + '</section><section><h3>' + (limited ? 'Recent reservations' : 'Reservation history') + ' <span class="quiet">(' + reservations.length + ')</span></h3><p class="quiet">Expand a reservation to view its schedule and selected services.</p>' +
      (bookings || '<p class="empty">No reservations.</p>') + '</section></div></div>';
  }

  function read() {
    const current = JSON.parse(localStorage.getItem(key) || 'null') ?? initial();
    current.staffAccounts ??= [];
    current.careRecords ??= [];
    current.referrals ??= [];
    if (!current.medtechAccountsVersion) {
      for (const [username, fullName, serviceIds] of [
        ['medtech', 'Demo MedTech', ['urinalysis', 'cbc', 'fbs']],
        ['medtech2', 'Demo MedTech Two', ['urinalysis', 'cbc']]
      ]) {
        if (!current.staffAccounts.some(account => account.username.toLowerCase() === username))
          current.staffAccounts.push({ username, fullName, role: 'medtech', active: true, serviceIds,
            salt: '3pv49Htiodc7oaKKGQpBVw==', hash: 'ytEyFWTvFxqY4MMQAWjbCrXfoKwQXHI7hipgccDmQ3k=' });
      }
      current.medtechAccountsVersion = 1;
      localStorage.setItem(key, JSON.stringify(current));
    }
    const seededAccounts = !current.demoAccountsVersion;
    if (seededAccounts) {
      for (const [username, fullName, role] of [
        ['cashier', 'Demo Cashier', 'cashier'], ['manager', 'Demo Clinic Manager', 'manager'],
        ['admin', 'Demo System Administrator', 'admin']
      ]) {
        if (!current.staffAccounts.some(account => account.username.toLowerCase() === username))
          current.staffAccounts.push({ username, fullName, role, active: true,
            salt: '3pv49Htiodc7oaKKGQpBVw==', hash: 'ytEyFWTvFxqY4MMQAWjbCrXfoKwQXHI7hipgccDmQ3k=' });
      }
      current.demoAccountsVersion = 1;
    }
    const simpleAccounts = !current.simpleAccountsVersion;
    if (simpleAccounts) {
      const demos = [
        ['pos1', 'Demo Front Desk', 'cashier', 'A/Dqy9RnVVnuHbgbrJjdJg==', 'yy9YCBTkizcvmGeZ2MZFEsFAndqCTQfW26atm3wko40='],
        ['medtech1', 'Demo MedTech One', 'medtech', 'vPKtT+siJOVqvJkcnJ4FuA==', 'zcb6zCgCC2TYBXbj3tqIFx0Q1krfxJaUY2YbpKMZqAA='],
        ['medtech2', 'Demo MedTech Two', 'medtech', 'CBM5/tvw12smnJAUX7FHaA==', 'u3AmXABS6Q4J3omXJFEhNNOu+Q8aTzfC0IrpYLIXqXI='],
        ['clinic1', 'Demo Clinic Manager', 'manager', 'ciN9DE0Jj4kpTi4BS6vKoQ==', '2Raf40Kpd3qHvPk8K1cDcbHxuQspVQDNFXL4pqq8BEM='],
        ['admin1', 'Demo Administrator', 'admin', 'DATOJ/SWjwa/l1Udzy0RrQ==', '09wDOGuWHDF4Y9qSNUVgSQUziEdTYOvHp/WGtCDV4RI=']
      ];
      for (const [username, fullName, role, salt, hash] of demos) {
        const existing = current.staffAccounts.find(a => a.username.toLowerCase() === username);
        const demo = { username, fullName, role, salt, hash, active: true,
          serviceIds: role === 'medtech' ? (username === 'medtech2' ? ['urinalysis', 'cbc'] : ['urinalysis', 'cbc', 'fbs']) : [] };
        if (existing) Object.assign(existing, demo); else current.staffAccounts.push(demo);
      }
      current.simpleAccountsVersion = 1;
    }
    const seededBundles = current.bundleDataVersion !== 2;
    if (seededBundles) {
      current.bundles ??= [
        { id: 'bundle-lipid', label: 'Lipid Profile', serviceIds: ['cholesterol', 'triglyceride', 'hdl-ldl'], description: 'A group of blood tests measuring cholesterol and triglycerides.', price: 67000, available: true },
        { id: 'bundle-thyroid', label: 'Thyroid Panel', serviceIds: ['t3', 't4', 'tsh'], description: 'T3, T4, and TSH blood tests grouped in one booking.', price: 120000, available: true },
        { id: 'bundle-chemistry', label: 'Routine Chemistry Panel', serviceIds: ['fbs', 'bun', 'creatinine', 'uric-acid', 'cholesterol', 'triglyceride', 'hdl-ldl', 'sgpt', 'sgot'], description: 'A combined selection of glucose, kidney-related, lipid, and liver-enzyme blood tests.', price: 164000, available: true }
      ];
      if (!current.bundles.some(b => b.id === 'bundle-checkup')) current.bundles.push({ id: 'bundle-checkup', label: 'General Checkup Tests',
        serviceIds: ['cbc', 'urinalysis', 'routine-stool', 'fbs', 'chest-x-ray-pal-2-views', 'ecg-regular'],
        description: 'CBC, urinalysis, stool examination, fasting blood sugar, chest x-ray, and ECG. A tests-only bundle; a doctor’s consultation or medical certificate is not included.', price: 149000, available: true });
      current.bundleDataVersion = 2;
    }
    const migrated = ensureSimulation(current);
    const seeded = !current.sampleDataVersion;
    if (seeded) {
      current.customServices ??= [];
      SampleData.seed(current, { day, serviceLines, times, roles });
      current.sampleDataVersion = 1;
    }
    if (advance(current) || seeded || migrated || seededAccounts || simpleAccounts || seededBundles) localStorage.setItem(key, JSON.stringify(current));
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
    const selected = offerings(state).filter(item => ids.includes(item.id));
    if (new Set(ids).size !== selected.length) throw Error('A selected service or bundle is no longer available.');
    const seen = new Set();
    return selected.flatMap(item => {
      const components = item.serviceIds ? item.serviceIds.map(id => services(state).find(s => s.id === id)) : [item];
      if (components.some(c => !c)) throw Error('A bundle includes a missing service.');
      const total = components.reduce((sum, c) => sum + c.price, 0);
      let allocated = 0;
      return components.map((component, index) => {
        if (seen.has(component.id)) throw Error(component.label + ' is already included. Choose it once, either separately or in a bundle.');
        seen.add(component.id);
        const price = item.serviceIds ? (index === components.length - 1 ? item.price - allocated : Math.floor(item.price * component.price / total)) : component.price;
        allocated += price;
        return { id: component.id, label: component.label, price, eligible: component.eligible,
          ...(item.serviceIds ? { bundleId: item.id, bundleLabel: item.label, bundlePrice: item.price } : {}) };
      });
    });
  }
  function bundles(state = read()) {
    const list = services(state);
    return (state.bundles || []).map(b => ({ ...b, category: 'Bundles', alias: b.serviceIds.map(id => list.find(s => s.id === id)?.label || '').join(' '),
      available: b.available !== false && b.serviceIds.length >= 2 && b.serviceIds.every(id => list.some(s => s.id === id && s.available)) }));
  }
  function offerings(state = read()) { return [...bundles(state), ...services(state)]; }
  function expandIds(ids, state = read()) {
    return [...new Set(ids.flatMap(id => state.bundles?.find(b => b.id === id)?.serviceIds || [id]))];
  }
  function search(items, term, category = '') {
    const query = term.trim().toLowerCase();
    return items.filter(item => (!category || item.category === category) &&
      [item.label, item.category, item.alias].some(value => value?.toLowerCase().includes(query)));
  }
  function categoryOptions() {
    return '<option value="">All categories</option>' + ['Bundles', ...Object.keys(groups)].sort(alphabetical)
      .map(category => '<option>' + safe(category) + '</option>').join('');
  }
  function alphabetical(a, b) { return a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true }); }
  function filterReservations(state, date = '', status = '') {
    return state.reservations.filter(r => (!date || r.date === date) && (!status || reservationStatus(r) === status))
      .slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }
  function validSlot(state, date, time, exceptCode, serviceIds = []) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= day() && date <= day(30) &&
      times.includes(time) && new Date(date + 'T' + time + ':00+08:00').getTime() > Date.now() &&
      !scheduleBlocks(state, date, time, expandIds(serviceIds, state)).length &&
      state.reservations.filter(r => r.date === date && r.time === time && r.code !== exceptCode &&
        ['Confirmed', 'Completed'].includes(r.status)).length < state.capacity;
  }
  function reservationStatus(reservation) {
    return reservation.status === 'Confirmed' && reservation.date < day() ? 'No-Show' : reservation.status;
  }
  function findOrCreateClient(state, details) {
    const match = state.profiles.find(item => item.mobile === details.mobile &&
      item.fullName.toLowerCase() === details.fullName.toLowerCase());
    if (match) {
      if (details.health) Object.assign(match, { health: details.health, age: details.age, sex: details.sex });
      if (details.consent) match.consent = details.consent;
      return match;
    }
    const profile = { id: uid('CL'), ...details };
    state.profiles.push(profile);
    return profile;
  }
  function clientFields(includeHealth = false) {
    return '<label>Full name<input name="fullName" required maxlength="90" autocomplete="off"></label>' +
      '<label>Mobile number<input name="mobile" required inputmode="tel" type="tel" maxlength="18" placeholder="09XX XXX XXXX" autocomplete="off"></label>' +
      '<label>Age<input name="age" required type="number" inputmode="numeric" min="0" max="125"></label>' +
      '<label>Sex<select name="sex" required><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label>' +
      (includeHealth ? healthFields() : '');
  }
  function healthFields() {
    const select = (name, label, options) => '<label>' + label + '<select name="' + name + '">' + options.map(value =>
      '<option>' + safe(value) + '</option>').join('') + '</select></label>';
    const disclosure = (name, label, placeholder) => '<div class="health-disclosure">' +
      select(name, label, ['Unknown', 'Prefer not to say', 'None', 'Provide details']) +
      '<label data-health-detail="' + name + '" hidden>' + label + ' details<textarea name="' + name + 'Details" maxlength="500" placeholder="' + placeholder + '" disabled></textarea></label></div>';
    return '<div class="form-section"><h3>Health information <span class="quiet">(optional)</span></h3>' +
      '<p class="quiet">Share what you know to help staff prepare for your visit. You can choose Unknown or Prefer not to say. These are self-reported details, not verified test results.</p></div>' +
      select('bloodType', 'Blood type (if known)', ['Unknown', 'Prefer not to say', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']) +
      select('pregnancy', 'Pregnancy status (if applicable)', ['Unknown', 'Prefer not to say', 'Not applicable', 'Not pregnant', 'Pregnant', 'Possibly pregnant']) +
      disclosure('conditions', 'Known conditions', 'For example, high blood pressure or diabetes') +
      disclosure('medicines', 'Medicines and supplements', 'Names of medicines or supplements, if known') +
      disclosure('allergies', 'Allergies', 'For example, medicines, latex, or adhesive allergies');
  }
  function healthSummary(health = {}) {
    const labels = { bloodType: 'Blood type', pregnancy: 'Pregnancy status', conditions: 'Known conditions', medicines: 'Medicines and supplements', allergies: 'Allergies' };
    return '<h3>Self-reported health information</h3><dl class="detail-list">' + Object.entries(labels).map(([key, label]) =>
      '<div><dt>' + label + '</dt><dd>' + safe(health[key] || 'Unknown') + (health[key] === 'Provide details' ? ': ' + safe(health[key + 'Details'] || 'No details supplied') : '') + '</dd></div>').join('') + '</dl>';
  }
  function bindHealth(form) {
    const refresh = () => form.querySelectorAll('[data-health-detail]').forEach(label => {
      const visible = form.elements[label.dataset.healthDetail].value === 'Provide details';
      label.hidden = !visible;
      label.querySelector('textarea').disabled = !visible;
    });
    form.addEventListener('change', refresh);
    refresh();
  }
  function clientDetails(form) {
    const entries = new FormData(form);
    const fullName = entries.get('fullName').trim().replace(/\s+/g, ' ');
    const mobile = entries.get('mobile').replace(/[\s()-]/g, '').replace(/^\+63/, '0');
    if (!fullName || !/^09\d{9}$/.test(mobile)) throw Error('Enter a full name and a valid Philippine mobile number.');
    const details = { fullName, mobile, age: Number(entries.get('age')), sex: entries.get('sex') };
    if (entries.has('bloodType')) {
      details.health = Object.fromEntries(['bloodType', 'pregnancy', 'conditions', 'medicines', 'allergies'].map(name => [name, entries.get(name) || 'Unknown']));
      for (const name of ['conditions', 'medicines', 'allergies'])
        details.health[name + 'Details'] = details.health[name] === 'Provide details' ? String(entries.get(name + 'Details') || '').trim().slice(0, 500) : '';
    }
    if (entries.has('walkInConsent')) details.consent = { data: true, at: new Date().toISOString(), recordedBy: 'Front desk' };
    return details;
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
    timeLabel, stamp, appointment, read, update, services, bundles, offerings, expandIds, serviceLines, search, categoryOptions, validSlot,
    reservationStatus, filterReservations, alphabetical, findOrCreateClient, clientFields, clientDetails, bindHealth, healthSummary, audit, status, message,
    notify, scheduleBlocks, reservationImpact, effectiveSale, paymentIssue, clientSummary };
})();

setInterval(() => Bioscan.read(), 60000);
