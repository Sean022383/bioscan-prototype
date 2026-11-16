'use strict';

const SampleData = (() => {
  const firstNames = ['Alyssa', 'Daniel', 'Elena', 'Isabel', 'Luis', 'Mika', 'Paolo', 'Rina', 'Sofia', 'Tomas'];
  const lastNames = ['Aguirre', 'Bautista', 'Castillo', 'Dela Cruz', 'Fernandez', 'Garcia', 'Lopez', 'Reyes', 'Santos', 'Villanueva'];
  const bundles = [
    ['cbc', 'fbs'], ['urinalysis'], ['cbc', 'urinalysis'], ['cholesterol', 'hdl-ldl', 'triglyceride'],
    ['whole-abdomen-ultrasound'], ['chest-x-ray-pal-2-views'], ['creatinine', 'bun'], ['ecg-regular']
  ];

  function seed(state, { day, serviceLines, times, roles }) {
    const profiles = [];
    const reservations = [];
    const approvals = [];
    const sales = [];
    const audit = [];
    const coupon = { code: 'WELLNESS10', label: 'Wellness 10', kind: 'percent', value: 10,
      active: true, start: day(-35), end: day(30), limit: 50, perClient: 1, serviceIds: null };
    const at = (date, time) => new Date(date + 'T' + time + ':00+08:00').toISOString();
    const event = (actor, action, detail, timestamp) => audit.push({ actor, action, detail, at: timestamp });
    const lines = ids => serviceLines(ids, { ...state, serviceSettings: {} });

    function profile() {
      const n = profiles.length;
      const item = { id: 'CL-S' + String(n + 1).padStart(4, '0'),
        fullName: firstNames[n % firstNames.length] + ' ' + lastNames[Math.floor(n / firstNames.length) % lastNames.length],
        mobile: '0917111' + String(n + 1).padStart(4, '0'), age: 20 + n * 7 % 58, sex: n % 2 ? 'Male' : 'Female',
        health: { bloodType: ['Unknown', 'O+', 'A+', 'Prefer not to say'][n % 4], pregnancy: 'Unknown',
          conditions: n % 7 === 0 ? 'Provide details' : 'None', conditionsDetails: n % 7 === 0 ? 'Sample: hypertension (self-reported)' : '', medicines: 'Unknown', allergies: 'None' },
        consent: { data: true, at: at(day(-31), '08:00'), recordedBy: 'Demo front desk' } };
      profiles.push(item);
      return item;
    }

    function appointment(client, offset, time, status, items) {
      const date = day(offset);
      const item = { code: 'BS-S' + String(reservations.length + 1).padStart(5, '0'), clientId: client.id,
        date, time, status, items, health: structuredClone(client.health),
        consent: { data: true, preparation: true, at: at(day(offset - 1), '15:00') } };
      reservations.push(item);
      state.sms.push({ id: 'SMS-DEMO-' + item.code, type: 'Reservation confirmation', mobile: client.mobile,
        message: 'DEMO: BioScan reservation ' + item.code + ' confirmed for ' + date + ' at ' + time + '. Bring your reservation code and follow your test preparation instructions.',
        reservation: item.code, key: 'demo-confirm-' + item.code, status: reservations.length % 12 === 0 ? 'Failed' : 'Delivered', at: item.consent.at });
      event('Client', 'Reservation confirmed', item.code, at(day(offset - 1), '15:00'));
      if (status === 'Cancelled' || status === 'No-Show') event(roles.manager, 'Reservation ' + status.toLowerCase(),
        item.code, at(day(status === 'No-Show' ? offset + 1 : offset), '07:00'));
      return item;
    }

    for (let offset = -30; offset < 0; offset += 1) {
      const index = offset + 30;
      const date = day(offset);
      const count = 2 + (index * 5 + Math.floor(index / 3)) % 4;
      for (let i = 0; i < count; i += 1) {
        const client = profile();
        const items = lines(bundles[(index * 3 + i) % bundles.length]);
        const subtotal = items.reduce((sum, item) => sum + item.price, 0);
        const eligible = items.filter(item => item.eligible).reduce((sum, item) => sum + item.price, 0);
        const useCoupon = (index + i) % 9 === 0;
        const statutory = !useCoupon && (index + i) % 5 === 0 && eligible > 0;
        const override = !useCoupon && !statutory && (index + i) % 13 === 0;
        const amount = useCoupon ? Math.round(subtotal * 0.1) : statutory ? Math.round(eligible * 0.2) : override ? 2000 : 0;
        const due = subtotal - amount;
        const reservation = i % 2 === 0 ? appointment(client, offset, times[i], 'Completed', items) : null;
        const method = (index + i * 2) % 3 === 0 ? 'wallet' : 'cash';
        const id = 'TX-S' + String(sales.length + 1).padStart(5, '0');
        const timestamp = at(date, times[i]);
        const sale = { id, draftId: 'SALE-' + id, clientId: client.id, client: client.fullName,
          reservation: reservation?.code ?? '', items, subtotal, eligible, amount, due,
          label: useCoupon ? 'Coupon · Wellness 10' : statutory ? 'Senior Citizen' : override ? 'Manual Discount Override' : '',
          couponCode: useCoupon ? coupon.code : '', method, received: due, change: 0,
          reference: method === 'wallet' ? 'SAMPLE-' + id : '', provider: method === 'wallet' ? (i % 2 ? 'Maya' : 'GCash') : '',
          verified: method === 'wallet', at: timestamp, prints: 1, source: 'cloud', receiptQueue: { date, number: i + 1 } };
        sales.push(sale);
        for (const service of items) {
          if (index < 27) state.careRecords.push({ saleId: id, serviceId: service.id, status: 'Completed', completedAt: timestamp, by: 'medtech1' });
          else if (i === 0) {
            const external = index % 2 === 0;
            state.careRecords.push({ saleId: id, serviceId: service.id, status: 'Referred', by: 'medtech1' });
            state.referrals.push({ id: 'REF-DEMO-' + id + '-' + service.id, saleId: id, serviceId: service.id,
              clientId: client.id, client: client.fullName, service: service.label, reservation: sale.reservation,
              type: external ? 'Another clinic' : 'Return to BioScan', reason: 'Demo: follow-up assessment requested.',
              clinic: external ? 'Sample Partner Clinic' : '', returnDate: day(7), at: timestamp, by: 'medtech1' });
          }
        }
        if (override) {
          const approval = { id: 'APR-' + id, saleId: sale.draftId, reservation: sale.reservation,
            client: client.fullName, items: items.map(item => item.label), subtotal, amount,
            reason: 'Front desk adjustment', path: 'dashboard', status: 'Approved', by: 'manager',
            at: timestamp, decidedAt: timestamp };
          approvals.push(approval);
          event(roles.manager, 'Manual Discount Override approved', approval.id, timestamp);
        }
        event(roles.cashier, 'Transaction finalized', id, timestamp);
        if (reservation) event(roles.cashier, 'Reservation completed', reservation.code, timestamp);
        event(roles.cashier, 'Transaction Receipt printed', id, timestamp);
      }
      if (index % 5 === 0) appointment(profile(), offset, '13:00', index % 2 ? 'Cancelled' : 'No-Show', lines(['cbc']));
    }
    for (let offset = 1; offset <= 5; offset += 1) {
      appointment(profile(), offset, '10:30', 'Confirmed', lines(['cbc', 'fbs']));
    }
    for (const [n, status] of ['Pending', 'Pending', 'Declined'].entries()) {
      const client = profile();
      const timestamp = at(day(-n - 1), '07:00');
      const item = { id: 'APR-S0000' + n, saleId: 'SALE-S0000' + n, reservation: '', client: client.fullName,
        items: ['CBC with Platelet', 'Routine Urinalysis'], subtotal: 38000, amount: (n + 1) * 1000,
        reason: 'Requested adjustment for the current visit', path: 'dashboard', status, at: timestamp };
      if (status === 'Declined') Object.assign(item, { by: 'admin', decidedAt: timestamp });
      approvals.push(item);
      event(roles.cashier, 'Manual Discount Override requested', item.id, timestamp);
      if (status === 'Declined') event(roles.admin, 'Manual Discount Override declined', item.id, timestamp);
    }
    state.profiles.push(...profiles);
    state.reservations.push(...reservations);
    state.sales.push(...sales);
    state.approvals.push(...approvals);
    if (!state.coupons.some(item => item.code === coupon.code)) state.coupons.push(coupon);
    state.audit.push(...audit);
    state.audit.sort((a, b) => b.at.localeCompare(a.at));
  }

  return { seed };
})();
