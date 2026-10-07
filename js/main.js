(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Toast ---------- */
  var toastEl = $('#toast');
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3200);
  }

  /* ---------- Modal ---------- */
  var activeModal = null;
  var lastFocus = null;

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    lastFocus = document.activeElement;
    // 每次開啟都回到表單畫面
    $$('.modal__view', modal).forEach(function (el) { el.hidden = false; });
    $$('.modal__done', modal).forEach(function (el) { el.hidden = true; });
    modal.hidden = false;
    document.body.classList.add('is-locked');
    activeModal = modal;
    var first = $('input, select, button:not(.modal__close)', modal);
    if (first) first.focus();
  }

  function closeModal() {
    if (!activeModal) return;
    activeModal.hidden = true;
    activeModal = null;
    document.body.classList.remove('is-locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-modal-open]');
    if (opener) { openModal(opener.getAttribute('data-modal-open')); return; }
    if (e.target.closest('[data-modal-close]')) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (!activeModal) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    // focus trap
    var items = $$('a[href], button, input, select', activeModal).filter(function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- Form validation ---------- */
  function validate(form) {
    var firstInvalid = null;
    var msg = '';
    $$('input, select', form).forEach(function (el) {
      var target = el.type === 'file' ? el.closest('.dropzone') : el;
      var ok = el.checkValidity();
      target.classList.toggle('is-invalid', !ok);
      if (!ok && !firstInvalid) {
        firstInvalid = el;
        if (el.validity.valueMissing) {
          msg = el.type === 'checkbox' ? '請先勾選同意注意事項。'
              : el.type === 'file' ? '請上傳一張照片。'
              : '請填寫所有必填欄位。';
        } else if (el.type === 'email') msg = '請輸入正確的 Email 格式。';
        else if (el.type === 'tel') msg = '請輸入正確的手機號碼（09xx-xxx-xxx）。';
        else msg = '請確認欄位內容。';
      }
    });
    var msgEl = $('.form-msg', form);
    if (msgEl) { msgEl.textContent = msg; msgEl.hidden = !msg; }
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.classList && el.classList.contains('is-invalid') && el.checkValidity()) el.classList.remove('is-invalid');
  });

  /* ---------- 投稿表單 ---------- */
  var submitForm = $('#submit-form');
  var dropzone = $('#dropzone');
  var fileInput = $('#sf-photo');
  var MAX_SIZE = 10 * 1024 * 1024;

  function showPreview(file) {
    var hint = $('.dropzone__hint', dropzone);
    var preview = $('.dropzone__preview', dropzone);
    if (!file) { hint.hidden = false; preview.hidden = true; return; }
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      fileInput.value = ''; toast('請上傳 JPG 或 PNG 格式的照片。'); return showPreview(null);
    }
    if (file.size > MAX_SIZE) {
      fileInput.value = ''; toast('照片大小請在 10MB 以內。'); return showPreview(null);
    }
    var img = $('img', preview);
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(file);
    $('.dropzone__name', preview).textContent = file.name;
    hint.hidden = true;
    preview.hidden = false;
    dropzone.classList.remove('is-invalid');
  }

  fileInput.addEventListener('change', function () { showPreview(fileInput.files[0]); });
  ['dragenter', 'dragover'].forEach(function (type) {
    dropzone.addEventListener(type, function (e) { e.preventDefault(); dropzone.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (type) {
    dropzone.addEventListener(type, function (e) { e.preventDefault(); dropzone.classList.remove('is-over'); });
  });
  dropzone.addEventListener('drop', function (e) {
    var files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    var dt = new DataTransfer();
    dt.items.add(files[0]);
    fileInput.files = dt.files;
    showPreview(files[0]);
  });

  // 左側分類標籤 → 帶入表單的投稿分類
  $$('[data-pick-category]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      $('#sf-category').value = chip.getAttribute('data-pick-category');
      $('#sf-category').focus();
    });
  });

  submitForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate(submitForm)) return;
    // TODO: 串接後端 API，例如 fetch('/api/submissions', { method: 'POST', body: new FormData(submitForm) })
    submitForm.reset();
    showPreview(null);
    toast('投稿已送出，審核通過後將公開於投票區。');
  });

  /* ---------- 預約賞屋 ---------- */
  var bookingForm = $('[data-form="booking"]');
  bookingForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate(bookingForm)) return;
    // TODO: 串接後端 API
    bookingForm.reset();
    $('.modal__view', bookingForm).hidden = true;
    $('.modal__done', bookingForm).hidden = false;
  });

  /* ---------- 作品投票 ---------- */
  var VOTE_KEY = 'citymori-votes';
  var voteForm = $('[data-form="vote"]');
  var pendingWork = null;

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function readVotes() {
    try {
      var data = JSON.parse(localStorage.getItem(VOTE_KEY)) || {};
      return data.date === today() ? data : { date: today(), ids: [] };
    } catch (err) { return { date: today(), ids: [] }; }
  }
  function saveVote(id) {
    var data = readVotes();
    data.ids.push(id);
    try { localStorage.setItem(VOTE_KEY, JSON.stringify(data)); } catch (err) { /* 無痕模式等情況略過 */ }
  }
  function markVoted(work) {
    var btn = $('[data-vote]', work);
    btn.disabled = true;
    btn.textContent = '今日已投';
  }

  // 每位訪客每天對同一件作品限投一票（前端示意，正式以後端紀錄為準）
  var voted = readVotes().ids;
  $$('.work').forEach(function (work) {
    if (voted.indexOf(work.getAttribute('data-id')) > -1) markVoted(work);
  });

  $('#works').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-vote]');
    if (!btn) return;
    pendingWork = btn.closest('.work');
    openModal('modal-vote');
  });

  voteForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate(voteForm)) return;
    // TODO: 串接後端 API
    if (pendingWork) {
      var count = $('[data-votes]', pendingWork);
      count.textContent = parseInt(count.textContent, 10) + 1;
      var wrap = count.parentNode;
      wrap.classList.remove('is-bumped');
      void wrap.offsetWidth;
      wrap.classList.add('is-bumped');
      saveVote(pendingWork.getAttribute('data-id'));
      markVoted(pendingWork);
      pendingWork = null;
    }
    voteForm.reset();
    $('.modal__view', voteForm).hidden = true;
    $('.modal__done', voteForm).hidden = false;
  });

  /* ---------- 作品分類篩選 ---------- */
  var filterBtns = $$('[data-filter]');
  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.getAttribute('data-filter');
      var shown = 0;
      filterBtns.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on);
      });
      $$('.work').forEach(function (work) {
        var match = cat === 'all' || work.getAttribute('data-category') === cat;
        work.hidden = !match;
        if (match) shown++;
      });
      $('.works__empty').hidden = shown > 0;
    });
  });

  /* ---------- Nav：目前所在區塊 ---------- */
  var navLinks = $$('.nav__menu a');
  if ('IntersectionObserver' in window && navLinks.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('is-current', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(function (a) {
      var target = $(a.getAttribute('href'));
      if (target) io.observe(target);
    });
  }
})();
