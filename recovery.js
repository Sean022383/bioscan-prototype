'use strict';

const Recovery = (() => {
  const B = Bioscan;
  const targets = { cloud: 'Primary Cloud (Supabase)', backup: 'Cloud Backup' };
  const stamp = () => new Date().toISOString();
  const conflict = state => state.paymentIssues.some(i => ['Backup conflict', 'Synchronization conflict'].includes(i.type) && i.status === 'Pending');
  function info(state) {
    const old = state.databaseRecovery;
    if (old?.architecture === 'cloud-primary-backup') return old;
    const copies = new Map();
    for (const copy of [...(old?.backups?.local || []), ...(old?.backups?.cloud || [])]) copies.set(copy.date, structuredClone(copy));
    const backups = [...copies.values()].sort((a, b) => b.date.localeCompare(a.date));
    return { architecture: 'cloud-primary-backup', active: 'cloud', online: { cloud: old?.online?.cloud !== false, backup: true },
      lastSuccess: backups[0]?.capturedAt || null, lastAttempt: null, result: backups.length ? 'Successful' : 'Not run',
      syncedIds: backups[0]?.ids.slice() || [], backups: { backup: backups }, archive: structuredClone(old?.archive || {}),
      review: old?.review?.kind === 'restore' ? { ...old.review, target: 'cloud', source: 'backup' } : null,
      lastRestored: old?.lastRestored ? { ...old.lastRestored, target: 'cloud' } : null };
  }
  const attach = state => state.databaseRecovery = info(state);
  function pending(state, db = info(state)) {
    const copied = new Set(db.syncedIds);
    return state.sales.filter(sale => !copied.has(sale.id));
  }
  function checkoutBlock(state) {
    const db = info(state);
    if (!db.online.cloud) return 'The primary cloud database is offline. Transactions and reservations are paused until it reconnects.';
    if (db.review) return 'Payment is paused until cloud restore reconciliation is approved.';
    return '';
  }
  function capture(state, db, date, capturedAt) {
    const sales = state.sales.filter(sale => sale.at <= capturedAt);
    for (const sale of sales) db.archive[sale.id] = structuredClone(sale);
    const copy = { date, capturedAt, ids: sales.map(sale => sale.id) };
    db.backups.backup = [copy, ...db.backups.backup.filter(b => b.date !== date)].sort((a, b) => b.date.localeCompare(a.date));
    return copy;
  }
  function retain(db) {
    db.backups.backup = db.backups.backup.filter(b => b.date >= B.day(-6));
    const retained = new Set(db.backups.backup.flatMap(b => b.ids));
    for (const id of Object.keys(db.archive)) if (!retained.has(id)) delete db.archive[id];
  }
  function maintain(state) {
    const db = attach(state);
    if (!db.online.cloud || !db.online.backup || db.review || conflict(state)) return db;
    if (!db.backups.backup.length) {
      for (let i = 6; i > 0; i--) capture(state, db, B.day(-i), new Date(B.day(-i) + 'T00:00:00+08:00').toISOString());
    }
    if (!db.backups.backup.some(copy => copy.date === B.day())) {
      const at = stamp();
      const copy = capture(state, db, B.day(), at);
      db.lastSuccess = at; db.lastAttempt = at; db.result = 'Successful'; db.syncedIds = copy.ids.slice();
      retain(db);
      B.audit(state, 'System', 'Daily cloud backup created', 'Primary Cloud → Cloud Backup');
    }
    return db;
  }
  function setConnections(state, role, online) {
    if (role !== 'admin') throw Error('Only the System Administrator can change connection simulation.');
    const db = attach(state);
    db.online = { cloud: Boolean(online.cloud), backup: Boolean(online.backup) };
    B.audit(state, B.roles[role], 'Cloud connections updated', 'Primary ' + (online.cloud ? 'online' : 'offline') + ' · Backup ' + (online.backup ? 'online' : 'offline'));
  }
  function synchronize(state, role) {
    if (!['manager', 'admin', 'system'].includes(role)) throw Error('Only management can run a cloud backup.');
    const db = attach(state);
    db.lastAttempt = stamp();
    if (!db.online.cloud || !db.online.backup || db.review || conflict(state)) {
      db.result = 'Failed';
      B.audit(state, B.roles[role] || 'System', 'Cloud backup failed', 'Check cloud connections and pending recovery issues.');
      return false;
    }
    const copy = capture(state, db, B.day(), db.lastAttempt);
    db.syncedIds = copy.ids.slice(); db.lastSuccess = db.lastAttempt; db.result = 'Successful';
    retain(db);
    B.audit(state, B.roles[role] || 'System', 'Cloud backup successful', copy.ids.length + ' transactions copied to Cloud Backup');
    return true;
  }
  function restore(state, role, target, date) {
    if (role !== 'admin') throw Error('Only the System Administrator can restore a backup.');
    const db = attach(state);
    if (target !== 'backup') throw Error('Choose a copy from Cloud Backup.');
    if (!db.online.cloud || !db.online.backup) throw Error('Both cloud connections must be online to restore.');
    if (db.review) throw Error('Complete the current reconciliation first.');
    const copy = db.backups.backup.find(item => item.date === date);
    if (!copy || copy.ids.some(id => !db.archive[id])) throw Error('A verified cloud backup is required.');
    db.review = { id: B.uid('REC'), kind: 'restore', target: 'cloud', source: 'backup', date,
      restored: copy.ids.map(id => structuredClone(db.archive[id])), startedAt: stamp() };
    B.audit(state, B.roles[role], 'Cloud backup staged for restoration', date);
  }
  function approve(state, role, reviewId) {
    if (!['manager', 'admin'].includes(role)) throw Error('Only management can approve reconciliation.');
    const db = attach(state), review = db.review;
    if (!review || review.id !== reviewId) throw Error('The reconciliation changed. Review the current records.');
    if (!db.online.cloud) throw Error('Reconnect the primary cloud before approving.');
    if (conflict(state)) throw Error('Resolve pending backup conflicts before approving reconciliation.');
    const ids = new Set(state.sales.map(s => s.id));
    const recovered = [];
    for (const sale of review.restored) {
      if (ids.has(sale.id)) continue;
      if ([...state.sales, ...recovered].some(s => (sale.reservation && s.reservation === sale.reservation) ||
        (sale.reference && s.provider === sale.provider && s.reference === sale.reference))) throw Error('A restored record conflicts with an existing reservation or payment reference.');
      recovered.push(structuredClone(sale)); ids.add(sale.id);
    }
    state.sales.push(...recovered);
    db.lastRestored = { target: 'cloud', date: review.date, approvedAt: stamp() };
    db.review = null;
    B.audit(state, B.roles[role], 'Cloud restore reconciliation approved', review.date + ' · Primary cloud processing resumed');
    return 'restore';
  }
  async function tick(role) {
    const state = B.read(), db = info(state);
    if (!state.settings.automaticSync || !db.online.cloud || !db.online.backup || db.review || conflict(state)) return false;
    const daily = !db.backups.backup.some(copy => copy.date === B.day());
    const retry = pending(state, db).length && (!db.lastAttempt || Date.now() - Date.parse(db.lastAttempt) >= 60000);
    if (!daily && !retry) return false;
    return B.update(current => {
      maintain(current);
      if (pending(current).length) synchronize(current, 'system');
      return true;
    });
  }
  return { targets, info, pending, checkoutBlock, maintain, setConnections, synchronize, restore, approve, tick };
})();
