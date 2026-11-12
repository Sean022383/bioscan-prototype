'use strict';

const Recovery = (() => {
  const B = Bioscan;
  const targets = { local: 'Local PostgreSQL', cloud: 'Supabase (Cloud)' };

  function info(state) {
    if (state.databaseRecovery) return state.databaseRecovery;
    const sampleSync = state.sales.reduce((latest, sale) => sale.id.startsWith('TX-S') && sale.at > (latest ?? '') ?
      sale.at : latest, null);
    return { active: 'local', online: { local: true, cloud: true }, lastSuccess: sampleSync,
      syncedIds: state.sales.filter(sale => sale.id.startsWith('TX-S')).map(sale => sale.id),
      lastAttempt: null, result: sampleSync ? 'Successful' : 'Not run', review: null, lastRestored: null,
      backups: { local: [], cloud: [] }, archive: {} };
  }

  const attach = state => state.databaseRecovery ??= info(state);
  const stamp = () => new Date().toISOString();
  function pending(state, settings = info(state)) {
    const synchronized = new Set(settings.syncedIds);
    return state.sales.filter(sale => !synchronized.has(sale.id));
  }
  function checkoutBlock(state, reservation = false) {
    const db = info(state);
    if (db.review && (db.review.kind === 'return' || db.review.target === db.active))
      return 'Payment is paused until database reconciliation is approved.';
    if (!db.online[db.active]) return targets[db.active] + ' is offline. Payment is paused.';
    if (reservation && !db.online.cloud) return 'Reservations are unavailable while Supabase is offline. Use walk-in cashiering.';
    if (reservation && db.review?.target === 'cloud') return 'Reservations are unavailable while Supabase recovery is under review.';
    return '';
  }

  function maintain(state) {
    const db = attach(state);
    const today = B.day();
    const oldest = B.day(-6);
    const synchronized = new Set(db.syncedIds);
    for (const target of Object.keys(targets)) {
      if (!db.online[target] || db.review?.target === target) continue;
      const existing = db.backups[target];
      if (existing.some(copy => copy.date === today)) continue;
      // The initial seven records represent the clinic's existing daily backup history.
      const dates = existing.length ? [today] : Array.from({ length: 7 }, (_, index) => B.day(-index));
      for (const date of dates) {
        const capturedAt = new Date(date + 'T00:00:00+08:00').toISOString();
        const sales = state.sales.filter(sale => sale.at <= capturedAt &&
          (target === 'local' ? sale.source !== 'cloud' || synchronized.has(sale.id) :
            sale.source === 'cloud' || synchronized.has(sale.id)));
        for (const sale of sales) db.archive[sale.id] ??= structuredClone(sale);
        existing.push({ date, capturedAt, ids: sales.map(sale => sale.id) });
      }
      db.backups[target] = existing.filter(copy => copy.date >= oldest).sort((a, b) => b.date.localeCompare(a.date));
      B.audit(state, 'System', 'Daily simulated backup created', targets[target] + ' · ' + today);
    }
    const retained = new Set(Object.values(db.backups).flatMap(copies => copies.flatMap(copy => copy.ids)));
    for (const id of Object.keys(db.archive)) if (!retained.has(id)) delete db.archive[id];
    return db;
  }

  function setConnections(state, role, online) {
    if (role !== 'admin') throw Error('Only the System Administrator can change connection simulation.');
    const db = attach(state);
    db.online = online;
    B.audit(state, B.roles[role], 'Database connections updated',
      'Local ' + (online.local ? 'online' : 'offline') + ' · Supabase ' + (online.cloud ? 'online' : 'offline'));
    maintain(state);
  }

  function markSynced(state, db) {
    db.lastSuccess = db.lastAttempt;
    db.syncedIds = state.sales.map(sale => sale.id);
  }

  function synchronize(state, role) {
    const db = attach(state);
    db.lastAttempt = stamp();
    const conflict = state.paymentIssues.some(item => item.type === 'Synchronization conflict' && item.status === 'Pending');
    const available = db.online.local && db.online.cloud && db.active === 'local' && !db.review && !conflict;
    db.result = available ? 'Successful' : 'Failed';
    if (available) markSynced(state, db);
    B.audit(state, B.roles[role], 'Database synchronization ' + db.result.toLowerCase(),
      available ? 'Local PostgreSQL ↔ Supabase' : conflict ? 'Synchronization conflict pending review' :
        'Connection unavailable, online fallback active, or reconciliation pending');
    return available;
  }

  function switchToCloud(state, role) {
    const db = attach(state);
    if (db.active !== 'local' || db.review) throw Error('Complete the current database operation first.');
    if (db.online.local || !db.online.cloud)
      throw Error('Cloud fallback requires the local database to be offline and Supabase to be online.');
    db.active = 'cloud';
    B.audit(state, B.roles[role], 'POS database switched', 'Local PostgreSQL → Supabase online fallback');
  }

  function startReturn(state, role) {
    const db = attach(state);
    if (db.active !== 'cloud' || db.review) throw Error('Complete the current database operation first.');
    if (!db.online.local || !db.online.cloud) throw Error('Both databases must be online to reconcile the return to local.');
    db.review = { id: B.uid('REC'), kind: 'return', target: 'local', startedAt: stamp() };
    B.audit(state, B.roles[role], 'Database reconciliation started', 'Return from Supabase online fallback');
  }

  function restore(state, role, target, date) {
    if (role !== 'admin') throw Error('Only the System Administrator can restore a backup.');
    const db = maintain(state);
    if (db.review) throw Error('Complete the current reconciliation first.');
    if (!db.online[target]) throw Error(targets[target] + ' is offline.');
    const copy = db.backups[target].find(item => item.date === date);
    if (!copy || copy.ids.some(id => !db.archive[id])) throw Error('A verified backup is required.');
    const restored = copy.ids.map(id => structuredClone(db.archive[id]));
    db.review = { id: B.uid('REC'), kind: 'restore', target, date, restored, startedAt: stamp() };
    B.audit(state, B.roles[role], 'Database backup restored for review', targets[target] + ' · ' + date);
  }

  function approve(state, role, reviewId) {
    if (!['manager', 'admin'].includes(role)) throw Error('Only the Clinic Manager or System Administrator can approve reconciliation.');
    const db = attach(state);
    const review = db.review;
    if (!review || review.id !== reviewId) throw Error('The reconciliation changed. Review the current records before approving.');
    if (!db.online[review.target] || (review.kind === 'return' && !db.online.cloud))
      throw Error('Reconnect the databases required for this reconciliation.');
    if (state.paymentIssues.some(item => item.type === 'Synchronization conflict' && item.status === 'Pending'))
      throw Error('Resolve the pending synchronization conflict before approving reconciliation.');
    if (review.kind === 'return') {
      db.active = 'local';
      db.lastAttempt = stamp();
      markSynced(state, db);
      db.result = 'Successful';
    } else {
      const existing = new Set(state.sales.map(sale => sale.id));
      for (const sale of review.restored) {
        if (existing.has(sale.id)) continue;
        if (state.sales.some(current => (sale.reservation && current.reservation === sale.reservation) ||
          (sale.reference && current.provider === sale.provider && current.reference === sale.reference))) {
          throw Error('A restored transaction conflicts with an existing Reservation or payment reference.');
        }
        state.sales.push(sale);
        existing.add(sale.id);
      }
      db.lastRestored = { target: review.target, date: review.date, approvedAt: stamp() };
    }
    db.review = null;
    B.audit(state, B.roles[role], 'Database reconciliation approved', review.kind === 'return' ?
      'Local PostgreSQL cashiering resumed' : targets[review.target] + ' · ' + review.date);
    return review.kind;
  }

  async function tick(role) {
    const state = B.read();
    const db = info(state);
    const today = B.day();
    const needsBackup = Object.keys(targets).some(target =>
      db.online[target] && db.review?.target !== target && !db.backups[target].some(copy => copy.date === today));
    const needsSync = state.settings.automaticSync && db.active === 'local' && !db.review && pending(state, db).length &&
      (!db.lastAttempt || Date.now() - Date.parse(db.lastAttempt) >= 60000);
    if (!needsBackup && !needsSync) return false;
    return B.update(current => {
      if (needsBackup) maintain(current);
      const next = info(current);
      const shouldSync = needsSync && current.settings.automaticSync && next.active === 'local' && !next.review &&
        pending(current, next).length && (!next.lastAttempt || Date.now() - Date.parse(next.lastAttempt) >= 60000);
      if (shouldSync) synchronize(current, role);
      return Boolean(needsBackup || shouldSync);
    });
  }

  return { targets, info, maintain, tick, pending, checkoutBlock, setConnections, synchronize, switchToCloud, startReturn, restore, approve };
})();
