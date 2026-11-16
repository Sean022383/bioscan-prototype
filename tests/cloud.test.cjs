const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
function fixture() {
  const storage = () => { const map = new Map(); return { getItem: k => map.get(k) || null, setItem: (k, v) => map.set(k, String(v)) }; };
  const context = vm.createContext({ crypto: webcrypto, console, Intl, Date, structuredClone, setInterval() {}, navigator: {}, localStorage: storage(), sessionStorage: storage() });
  for (const f of ['sample-data.js', 'data.js', 'recovery.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), context);
  vm.runInContext('globalThis.api = { B: Bioscan, R: Recovery }', context);
  const { B, R } = context.api;
  const state = B.read();
  state.sales = [{ id: 'TX-1', clientId: 'CL-1001', items: B.serviceLines(['cbc'], state), due: 28000, at: new Date().toISOString() }];
  state.paymentIssues = [];
  return { B, R, state };
}
test('cloud is the only processing database and migration preserves sales and backup history', () => {
  const { B, R, state } = fixture();
  assert.equal(R.info(state).active, 'cloud');
  assert.equal('local' in R.info(state).online, false);
  state.databaseRecovery = { active: 'local', online: { local: false, cloud: true }, backups: { local: [{ date: B.day(-1), capturedAt: new Date().toISOString(), ids: ['TX-1'] }], cloud: [] }, archive: { 'TX-1': structuredClone(state.sales[0]) } };
  const sales = JSON.stringify(state.sales);
  R.setConnections(state, 'admin', { cloud: true, backup: false });
  assert.equal(R.info(state).architecture, 'cloud-primary-backup');
  assert.equal(JSON.stringify(state.sales), sales);
  assert.equal(R.info(state).backups.backup.length, 1);
  assert.ok(R.info(state).archive['TX-1']);
});
test('primary outages block payments and reservations; backup outages do not block primary processing', () => {
  const { R, state } = fixture();
  R.setConnections(state, 'admin', { cloud: false, backup: true });
  assert.match(R.checkoutBlock(state), /primary cloud database is offline/);
  assert.match(R.checkoutBlock(state, true), /paused/);
  R.setConnections(state, 'admin', { cloud: true, backup: false });
  assert.equal(R.checkoutBlock(state), '');
  assert.equal(R.synchronize(state, 'manager'), false);
  assert.equal(R.pending(state).length, 1);
});
test('cloud copies capture all transactions and repeated backups are idempotent', () => {
  const { B, R, state } = fixture();
  R.maintain(state);
  assert.equal(R.info(state).backups.backup.length, 7);
  assert.equal(R.pending(state).length, 0);
  state.sales.push({ ...state.sales[0], id: 'TX-2' });
  assert.equal(R.pending(state).length, 1);
  assert.equal(R.synchronize(state, 'manager'), true);
  assert.equal(R.synchronize(state, 'admin'), true);
  assert.equal(R.info(state).backups.backup.filter(c => c.date === B.day()).length, 1);
  assert.equal(R.info(state).backups.backup[0].ids.length, 2);
  assert.equal(R.pending(state).length, 0);
});
test('failed cloud backups preserve existing usable copies without pruning', () => {
  const { B, R, state } = fixture();
  R.maintain(state);
  const db = R.info(state);
  db.backups.backup.push({ date: B.day(-10), capturedAt: new Date().toISOString(), ids: ['TX-1'] });
  const before = JSON.stringify(db.backups);
  R.setConnections(state, 'admin', { cloud: true, backup: false });
  assert.equal(R.synchronize(state, 'admin'), false);
  assert.equal(JSON.stringify(R.info(state).backups), before);
  R.setConnections(state, 'admin', { cloud: true, backup: true });
  R.synchronize(state, 'admin');
  assert.equal(R.info(state).backups.backup.length, 7);
});
test('cloud restore is admin-only, pauses processing, recovers missing sales, and preserves current sales', () => {
  const { B, R, state } = fixture();
  R.synchronize(state, 'admin');
  state.sales = [{ ...state.sales[0], id: 'TX-NEW' }];
  assert.throws(() => R.restore(state, 'manager', 'backup', B.day()), /Administrator/);
  R.restore(state, 'admin', 'backup', B.day());
  assert.match(R.checkoutBlock(state), /reconciliation/);
  assert.throws(() => R.approve(state, 'cashier', R.info(state).review.id), /management/);
  R.approve(state, 'manager', R.info(state).review.id);
  assert.equal(R.checkoutBlock(state), '');
  assert.equal(state.sales.length, 2);
  assert.ok(state.sales.some(s => s.id === 'TX-NEW'));
  assert.ok(state.sales.some(s => s.id === 'TX-1'));
});
test('cloud restore conflicts block reconciliation and keep current records intact', () => {
  const { B, R, state } = fixture();
  state.sales[0].reservation = 'RES-1';
  R.synchronize(state, 'admin');
  state.sales = [{ ...state.sales[0], id: 'TX-CONFLICT' }];
  R.restore(state, 'admin', 'backup', B.day());
  const before = JSON.stringify(state.sales);
  assert.throws(() => R.approve(state, 'admin', R.info(state).review.id), /conflicts/);
  assert.equal(JSON.stringify(state.sales), before);
  assert.ok(R.info(state).review);
});
test('reservation date and status filters combine and include automatically derived no-shows', () => {
  const { B, state } = fixture();
  state.reservations = [
    { code: 'A', date: B.day(-2), time: '08:00', status: 'Confirmed' },
    { code: 'B', date: B.day(1), time: '08:00', status: 'Confirmed' },
    { code: 'C', date: B.day(1), time: '09:00', status: 'Completed' },
    { code: 'D', date: B.day(1), time: '10:00', status: 'Cancelled' }
  ];
  assert.equal(B.filterReservations(state).length, 4);
  assert.equal(B.filterReservations(state, '', 'No-Show')[0].code, 'A');
  assert.equal(B.filterReservations(state, B.day(1), 'Confirmed')[0].code, 'B');
  assert.equal(B.filterReservations(state, B.day(1), 'Completed')[0].code, 'C');
  assert.equal(B.filterReservations(state, B.day(-2), 'Completed').length, 0);
});
test('category options are alphabetical with All categories kept first', () => {
  const { B } = fixture();
  const labels = [...B.categoryOptions().matchAll(/<option(?:[^>]*)>([^<]+)<\/option>/g)].map(m => m[1]);
  assert.equal(labels.shift(), 'All categories');
  assert.deepEqual(labels, labels.slice().sort(B.alphabetical));
});
