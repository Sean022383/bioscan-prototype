const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto, pbkdf2Sync } = require('node:crypto');
function fixture() {
  const storage = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) }; };
  const ctx = vm.createContext({ console, crypto: webcrypto, structuredClone, Intl, Date, setInterval() {},
    navigator: {}, localStorage: storage(), sessionStorage: storage() });
  for (const f of ['sample-data.js', 'data.js', 'service-info.js', 'medtech.js', 'catalog-admin.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
  vm.runInContext('globalThis.api = { B: Bioscan, C: CatalogAdmin, M: Medtech, S: ServiceInfo }', ctx);
  const { B } = ctx.api;
  const login = name => { const account = B.read().staffAccounts.find(a => a.username === name); ctx.sessionStorage.setItem('bioscan-prototype:v1:staff-identity', JSON.stringify({ username: name, role: account.role })); };
  login('clinic1');
  return { ...ctx.api, ctx, login };
}
test('simple demo accounts authenticate with matching passwords and preserve custom changes after migration', async () => {
  const { B } = fixture();
  for (const name of ['pos1', 'medtech1', 'medtech2', 'clinic1', 'admin1']) {
    const a = B.read().staffAccounts.find(a => a.username === name);
    assert.equal(pbkdf2Sync(name, Buffer.from(a.salt, 'base64'), 600000, 32, 'sha256').toString('base64'), a.hash);
  }
  await B.update(s => { s.staffAccounts.find(a => a.username === 'medtech1').serviceIds = ['cbc']; });
  assert.equal(B.read().staffAccounts.find(a => a.username === 'medtech1').serviceIds.length, 1);
});
test('seeded bundles contain existing tests and total exactly to configured prices', () => {
  const { B } = fixture();
  for (const bundle of B.bundles()) {
    const lines = B.serviceLines([bundle.id]);
    assert.equal(lines.length, bundle.serviceIds.length);
    assert.equal(lines.reduce((n, l) => n + l.price, 0), bundle.price);
    assert.ok(lines.every(l => B.services().some(s => s.id === l.id)));
    assert.ok(lines.every(l => l.bundleId === bundle.id));
  }
});
test('configured prices allocate cents exactly, reject duplicate selections and preserve old snapshots', async () => {
  const { B, C } = fixture();
  const id = await C.saveBundle({ name: 'Test bundle', description: 'Sample package', price: '123.45', serviceIds: ['cbc', 'fbs', 'urinalysis'], available: true });
  const old = B.serviceLines([id]);
  assert.equal(old.reduce((n, l) => n + l.price, 0), 12345);
  assert.throws(() => B.serviceLines([id, 'cbc']), /already included/);
  await C.saveBundle({ name: 'Test bundle', description: 'Changed', price: '222.22', serviceIds: ['cbc', 'fbs'], available: true }, id);
  assert.equal(old.reduce((n, l) => n + l.price, 0), 12345);
  assert.equal(B.serviceLines([id]).reduce((n, l) => n + l.price, 0), 22222);
});
test('unavailable components disable bundles and component closures block reservations', async () => {
  const { B } = fixture();
  await B.update(s => { s.serviceSettings.cholesterol = { available: false }; });
  assert.equal(B.bundles().find(b => b.id === 'bundle-lipid').available, false);
  await B.update(s => { s.closures.push({ serviceId: 'tsh', start: B.day(1) + 'T08:00', end: B.day(1) + 'T09:00', reason: 'Unavailable' }); });
  assert.equal(B.validSlot(B.read(), B.day(1), '08:00', undefined, ['bundle-thyroid']), false);
});
test('both management roles create services with required details and edit them', async () => {
  const { B, C, S, login } = fixture();
  for (const username of ['clinic1', 'admin1']) {
    login(username);
    const values = { name: 'Sample ' + username, category: 'Chemistry', price: '125', description: 'Sample test details', preparation: 'Contact clinic before attending.', available: true };
    await assert.rejects(C.saveService({ ...values, preparation: '' }), /preparation/);
    const id = await C.saveService(values);
    assert.equal(S.get(B.services().find(s => s.id === id)).description, values.description);
    await C.saveService({ ...values, price: '130', preparation: 'Updated instructions.' }, id);
    assert.equal(B.services().find(s => s.id === id).price, 13000);
  }
  login('pos1');
  await assert.rejects(C.saveService({}), /Clinic Manager/);
});
test('bundle validation rejects missing tests, nested bundles, fewer than two services, and invalid prices', async () => {
  const { C } = fixture();
  const values = { name: 'Sample', description: 'Sample bundle', price: '100', serviceIds: ['cbc', 'fbs'], available: true };
  await assert.rejects(C.saveBundle({ ...values, serviceIds: ['cbc', 'cbc'] }), /two different/);
  await assert.rejects(C.saveBundle({ ...values, serviceIds: ['cbc', 'fake'] }), /existing diagnostic/);
  await assert.rejects(C.saveBundle({ ...values, serviceIds: ['cbc', 'bundle-lipid'] }), /existing diagnostic/);
  await assert.rejects(C.saveBundle({ ...values, price: '-1' }), /price/);
});
test('paid bundles reach assigned MedTechs as individual service entries and popup citations are absent', async () => {
  const { B, C, M, S, login } = fixture();
  const id = await C.saveBundle({ name: 'Care package', description: 'Sample', price: '400', serviceIds: ['cbc', 'fbs'], available: true });
  const items = B.serviceLines([id]);
  await B.update(s => { s.sales = [{ id: 'TEST-SALE', clientId: 'CL-1001', at: new Date().toISOString(), items }]; });
  login('medtech2');
  assert.equal(M.paidRows(B.read()).length, 1);
  assert.equal(M.paidRows(B.read())[0].serviceId, 'cbc');
  assert.doesNotMatch(S.markup(B.bundles().find(b => b.id === id)), /href=|MedlinePlus|RadiologyInfo/);
});
