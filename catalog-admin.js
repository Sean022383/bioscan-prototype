'use strict';

const CatalogAdmin = (() => {
  const B = Bioscan;
  function authorize(state) {
    const user = JSON.parse(sessionStorage.getItem('bioscan-prototype:v1:staff-identity') || 'null');
    const account = state.staffAccounts.find(a => a.username === user?.username && a.active !== false && a.role === user.role);
    if (!account || !['manager', 'admin'].includes(account.role)) throw Error('Use a Clinic Manager or Administrator account.');
    return account;
  }
  function price(value) {
    const amount = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 10000000) throw Error('Enter a price from ₱1 to ₱100,000.');
    return amount;
  }
  function text(value, label, max) {
    const result = String(value || '').trim();
    if (!result || result.length > max) throw Error('Enter ' + label + ' (up to ' + max + ' characters).');
    return result;
  }
  async function saveService(values, id) {
    return B.update(state => {
      const user = authorize(state);
      const item = { label: text(values.name, 'a service name', 100), category: text(values.category, 'a category', 80),
        price: price(values.price), description: text(values.description, 'a service description', 1500),
        preparation: text(values.preparation, 'preparation instructions', 2000), alias: String(values.alias || '').trim().slice(0, 80),
        eligible: Boolean(values.eligible), available: Boolean(values.available) };
      if (!B.catalog.some(s => s.category === item.category)) throw Error('Choose a valid diagnostic category.');
      if (B.services(state).some(s => s.id !== id && s.label.toLowerCase() === item.label.toLowerCase())) throw Error('A service with that name already exists.');
      if (id && !B.services(state).some(s => s.id === id)) throw Error('This service no longer exists.');
      if (id) state.serviceSettings[id] = { ...state.serviceSettings[id], ...item };
      else { id = B.uid('svc').toLowerCase(); state.customServices.push({ id, ...item }); }
      B.audit(state, B.roles[user.role], 'Diagnostic Service ' + (values.editing ? 'updated' : 'saved'), item.label, user.username);
      return id;
    });
  }
  async function saveBundle(values, id) {
    return B.update(state => {
      const user = authorize(state);
      const serviceIds = [...new Set(values.serviceIds || [])];
      const old = state.bundles.find(b => b.id === id);
      if (id && !old) throw Error('This bundle no longer exists.');
      if (serviceIds.length < 2) throw Error('Choose at least two different services for the bundle.');
      const services = B.services(state);
      if (serviceIds.some(id => !services.some(s => s.id === id))) throw Error('Use existing diagnostic services only. Bundles cannot contain other bundles.');
      if (values.available && serviceIds.some(id => !services.some(s => s.id === id && s.available))) throw Error('An included service is unavailable. Remove it or save the bundle as inactive.');
      const entry = { id: id || B.uid('bundle').toLowerCase(), label: text(values.name, 'a bundle name', 100),
        description: text(values.description, 'a bundle description', 1500), price: price(values.price), serviceIds, available: Boolean(values.available) };
      if (state.bundles.some(b => b.id !== id && b.label.toLowerCase() === entry.label.toLowerCase())) throw Error('A bundle with that name already exists.');
      if (old) Object.assign(old, entry); else state.bundles.push(entry);
      B.audit(state, B.roles[user.role], 'Bundle ' + (old ? 'updated' : 'created'), entry.label, user.username);
      return entry.id;
    });
  }
  function serviceEditor(role, id, refresh) {
    if (!['manager', 'admin'].includes(role)) return;
    const item = id ? B.services().find(s => s.id === id) : null;
    const info = item ? ServiceInfo.get(item) : {};
    const input = (label, name, value, attrs = '') => '<label>' + label + '<input name="' + name + '" value="' + B.safe(value || '') + '" ' + attrs + '></label>';
    const categories = [...new Set(B.catalog.map(s => s.category))].sort(B.alphabetical);
    Staff.dialog(item ? 'Edit Diagnostic Service' : 'Create Diagnostic Service',
      input('Service name', 'name', item?.label, 'required maxlength="100"') +
      '<div class="form-grid"><label>Category<select name="category" required><option value="">Choose category</option>' + categories.map(c => '<option' + (c === item?.category ? ' selected' : '') + '>' + B.safe(c) + '</option>').join('') + '</select></label>' +
      input('Price (₱)', 'price', item ? item.price / 100 : '', 'type="number" min="1" max="100000" step="0.01" required') + '</div>' +
      '<label>About this service<textarea name="description" maxlength="1500" required>' + B.safe(info.description || '') + '</textarea></label>' +
      '<label>Before your visit / preparation<textarea name="preparation" maxlength="2000" required>' + B.safe(info.preparation || '') + '</textarea></label>' +
      input('Alternative search name (optional)', 'alias', item?.alias, 'maxlength="80"') +
      '<label class="check-row"><input type="checkbox" name="eligible"' + (item?.eligible ? ' checked' : '') + '><span>Discount Eligible</span></label>' +
      '<label class="check-row"><input type="checkbox" name="available"' + (!item || item.available ? ' checked' : '') + '><span>Available in catalog, POS, and Reservation</span></label>', async form => {
        const data = new FormData(form);
        await saveService({ ...Object.fromEntries(data), eligible: data.has('eligible'), available: data.has('available'), editing: Boolean(id) }, id);
        refresh();
      }, { submitLabel: item ? 'Save Service' : 'Create Service' });
  }
  function page(state, role, table, note) {
    return '<div class="tool-heading">' + note('Group existing services into a single-priced bundle. Sample prices can be changed at any time.') +
      '<button type="button" class="button primary" data-new-bundle>Create Bundle</button></div>' + table(['Bundle', 'Included services', 'Bundle price', 'Status', ''], B.bundles(state).map(b => [
        '<strong>' + B.safe(b.label) + '</strong><small>' + B.safe(b.description) + '</small>',
        B.safe(B.services(state).filter(s => b.serviceIds.includes(s.id)).map(s => s.label).join(', ')), B.money(b.price),
        B.status(b.available ? 'Available' : 'Unavailable'), '<button type="button" class="button secondary small" data-edit-bundle="' + b.id + '">Edit Bundle</button>'
      ]), 'No bundles yet. Create one from your diagnostic services.');
  }
  function bind(region, role, refresh) {
    region.querySelector('[data-new-bundle]')?.addEventListener('click', () => bundleEditor(role, null, refresh));
    region.querySelectorAll('[data-edit-bundle]').forEach(button => button.addEventListener('click', () => bundleEditor(role, button.dataset.editBundle, refresh)));
  }
  function bundleEditor(role, id, refresh) {
    if (!['manager', 'admin'].includes(role)) return;
    const initial = B.read();
    const item = initial.bundles.find(b => b.id === id);
    const chosen = new Set(item?.serviceIds || []);
    Staff.dialog(item ? 'Edit Bundle' : 'Create Bundle',
      '<div class="form-grid"><label>Bundle name<input name="name" maxlength="100" value="' + B.safe(item?.label || '') + '" required></label>' +
      '<label>Bundle price (₱)<input name="price" type="number" min="1" max="100000" step="0.01" value="' + (item ? item.price / 100 : '') + '" required></label></div>' +
      '<label>About this bundle<textarea name="description" maxlength="1500" required>' + B.safe(item?.description || '') + '</textarea></label>' +
      '<p class="quiet">Drag services into the bundle, or use Add and Remove. Preparation instructions come from each included service.</p>' +
      '<div class="bundle-builder"><section><h3>Available services</h3><label>Find a service<input id="bundle-search" type="search" placeholder="Service name or category"></label><div id="bundle-available" class="bundle-pool" aria-label="Available services"></div></section>' +
      '<section><h3>Included in this bundle</h3><div id="bundle-chosen" class="bundle-pool bundle-drop" aria-label="Included services"></div><p id="bundle-total" role="status" class="quiet"></p></section></div>' +
      '<p id="bundle-feedback" class="message" role="status"></p><label class="check-row"><input name="available" type="checkbox"' + (!item || item.available !== false ? ' checked' : '') + '><span>Available in catalog, POS, and Reservation</span></label>', async form => {
        const data = new FormData(form);
        await saveBundle({ ...Object.fromEntries(data), serviceIds: [...chosen], available: data.has('available') }, id);
        refresh();
      }, { submitLabel: item ? 'Save Bundle' : 'Create Bundle' });
    const form = Staff.modal.querySelector('form');
    const available = form.querySelector('#bundle-available');
    const selected = form.querySelector('#bundle-chosen');
    const search = form.querySelector('#bundle-search');
    const list = B.services(initial);
    let customPrice = Boolean(item);
    form.elements.price.addEventListener('input', () => { customPrice = true; });
    const row = (s, included) => '<div class="bundle-service" draggable="true" data-bundle-service="' + s.id + '"><span><strong>' + B.safe(s.label) + '</strong><small>' + B.money(s.price) + (s.available ? '' : ' · Unavailable') + '</small></span>' +
      '<button type="button" class="button secondary small" data-bundle-toggle="' + s.id + '" aria-label="' + (included ? 'Remove ' : 'Add ') + B.safe(s.label) + '">' + (included ? 'Remove' : 'Add') + '</button></div>';
    function draw() {
      available.innerHTML = B.search(list.filter(s => s.available && !chosen.has(s.id)), search.value).map(s => row(s, false)).join('') || '<p class="empty">No matching services.</p>';
      selected.innerHTML = [...chosen].map(id => list.find(s => s.id === id)).filter(Boolean).map(s => row(s, true)).join('') || '<p class="empty">Drop services here or select Add. Choose at least two.</p>';
      const total = list.filter(s => chosen.has(s.id)).reduce((sum, s) => sum + s.price, 0);
      const countLabel = chosen.size + (chosen.size === 1 ? ' service' : ' services');
      form.querySelector('#bundle-total').textContent = countLabel + ' · Individual total ' + B.money(total) + (chosen.size < 2 ? '. Choose at least two services.' : '');
      form.querySelector('[type="submit"]').disabled = chosen.size < 2;
      if (!customPrice) form.elements.price.value = total ? (total / 100).toFixed(2) : '';
    }
    form.addEventListener('click', event => {
      const button = event.target.closest('[data-bundle-toggle]');
      if (!button) return;
      const serviceId = button.dataset.bundleToggle;
      if (chosen.has(serviceId)) chosen.delete(serviceId); else chosen.add(serviceId);
      form.querySelector('#bundle-feedback').textContent = chosen.size + (chosen.size === 1 ? ' service selected.' : ' services selected.');
      draw();
      (form.querySelector('[data-bundle-toggle="' + serviceId + '"]') || search).focus();
    });
    form.addEventListener('dragstart', event => {
      const service = event.target.closest('[data-bundle-service]');
      if (service) { event.dataTransfer.setData('text/plain', service.dataset.bundleService); event.dataTransfer.effectAllowed = 'move'; }
    });
    for (const [zone, add] of [[selected, true], [available, false]]) {
      zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', event => { if (!zone.contains(event.relatedTarget)) zone.classList.remove('drag-over'); });
      zone.addEventListener('drop', event => {
        event.preventDefault(); zone.classList.remove('drag-over');
        const serviceId = event.dataTransfer.getData('text/plain');
        if (!list.some(s => s.id === serviceId && (s.available || !add))) return;
        if (add) chosen.add(serviceId); else chosen.delete(serviceId);
        form.querySelector('#bundle-feedback').textContent = chosen.size + (chosen.size === 1 ? ' service selected.' : ' services selected.');
        draw();
      });
    }
    search.addEventListener('input', draw);
    draw();
  }
  return { page, bind, serviceEditor, saveService, saveBundle };
})();
