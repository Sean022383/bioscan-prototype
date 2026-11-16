const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
function fixture() {
  const data = new Map();
  let tail = Promise.resolve();
  const context = vm.createContext({ crypto: webcrypto, Intl, Date, console, structuredClone, setInterval() {},
    localStorage: { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, String(v)) },
    sessionStorage: { getItem: () => null }, navigator: { locks: { request: (_, fn) => { const next = tail.then(fn); tail = next.catch(() => {}); return next; } } } });
  for (const file of ['sample-data.js', 'data.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  vm.runInContext('globalThis.B = Bioscan', context);
  return context.B;
}
test('receipt numbers start at 1 and advance once per issue without separate queue history', () => {
  const B = fixture(), state = { profiles: [], sales: [] };
  const at = new Date('2026-11-16T02:00:00Z');
  assert.equal(B.nextReceiptQueue(state, at).number, 1);
  assert.equal(B.nextReceiptQueue(state, at).number, 2);
  assert.equal(state.receiptQueueCounter.date, '2026-11-16');
  assert.equal(state.receiptQueueCounter.lastNumber, 2);
  assert.equal(Object.keys(state).length, 3);
  assert.equal(state.profiles.length, 0);
});
test('numbering resets exactly at midnight Philippine time, rather than midnight UTC', () => {
  const B = fixture(), state = {};
  assert.equal(B.nextReceiptQueue(state, new Date('2026-11-16T15:59:59.999Z')).number, 1);
  const midnight = B.nextReceiptQueue(state, new Date('2026-11-16T16:00:00.000Z'));
  assert.equal(midnight.date, '2026-11-17');
  assert.equal(midnight.number, 1);
  assert.equal(B.nextReceiptQueue(state, new Date('2026-11-17T00:00:00.000Z')).number, 2);
  assert.equal(B.nextReceiptQueue(state, new Date('2026-11-17T15:59:59.999Z')).number, 3);
  assert.equal(B.nextReceiptQueue(state, new Date('2026-11-17T16:00:00.000Z')).number, 1);
});
test('concurrent cashier commits issue distinct sequential numbers', async () => {
  const B = fixture();
  const at = new Date('2026-11-16T02:00:00Z');
  const issued = await Promise.all(Array.from({ length: 12 }, () => B.update(state => B.nextReceiptQueue(state, at).number)));
  assert.deepEqual(issued, Array.from({ length: 12 }, (_, i) => i + 1));
  assert.equal(B.read().receiptQueueCounter.lastNumber, 12);
});
test('a failed transaction rolls back its number allocation', async () => {
  const B = fixture(), at = new Date('2026-11-16T02:00:00Z');
  await assert.rejects(B.update(state => { B.nextReceiptQueue(state, at); throw Error('Failed sale'); }), /Failed sale/);
  assert.equal(await B.update(state => B.nextReceiptQueue(state, at).number), 1);
});
test('stored receipt metadata and payment corrections preserve the original number after midnight', () => {
  const B = fixture(), state = { corrections: [] };
  const sale = { id: 'TX-ORIGINAL', receiptQueue: B.nextReceiptQueue(state, new Date('2026-11-16T15:59:59Z')) };
  const saved = structuredClone(sale);
  B.nextReceiptQueue(state, new Date('2026-11-16T16:00:00Z'));
  state.corrections.push({ saleId: sale.id, payment: { method: 'cash' } });
  const reprint = B.effectiveSale(state, saved);
  assert.equal(reprint.receiptQueue.date, '2026-11-16');
  assert.equal(reprint.receiptQueue.number, 1);
  assert.equal(state.receiptQueueCounter.date, '2026-11-17');
  assert.equal(state.receiptQueueCounter.lastNumber, 1);
});
