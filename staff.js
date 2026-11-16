'use strict';

const Staff = (() => {
  const B = Bioscan;
  const app = document.querySelector('#staff-app');
  const account = document.querySelector('#staff-account');
  const modal = document.querySelector('#staff-dialog');
  const activeKey = 'bioscan-prototype:v1:active-role';
  let role = sessionStorage.getItem(activeKey);
  let cancelModal;
  let headerSignature = '';

  function credentialFields() {
    return '<label>Login username<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false"></label>' +
      '<label>Password<input name="password" type="password" autocomplete="current-password"></label>';
  }

  function credentialHelp() {
    return '<p class="quiet">Your account opens the workspace assigned to you.</p>' +
      '<details class="demo-accounts"><summary>Prototype accounts</summary><p>Use the username as the password.</p><dl>' +
      '<div><dt>Front desk</dt><dd>pos1</dd></div><div><dt>MedTech</dt><dd>medtech1</dd></div>' +
      '<div><dt>Clinic Manager</dt><dd>clinic1</dd></div><div><dt>Administrator</dt><dd>admin1</dd></div></dl></details>';
  }

  async function passwordHash(password, salt) {
    if (!crypto.subtle) throw Error('Open BioScan over HTTPS or localhost to use staff credentials.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const hash = await crypto.subtle.deriveBits({
      name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(atob(salt), char => char.charCodeAt(0)), iterations: 600000
    }, key, 256);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  }

  async function createStaffAccount(form) {
    const data = new FormData(form);
    const fullName = data.get('fullName').trim().replace(/\s+/g, ' ');
    const username = data.get('username').trim();
    const password = data.get('password');
    const accountRole = data.get('role');
    if (!fullName) throw Error('Enter the staff member’s full name.');
    if (!username || /\s/.test(username)) throw Error('Enter a login username without spaces.');
    if (!password.trim()) throw Error('Enter a password.');
    if (!Object.hasOwn(B.roles, accountRole)) throw Error('Select a staff role.');
    const serviceIds = accountRole === 'medtech' ? data.getAll('assignedService') : [];
    if (accountRole === 'medtech' && !serviceIds.length) throw Error('Assign at least one service to the MedTech.');
    const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const hash = await passwordHash(password, salt);
    return B.update(state => {
      if (state.staffAccounts.some(account => account.username.toLowerCase() === username.toLowerCase()))
        throw Error('That login username is already in use.');
      state.staffAccounts.push({ fullName, username, role: accountRole, salt, hash, serviceIds });
      B.audit(state, B.roles.admin, 'Staff account created', username + ' · ' + B.roles[accountRole]);
      return fullName;
    });
  }

  async function authenticate(form) {
    const data = new FormData(form);
    const username = data.get('username').trim().toLowerCase();
    const password = data.get('password');
    if (!username || !password) throw Error('Enter both your login username and password.');
    const account = B.read().staffAccounts.find(entry => entry.username.toLowerCase() === username);
    if (!account || account.active === false || await passwordHash(password, account.salt) !== account.hash)
      throw Error('The login username or password is incorrect.');
    return { role: account.role, username: account.username };
  }

  const permissionLabels = {
    cashier: { profiles: 'Find matching Client Profiles', payment: 'Finalize sales', receipts: 'Print and retrieve receipts' },
    manager: { profiles: 'Browse Client Profiles', services: 'Create and edit diagnostic services and bundles', coupons: 'Manage Coupons', reports: 'View and export reports' },
    medtech: { care: 'View assigned-service patients and record completion or referrals' }
  };

  function allowed(role, permission) {
    return Object.hasOwn(permissionLabels[role] ?? {}, permission);
  }

  async function updateStaffAccount(form, username) {
    const values = new FormData(form);
    const fullName = values.get('fullName').trim().replace(/\s+/g, ' ');
    const role = values.get('role');
    if (!fullName || !Object.hasOwn(B.roles, role)) throw Error('Enter a name and choose a role.');
    const serviceIds = role === 'medtech' ? values.getAll('assignedService') : [];
    if (role === 'medtech' && !serviceIds.length) throw Error('Assign at least one service to the MedTech.');
    const password = values.get('password');
    let reset = {};
    if (password) {
      const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
      reset = { salt, hash: await passwordHash(password, salt) };
    }
    await B.update(state => {
      const account = state.staffAccounts.find(item => item.username === username);
      if (!account) throw Error('This staff account is no longer available.');
      Object.assign(account, { fullName, role, serviceIds, active: values.has('active'), ...reset });
      B.audit(state, B.roles.admin, 'Staff account updated', username + ' · ' + B.roles[role]);
    });
  }

  function roleOptions(allowed) {
    return allowed.map(value => '<option value="' + value + '">' + B.roles[value] + '</option>').join('');
  }

  function dialog(title, body, submit, options = {}) {
    cancelModal = options.cancel;
    modal.innerHTML = '<div class="dialog-title"><h2 id="dialog-title">' + B.safe(title) + '</h2>' +
      '<button class="button secondary small" type="button" data-dialog-close>Close</button></div>' +
      (submit ? '<form>' + body + '<p class="message" role="status"></p><div class="actions">' +
        '<button class="button primary" type="submit">' + B.safe(options.submitLabel || 'Save') +
        '</button></div></form>' : body);
    modal.querySelector('[data-dialog-close]').addEventListener('click', () => modal.close());
    const form = modal.querySelector('form');
    if (form && submit) {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = form.querySelector('[type="submit"]');
        if (button.disabled) return;
        button.disabled = true;
        try {
          const result = await submit(form);
          if (result !== false) close();
        } catch (error) { B.message(form.querySelector('.message'), error.message, true); }
        finally { button.disabled = false; }
      });
    }
    if (!modal.open) modal.showModal();
    const firstField = modal.querySelector('form input:not([type="hidden"]), form select, form textarea');
    if (form) { Medtech.bindAssignments(form); B.bindHealth(form); }
    (firstField ?? modal.querySelector('[data-dialog-close]')).focus();
  }

  function close() {
    cancelModal = null;
    modal.close();
  }

  modal.addEventListener('close', () => {
    if (modal.open) return;
    const cancelled = cancelModal;
    cancelModal = null;
    cancelled?.();
    modal.replaceChildren();
  });

  function renderSignIn() {
    headerSignature = '';
    account.innerHTML = '<a href="index.html">Public website</a>';
    app.innerHTML = '<div class="sign-in-layout"><div class="sign-in-intro"><h1>Staff Sign In</h1>' +
      '<p>Sign in to your BioScan workspace.</p></div><form id="sign-in" class="panel sign-in-form">' +
      credentialFields() + credentialHelp() + '<p class="message" role="status"></p>' +
      '<button class="button primary" type="submit">Sign In <span class="arrow" aria-hidden="true"></span></button></form></div>';
    const form = app.querySelector('form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;
      const message = form.querySelector('.message');
      button.disabled = true;
      B.message(message, '');
      try {
        const identity = await authenticate(form);
        role = identity.role;
        sessionStorage.setItem('bioscan-prototype:v1:staff-identity', JSON.stringify(identity));
        form.reset();
        sessionStorage.setItem(activeKey, role);
        Management.reset();
        Medtech.reset();
        render(true);
      } catch (error) {
        B.message(message, error.message, true);
        form.elements.password.focus();
      } finally { button.disabled = false; }
    });
  }

  function validateSession() {
    const identity = JSON.parse(sessionStorage.getItem('bioscan-prototype:v1:staff-identity') || 'null');
    if (!identity?.username) {
      role = null;
      sessionStorage.removeItem(activeKey);
      return false;
    }
    const current = B.read().staffAccounts.find(item => item.username === identity.username);
    if (current && current.active !== false && current.role === role) return true;
    role = null;
    sessionStorage.removeItem(activeKey);
    sessionStorage.removeItem('bioscan-prototype:v1:staff-identity');
    return false;
  }

  function render(focus = false) {
    validateSession();
    app.onclick = null;
    app.onchange = null;
    if (!Object.hasOwn(B.roles, role)) renderSignIn();
    else {
      renderAccount();
      if (role === 'cashier') Cashier.open();
      else if (role === 'medtech') Medtech.render();
      else Management.render(role);
    }
    if (focus) {
      const heading = app.querySelector('h1');
      heading.tabIndex = -1;
      heading.focus();
    }
  }

  function renderAccount() {
    const state = B.read();
    const identity = JSON.parse(sessionStorage.getItem('bioscan-prototype:v1:staff-identity') || 'null');
    const user = state.staffAccounts.find(item => item.username === identity?.username);
    if (!user) return;
    const assigned = B.services(state).filter(s => (user.serviceIds || []).includes(s.id));
    const signature = JSON.stringify([user.username, user.fullName, user.role, assigned.map(s => [s.id, s.label, s.category])]);
    if (signature === headerSignature) return;
    headerSignature = signature;
    const categories = [...new Set(assigned.map(s => s.category))].sort(B.alphabetical);
    account.innerHTML = '<details class="staff-profile"><summary aria-label="View profile for ' + B.safe(user.fullName) + '"><span class="staff-profile-name">' + B.safe(user.fullName) + '</span><small class="staff-person-role">' + B.roles[user.role] + '</small></summary>' +
      '<section class="staff-profile-panel" aria-label="Staff profile"><h2>' + B.safe(user.fullName) + '</h2><p>' + B.safe(user.username) + ' · ' + B.roles[user.role] + '</p>' +
      (user.role === 'medtech' ? '<h3>Assigned services (' + assigned.length + ')</h3>' + (categories.length ? categories.map(category => '<h4>' + B.safe(category) + '</h4><ul>' + assigned.filter(s => s.category === category).map(s => '<li>' + B.safe(s.label) + '</li>').join('') + '</ul>').join('') : '<p>No services assigned. Ask the Administrator to update your account.</p>') :
      '<p>Your workspace provides the tools assigned to this role.</p>') + '</section></details>' +
      '<button class="button staff-switch small" type="button">Switch Account</button>';
    const profile = account.querySelector('.staff-profile');
    profile.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') profile.open = true; });
    profile.addEventListener('pointerleave', () => { if (!profile.contains(document.activeElement)) profile.open = false; });
    profile.addEventListener('focusout', event => { if (!profile.contains(event.relatedTarget)) profile.open = false; });
    profile.addEventListener('keydown', event => { if (event.key === 'Escape') { profile.open = false; event.stopPropagation(); } });
    account.querySelector('.staff-switch').addEventListener('click', () => {
      role = null;
      sessionStorage.removeItem(activeKey);
      sessionStorage.removeItem('bioscan-prototype:v1:staff-identity');
      render(true);
    });
  }

  addEventListener('storage', event => {
    if (event.key !== B.key) return;
    if (!validateSession()) { render(true); return; }
    renderAccount();
    if (role === 'cashier') Cashier.sync();
    if (role === 'medtech') Medtech.render();
    if (role === 'manager' || role === 'admin') Management.sync(role);
  });
  setInterval(async () => {
    if (!Object.hasOwn(B.roles, role)) return;
    if (!validateSession()) { render(true); return; }
    renderAccount();
    if (role === 'medtech') { Medtech.render(); return; }
    try {
      if (await Recovery.tick(role)) {
        if (role === 'cashier') Cashier.sync();
        else if (role) Management.sync(role);
      }
    } catch (error) { console.error('Prototype background task failed', error); }
  }, 60000);
  return { app, modal, dialog, close, credentialFields, authenticate, createStaffAccount, updateStaffAccount, roleOptions, permissionLabels, allowed, validateSession, init: render };
})();

addEventListener('DOMContentLoaded', () => Staff.init());
