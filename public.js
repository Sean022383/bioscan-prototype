'use strict';

(() => {
  const B = Bioscan;
  function renderClinic() {
    const clinic = B.read().clinic;
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
  const featured = document.querySelector('#featured');
  category.innerHTML = B.categoryOptions();
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
    const services = B.services().filter(item => item.available);
    featured.innerHTML = ['urinalysis', 'cbc', 'fbs'].map(id => services.find(item => item.id === id))
      .filter(Boolean).map(item => '<li><span>' + B.safe(item.label) + '</span><strong>' + B.compactMoney(item.price) + '</strong></li>').join('');
    const results = B.search(services, query.value, category.value);
    const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
    page = Math.min(page, pageCount);
    const offset = (page - 1) * pageSize;
    rows.innerHTML = results.slice(offset, offset + pageSize).map(item =>
      '<tr><th scope="row">' + B.safe(item.label) + '<small>' + B.safe(item.category) + '</small></th><td>' +
      B.safe(item.category) + '</td><td class="numeric">' + B.compactMoney(item.price) + '</td></tr>'
    ).join('') || '<tr><td colspan="3" class="empty">No services match your search.</td></tr>';
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
