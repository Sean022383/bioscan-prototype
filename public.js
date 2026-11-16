'use strict';

(() => {
  const B = Bioscan;
  function renderClinic() {
    const clinic = B.read().clinic;
    const heroPhoto = document.querySelector('#hero-clinic-photo');
    const photo = clinic.photos[0];
    if (heroPhoto && photo) { heroPhoto.src = photo.src; heroPhoto.alt = photo.caption || 'BioScan clinic exterior'; }
    const gallery = document.querySelector('#clinic-photos');
    const digits = clinic.phone.replace(/[^\d+]/g, "");
    const landline = digits.startsWith("0") ? "+63" + digits.slice(1) : digits;
    document.querySelectorAll('[data-clinic-address]').forEach(item => { item.textContent = clinic.address; });
    document.querySelector('#clinic-details').innerHTML = '<address>' + B.safe(clinic.address) + '</address>' +
      '<dl class="detail-list"><div><dt>Operating hours</dt><dd>' + B.safe(clinic.hours) +
      '</dd></div><div><dt>Landline</dt><dd><a href="tel:' + B.safe(landline) + '">' + B.safe(clinic.phone) +
      '</a></dd></div><div><dt>Email</dt><dd><a href="mailto:' + B.safe(clinic.email) + '">' + B.safe(clinic.email) + '</a></dd></div></dl>' +
      (clinic.sample ? '<p class="quiet">Contact the clinic to confirm operating hours.</p>' : '');
    gallery.hidden = clinic.photos.length === 0;
    gallery.innerHTML = gallery.hidden ? '' : '<div class="facility-grid">' + clinic.photos.map(photo =>
        '<figure><img loading="lazy" src="' + B.safe(photo.src) + '" alt="' + B.safe(photo.caption) + '"' +
        (photo.width && photo.height ? ' width="' + photo.width + '" height="' + photo.height + '"' : '') + '><figcaption>' +
        B.safe(photo.caption) + '</figcaption></figure>').join('') + '</div>';
  }
  renderClinic();
  const query = document.querySelector('#catalog-search');
  const category = document.querySelector('#catalog-category');
  const rows = document.querySelector('#catalog-rows');
  const count = document.querySelector('#catalog-count');
  const pagination = document.querySelector('#catalog-pagination');
  const pageSize = 8;
  let page = 1;
  const detail = document.querySelector('#service-detail');
  let activeService;
  let dismissTimer;
  function closeDetail() {
    clearTimeout(dismissTimer);
    activeService?.setAttribute('aria-expanded', 'false');
    detail.hidePopover();
    activeService = null;
  }
  function showDetail(button) {
    clearTimeout(dismissTimer);
    const service = B.offerings().find(item => item.id === button.dataset.serviceInfo);
    if (!service) return;
    activeService?.setAttribute('aria-expanded', 'false');
    activeService = button;
    button.setAttribute('aria-expanded', 'true');
    document.querySelector('#service-detail-title').textContent = service.label;
    document.querySelector('#service-detail-body').innerHTML = ServiceInfo.markup(service);
    detail.showPopover();
    const rect = button.getBoundingClientRect();
    detail.style.left = Math.max(12, Math.min(rect.left, innerWidth - detail.offsetWidth - 12)) + 'px';
    detail.style.top = Math.max(12, Math.min(rect.bottom + 8, innerHeight - detail.offsetHeight - 12)) + 'px';
  }
  rows.addEventListener('pointerover', event => {
    const button = event.target.closest('[data-service-info]');
    if (button) showDetail(button);
  });
  rows.addEventListener('focusin', event => {
    const button = event.target.closest('[data-service-info]');
    if (button) showDetail(button);
  });
  rows.addEventListener('click', event => {
    const button = event.target.closest('[data-service-info]');
    if (button) showDetail(button);
  });
  rows.addEventListener('pointerleave', () => { dismissTimer = setTimeout(() => {
    if (!detail.matches(':hover') && !detail.contains(document.activeElement) && document.activeElement !== activeService) closeDetail();
  }, 180); });
  detail.addEventListener('pointerenter', () => clearTimeout(dismissTimer));
  detail.addEventListener('pointerleave', () => { dismissTimer = setTimeout(() => {
    if (!detail.contains(document.activeElement) && document.activeElement !== activeService) closeDetail();
  }, 180); });
  document.querySelector('#close-service-detail').addEventListener('click', closeDetail);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDetail(); });
  document.addEventListener('pointerdown', event => {
    if (!detail.contains(event.target) && !event.target.closest('[data-service-info]')) closeDetail();
  });
  document.addEventListener('focusin', event => {
    if (!detail.contains(event.target) && !event.target.closest('[data-service-info]')) closeDetail();
  });
  addEventListener('resize', closeDetail);
  const featured = document.querySelector('#featured');
  const shortcuts = document.querySelector('#category-shortcuts');
  const bundlePreview = document.querySelector('#featured-bundles');
  category.innerHTML = B.categoryOptions();
  shortcuts?.addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category.value = button.dataset.category;
    const selected = category.value;
    filter();
    [...shortcuts.querySelectorAll('[data-category]')].find(item => item.dataset.category === selected)?.focus({ preventScroll: true });
  });
  for (const name of ['click', 'focusin', 'pointerover']) bundlePreview?.addEventListener(name, event => {
    const button = event.target.closest('[data-service-info]');
    if (button) showDetail(button);
  });
  function renderPagination(pageCount) {
    pagination.hidden = pageCount < 2;
    if (pagination.hidden) {
      pagination.replaceChildren();
      return;
    }

    const start = Math.max(1, Math.min(page - 1, pageCount - 2));
    const visiblePages = [...new Set([1, start, start + 1, start + 2, pageCount])]
      .filter(number => number <= pageCount);
    const numberButtons = visiblePages.map((number, index) => {
      const gap = index > 0 && number - visiblePages[index - 1] > 1
        ? '<span class="catalog-ellipsis" aria-hidden="true">…</span>'
        : '';
      const current = number === page ? ' aria-current="page"' : '';
      return gap + '<button type="button" class="page-number" data-page="' + number +
        '" aria-label="Page ' + number + '"' + current + '>' + number + '</button>';
    }).join('');
    pagination.innerHTML =
      '<button type="button" class="page-direction" data-page="' + (page - 1) + '" aria-label="Previous page"' +
      (page === 1 ? ' disabled' : '') + '><span class="page-chevron previous" aria-hidden="true"></span>' +
      '<span class="page-direction-label">Previous</span></button>' + numberButtons +
      '<button type="button" class="page-direction" data-page="' + (page + 1) + '" aria-label="Next page"' +
      (page === pageCount ? ' disabled' : '') + '><span class="page-direction-label">Next</span>' +
      '<span class="page-chevron" aria-hidden="true"></span></button>';
  }

  function render(focusPage = pagination.contains(document.activeElement)) {
    closeDetail();
    const services = B.offerings().filter(item => item.available);
    if (shortcuts) shortcuts.innerHTML = [...category.options].map(option => '<button type="button" data-category="' + B.safe(option.value) + '" aria-pressed="' + (category.value === option.value) + '">' + B.safe(option.value || 'All services') + '</button>').join('');
    if (bundlePreview) bundlePreview.innerHTML = B.bundles().filter(b => b.available).slice(0, 4).map(bundle => '<button type="button" class="bundle-preview-item" data-service-info="' + bundle.id + '" aria-controls="service-detail" aria-expanded="false"><strong>' + B.safe(bundle.label) + '</strong><span>' + bundle.serviceIds.length + ' included services</span><span class="bundle-preview-link">View bundle <span class="arrow" aria-hidden="true"></span></span></button>').join('');
    featured.innerHTML = ['urinalysis', 'cbc', 'fbs'].map(id => services.find(item => item.id === id))
      .filter(Boolean).map(item => '<li><span>' + B.safe(item.label) + '</span></li>').join('');
    const results = B.search(services, query.value, category.value);
    const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
    page = Math.min(page, pageCount);
    const offset = (page - 1) * pageSize;
    rows.innerHTML = results.slice(offset, offset + pageSize).map(item =>
      '<tr><th scope="row"><button class="service-name" data-service-info="' + item.id + '" aria-controls="service-detail" aria-expanded="false">' + B.safe(item.label) + '</button><small>' + B.safe(item.category) + '</small></th><td>' +
      B.safe(item.category) + '</td></tr>'
    ).join('') || '<tr><td colspan="2" class="empty">No services match your search.</td></tr>';
    const start = offset + 1;
    const end = Math.min(offset + pageSize, results.length);
    const range = start === end ? String(end) : start + '–' + end;
    count.textContent = results.length
      ? 'Showing ' + range + ' of ' + results.length + (results.length === 1 ? ' service' : ' services')
      : '0 services';
    renderPagination(pageCount);
    if (focusPage) (pagination.querySelector('[aria-current="page"]') ?? query).focus();
  }

  function filter() {
    page = 1;
    render();
  }

  query.addEventListener('input', filter);
  category.addEventListener('change', filter);
  pagination.addEventListener('click', event => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    const nextPage = Number(button.dataset.page);
    if (nextPage === page) return;
    page = nextPage;
    render(true);
  });
  addEventListener('storage', event => {
    if (event.key !== B.key) return;
    renderClinic();
    render();
  });
  render();
})();
