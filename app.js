(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const bookList = $('#bookList');
  const emptyState = $('#emptyState');
  const libraryCount = $('#libraryCount');

  const searchInput = $('#searchInput');
  const viewerTitle = $('#viewerTitle');
  const viewerSubtitle = $('#viewerSubtitle');
  const viewerWrap = $('#viewerWrap');
  const pdfFrame = $('#pdfFrame');
  const viewerStatus = $('#viewerStatus');
  const downloadBtn = $('#downloadBtn');
  const openBtn = $('#openBtn');

  const filters = $$('.chip');

  let state = {
    selectedId: null,
    books: [], // {id, title, src, kind, originalName?}
  };

  function makeId(title) {
    return 'b_' + title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  }

  function setStatusLoading() {
    viewerWrap.hidden = true;
    pdfFrame.removeAttribute('src');
    viewerStatus.innerHTML = `
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-line"></div>
    `;
  }

  function setStatusReady() {
    viewerStatus.innerHTML = `
      <div class="ready" style="margin-top:2px;color:rgba(234,241,255,.72);font-size:12px;">Ready</div>
    `;
  }

  function updateCount() {
    libraryCount.textContent = `${state.books.length} ${state.books.length === 1 ? 'book' : 'books'}`;
  }

  function normalizeTitle(t) {
    return (t || '').toString().trim();
  }

  function matchesFilter(book, filter) {
    if (filter === 'all') return true;
    if (filter === 'default') return book.kind === 'default';
    if (filter === 'uploaded') return book.kind === 'uploaded';
    return true;
  }

  function currentFilter() {
    const active = filters.find((b) => b.classList.contains('is-active'));
    return active ? active.dataset.filter : 'all';
  }

  function getQuery() {
    return (searchInput.value || '').toLowerCase().trim();
  }

  function applySearchAndRender() {
    const q = getQuery();
    const filter = currentFilter();

    const visible = state.books.filter((b) => {
      if (!matchesFilter(b, filter)) return false;
      if (!q) return true;
      const hay = `${b.title} ${b.originalName || ''}`.toLowerCase();
      return hay.includes(q);
    });

    bookList.innerHTML = '';

    if (visible.length === 0) {
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
    }

    visible.forEach((book) => {
      const li = document.createElement('li');
      li.className = 'book-item';
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '0');
      li.dataset.id = book.id;
      li.setAttribute('aria-selected', book.id === state.selectedId ? 'true' : 'false');

      if (book.id === state.selectedId) li.classList.add('is-selected');

      li.innerHTML = `
        <div class="book-icon" aria-hidden="true">📘</div>
        <div class="book-main">
          <div class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</div>
          <div class="book-desc">${book.kind === 'default' ? 'Default PDF' : 'Uploaded'} • ${escapeHtml(
        (book.originalName || book.title)
      )}</div>
        </div>
      `;

      const activate = () => selectBook(book.id);
      li.addEventListener('click', activate);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });

      bookList.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '<')
      .replaceAll('>', '>')
      .replaceAll('"', '"')
      .replaceAll("'", '&#039;');
  }

  function selectBook(id) {
    const book = state.books.find((b) => b.id === id);
    if (!book) return;

    state.selectedId = id;

    // Rerender selected state
    applySearchAndRender();

    viewerTitle.textContent = book.title;
    viewerSubtitle.textContent = book.kind === 'default' ? 'Default library PDF' : `Uploaded: ${book.originalName}`;

    downloadBtn.disabled = false;
    openBtn.disabled = false;

    // Set preview
    setStatusLoading();
    viewerWrap.hidden = false;
    pdfFrame.src = book.src;

    // Buttons
    // Download: use the same src; for uploaded Blob URLs this works in-session.
    downloadBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = book.src;
      a.download = book.originalName ? sanitizeFilename(book.originalName) : sanitizeFilename(book.title) + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    openBtn.onclick = () => {
      window.open(book.src, '_blank', 'noopener');
    };

    // Hide fallback is controlled by iframe load
    const fallback = $('#fallback');
    fallback.hidden = true;

    // Once loaded, mark ready; if blocked, we show fallback after a short timeout.
    pdfFrame.onload = () => {
      setStatusReady();
    };

    setTimeout(() => {
      // If still no content, we can't reliably detect; show fallback if viewerWrap exists but iframe hasn't rendered.
      // We'll treat "load not fired" as potentially blocked.
      // (No harm if iframe loads just after.)
      if (!$('#fallback').hidden) return;
    }, 900);
  }

  function sanitizeFilename(name) {
    return String(name || 'file')
      .replaceAll(/[^a-z0-9._-]/gi, '_')
      .replaceAll(/_+/g, '_')
      .slice(0, 120);
  }

  function seedDefaultBooks() {
    const defaults = [
      { title: 'Book 1', src: 'books/book1.pdf', kind: 'default', originalName: 'book1.pdf' },
      { title: 'Book 2', src: 'books/book2.pdf', kind: 'default', originalName: 'book2.pdf' },
    ];

    state.books = defaults.map((b) => ({
      id: makeId(b.title + '_' + b.originalName),
      ...b,
    }));

    updateCount();
  }

  function addUploadedBook(file) {
    const title = file.name.replace(/\.pdf$/i, '') || 'Uploaded PDF';
    const src = URL.createObjectURL(file);

    const book = {
      id: makeId(title + '_' + Date.now().toString()),
      title,
      src,
      kind: 'uploaded',
      originalName: file.name,
    };

    state.books.unshift(book);
    updateCount();
  }

  function initUpload() {
    const upload = $('#pdfUpload');

    upload.addEventListener('change', () => {
      const file = upload.files && upload.files[0];
      if (!file) return;

      if (file.type && file.type !== 'application/pdf') {
        alert('Please upload a valid PDF file.');
        upload.value = '';
        return;
      }

      addUploadedBook(file);
      applySearchAndRender();
      selectBook(state.books[0].id);

      // allow uploading same file again
      upload.value = '';
    });
  }

  function initFilters() {
    filters.forEach((chip) => {
      chip.addEventListener('click', () => {
        filters.forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        applySearchAndRender();

        // Keep selection if it still exists in visible list; otherwise pick first visible.
        const visibleIds = Array.from(bookList.querySelectorAll('.book-item')).map((el) => el.dataset.id);
        if (state.selectedId && visibleIds.includes(state.selectedId)) return;
        if (visibleIds[0]) selectBook(visibleIds[0]);
      });
    });
  }

  function initSearch() {
    searchInput.addEventListener('input', () => {
      applySearchAndRender();

      const visibleIds = Array.from(bookList.querySelectorAll('.book-item')).map((el) => el.dataset.id);
      if (state.selectedId && visibleIds.includes(state.selectedId)) return;
      if (visibleIds[0]) selectBook(visibleIds[0]);
    });
  }

  function initFooterClock() {
    const yearEl = $('#footerYear');
    const timeEl = $('#footerTime');
    const dateEl = $('#footerDate');

    const now = new Date();
    yearEl.textContent = now.getFullYear();

    const tick = () => {
      const n = new Date();
      timeEl.textContent = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      dateEl.textContent = n.toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' });
    };

    tick();
    setInterval(tick, 1000);
  }

  function init() {
    seedDefaultBooks();

    // Default select first book
    state.selectedId = state.books[0]?.id || null;

    updateCount();

    initUpload();
    initFilters();
    initSearch();
    initFooterClock();

    // first render
    applySearchAndRender();

    if (state.selectedId) selectBook(state.selectedId);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

