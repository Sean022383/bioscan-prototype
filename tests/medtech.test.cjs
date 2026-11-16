const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');

function fixture() {
  const storage = () => {
    const data = new Map();
    return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
  };
  let queue = Promise.resolve();
  const ctx = vm.createContext({ crypto: webcrypto, Intl, Date, console, structuredClone,
    localStorage: storage(), sessionStorage: storage(), setInterval: () => {},
    navigator: { locks: { request: (_, fn) => { const next = queue.then(fn); queue = next.catch(() => {}); return next; } } } });
  for (const file of ['sample-data.js', 'data.js', 'medtech.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), ctx);
  vm.runInContext('globalThis.B = Bioscan; globalThis.M = Medtech', ctx);
  const { B, M } = ctx;
  const state = B.read();
  state.sales = [{ id: 'SALE-TEST', clientId: 'CL-1001', client: 'Mara Santos', reservation: 'RES-TEST', at: new Date().toISOString(), items: B.serviceLines(['cbc', 'fbs', 'urinalysis'], state) }];
  state.reservations = [{ code: 'RES-TEST', clientId: 'CL-1001', date: B.day(1), time: '08:00', status: 'Completed', items: state.sales[0].items },
    { code: 'UNPAID', clientId: 'CL-1001', date: B.day(2), time: '08:00', status: 'Confirmed', items: B.serviceLines(['cbc'], state) }];
  ctx.localStorage.setItem(B.key, JSON.stringify(state));
  const login = username => {
    const user = B.read().staffAccounts.find(a => a.username === username);
    ctx.sessionStorage.setItem('bioscan-prototype:v1:staff-identity', JSON.stringify({ username, role: user.role }));
  };
  login('medtech');
  return { B, M, ctx, login };
}

test('service assignments filter paid and incoming patients; incoming cannot be completed', async () => {
  const { B, M, login } = fixture();
  assert.equal(M.paidRows(B.read()).length, 3);
  login('medtech2');
  assert.equal(M.paidRows(B.read()).length, 2);
  assert.equal(M.incomingRows(B.read())[0].reservation, 'UNPAID');
  await assert.rejects(M.complete('SALE-TEST', 'fbs'), /not assigned/);
  await assert.rejects(M.complete('UNPAID', 'cbc'), /unavailable/);
});

test('completion is shared between MedTechs and only changes the selected paid service', async () => {
  const { B, M, login } = fixture();
  await M.complete('SALE-TEST', 'cbc');
  login('medtech2');
  assert.equal(M.paidRows(B.read()).find(r => r.serviceId === 'cbc').status, 'Completed');
  assert.equal(M.paidRows(B.read()).find(r => r.serviceId === 'urinalysis').status, 'Ready');
  assert.equal(B.read().reservations[0].status, 'Completed');
  assert.equal(B.read().audit[0].account, 'medtech');
});

test('return referrals require dates, external referrals require clinics, and management sees both', async () => {
  const { B, M, login } = fixture();
  await assert.rejects(M.refer('SALE-TEST', 'cbc', { type: 'Return to BioScan', reason: 'Repeat collection', returnDate: '' }), /return date/);
  await assert.rejects(M.refer('SALE-TEST', 'cbc', { type: 'Another clinic', reason: 'Special equipment', returnDate: '', clinic: '' }), /receiving clinic/);
  await M.refer('SALE-TEST', 'cbc', { type: 'Return to BioScan', reason: 'Repeat collection', returnDate: B.day(2), clinic: '' });
  await M.refer('SALE-TEST', 'urinalysis', { type: 'Another clinic', reason: 'Special collection', returnDate: '', clinic: 'Sample Clinic' });
  for (const username of ['manager', 'admin']) {
    login(username);
    assert.match(M.content(B.read(), true), /Review paid-service progress/);
    assert.equal(B.read().referrals.length, 2);
    await assert.rejects(M.complete('SALE-TEST', 'fbs'), /not assigned/);
  }
  login('medtech');
  await M.complete('SALE-TEST', 'cbc');
  assert.equal(B.read().referrals.length, 2, 'completion preserves referral history');
});

test('concurrent decisions cannot create duplicate referrals or complete a service twice', async () => {
  const { B, M } = fixture();
  const input = { type: 'Return to BioScan', reason: 'Return for service', returnDate: B.day(1), clinic: '' };
  const result = await Promise.allSettled([M.refer('SALE-TEST', 'cbc', input), M.refer('SALE-TEST', 'cbc', input)]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(B.read().referrals.length, 1);
  const completion = await Promise.allSettled([M.complete('SALE-TEST', 'cbc'), M.complete('SALE-TEST', 'cbc')]);
  assert.equal(completion.filter(r => r.status === 'fulfilled').length, 1);
});

test('assignment changes immediately restrict visibility and invalidate an already opened action', async () => {
  const { B, M } = fixture();
  await B.update(state => { state.staffAccounts.find(a => a.username === 'medtech').serviceIds = ['fbs']; });
  assert.equal(M.paidRows(B.read()).length, 1);
  assert.equal(M.incomingRows(B.read()).length, 0);
  await assert.rejects(M.complete('SALE-TEST', 'cbc'), /not assigned/);
  await B.update(state => { state.staffAccounts.find(a => a.username === 'medtech').active = false; });
  assert.equal(M.paidRows(B.read()).length, 0);
  await assert.rejects(M.complete('SALE-TEST', 'fbs'), /not assigned/);
});

test('category and service filters support all services without widening MedTech assignments', () => {
  const { B, M, login } = fixture();
  M.setFilters('Hematology', 'cbc');
  assert.equal(M.visibleRows(B.read()).paid.length, 1);
  assert.equal(M.visibleRows(B.read()).incoming.length, 1);
  M.setFilters('Chemistry', 'fbs');
  assert.equal(M.visibleRows(B.read()).paid[0].serviceId, 'fbs');
  M.setFilters();
  assert.equal(M.visibleRows(B.read()).paid.length, 3);
  login('medtech2');
  M.setFilters('Chemistry', 'fbs');
  assert.equal(M.visibleRows(B.read()).paid.length, 2, 'invalid filters reset to this account’s authorized services');
  assert.ok(M.visibleRows(B.read()).options.every(s => ['urinalysis', 'cbc'].includes(s.id)));
  login('clinic1');
  M.setFilters('Chemistry');
  assert.equal(M.visibleRows(B.read()).paid.length, 1);
});

test('detailed client profiles show payment and reservation records while scoped views hide unassigned items', async () => {
  const { B } = fixture();
  await B.update(state => {
    const p = state.profiles.find(p => p.id === 'CL-1001');
    p.health = { bloodType: 'A+', conditions: 'Provide details', conditionsDetails: '<script>sample</script>' };
    Object.assign(state.sales[0], { subtotal: 50000, due: 45000, amount: 5000, method: 'cash', received: 50000, change: 5000 });
    state.reservations[0].consent = { at: new Date().toISOString() };
  });
  const state = B.read();
  const client = state.profiles.find(p => p.id === 'CL-1001');
  const full = B.clientSummary(state, client);
  for (const expected of ['Transaction history', 'Reservation history', 'SALE-TEST', 'RES-TEST', 'Cash received', 'Change', 'FBS', 'A+', '₱450.00', '₱500.00']) assert.ok(full.includes(expected), expected);
  assert.ok(full.includes('&lt;script&gt;sample&lt;/script&gt;'));
  assert.ok(!full.includes('<script>sample</script>'));
  const scoped = B.clientSummary(state, client, false, ['cbc']);
  assert.ok(scoped.includes('CBC with Platelet'));
  assert.ok(scoped.includes('Listed services subtotal'));
  assert.ok(!scoped.includes('Routine Urinalysis'));
  assert.ok(!scoped.includes('FBS'));
  assert.ok(!scoped.includes('Cash received'));
  const restricted = B.clientSummary(state, client, false, []);
  assert.ok(!restricted.includes('SALE-TEST'));
});
