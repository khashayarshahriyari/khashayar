/* Hafez Music Ontology — page logic. No dependencies.
   Data comes from data/lines.js (window.HMO_DATA), built by scripts/build_lines.py. */
(function () {
  'use strict';

  var D = window.HMO_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  if (!D || !D.lines || !D.lines.length) {
    var c = $('#random-card');
    if (c) c.textContent = 'The couplet data could not be loaded.';
    return;
  }

  var LINES = D.lines;
  var LEX = D.lexicon;
  var COUNTS = D.counts;
  var BY_ID = new Map(LINES.map(function (l) { return [l.id, l]; }));
  var WORK = { ghazal: 'Ghazal', ghete: "Qet’e", robaee: "Ruba’i", ghaside: 'Qasida', masnavi: 'Masnavi', saghiname: 'Saqi-nameh' };

  var state = { sel: null, words: new Set(), q: '', order: 'poem' };

  /* ---------- helpers ---------- */
  function label(l) {
    var base = l.poem ? WORK[l.work] + ' ' + l.poem : WORK[l.work];
    return base + ', couplet ' + l.couplet;
  }
  function ganjoorUrl(l) { return 'https://ganjoor.net' + l.url + '/#bn' + l.couplet; }

  var DIAC = /[ً-ٰٟـ]/g;
  function normFa(s) {
    return s.replace(DIAC, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک')
      .replace(/[آأإ]/g, 'ا').replace(/‌/g, ' ')
      .replace(/[^\w\s؀-ۿ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- rendering pieces ---------- */
  function hemistich(text, spans) {
    var d = el('div', 'm');
    var pos = 0;
    (spans || []).forEach(function (se) {
      if (se[0] > pos) d.append(text.slice(pos, se[0]));
      var m = el('mark', null, text.slice(se[0], se[1]));
      d.append(m);
      pos = se[1];
    });
    if (pos < text.length) d.append(text.slice(pos));
    return d;
  }
  function beyt(line, size) {
    var b = el('div', 'beyt beyt-' + size);
    b.lang = 'fa';
    line.v.forEach(function (t, i) { b.append(hemistich(t, line.hl[i])); });
    return b;
  }
  function refNode(line) {
    var p = el('p', 'ref');
    p.append(el('span', null, label(line)));
    var a = el('a', null, 'Read it on Ganjoor ↗');
    a.href = ganjoorUrl(line);
    a.rel = 'noopener';
    a.target = '_blank';
    p.append(a);
    return p;
  }
  function wordsNode(line) {
    var w = el('div', 'words');
    line.w.forEach(function (lemma) {
      var s = el('span', 'word');
      var fa = el('span', 'fa', lemma);
      fa.lang = 'fa';
      s.append(fa, el('span', 'gl', LEX[lemma] ? LEX[lemma].en : ''));
      w.append(s);
    });
    return w;
  }
  function transText(line, cls) {
    var p = el('p', cls);
    if (line.en) { p.textContent = line.en; p.lang = 'en'; }
    else { p.textContent = 'No English rendering yet for this couplet.'; p.className += ' missing'; }
    return p;
  }

  /* ---------- 1 · random couplet ---------- */
  var bag = [];
  var lastShown = null;
  function draw() {
    if (!bag.length) {
      bag = shuffle(LINES.map(function (l) { return l.id; }));
      if (bag.length > 1 && bag[bag.length - 1] === lastShown) {
        var t = bag[bag.length - 1]; bag[bag.length - 1] = bag[0]; bag[0] = t;
      }
    }
    lastShown = bag.pop();
    return BY_ID.get(lastShown);
  }
  function renderRandom(line) {
    var card = $('#random-card');
    card.replaceChildren(beyt(line, 'lg'), refNode(line), wordsNode(line));
    $('#random-count').textContent = (LINES.length - bag.length) + ' of ' + LINES.length + ' drawn in this shuffle';
  }
  function another() {
    var line = draw();
    renderRandom(line);
    select(line.id, 'random');
  }

  /* ---------- 2 · translation ---------- */
  var FROM = { random: 'From the random couplet', list: 'From the list', link: 'From a shared link' };
  function renderTrans() {
    var card = $('#trans-card');
    if (!state.sel) return;
    var line = BY_ID.get(state.sel.id);
    var kids = [el('p', 'from', FROM[state.sel.source] || ''), beyt(line, 'md'), refNode(line), transText(line, 'trans')];
    if (line.note) {
      var n = el('p', 'note');
      n.append(el('b', null, 'Note. '), document.createTextNode(line.note));
      kids.push(n);
    }
    kids.push(wordsNode(line));
    card.replaceChildren.apply(card, kids);
  }

  function select(id, source) {
    state.sel = { id: id, source: source };
    renderTrans();
    markSelectedInList();
    var line = BY_ID.get(id);
    try { history.replaceState(null, '', '#' + line.work + '/' + line.id.split('/')[1].split('#')[0] + '/' + line.couplet); } catch (e) { /* file:// */ }
  }

  /* ---------- 3 · browse ---------- */
  function matches(l) {
    if (state.words.size && !l.w.some(function (w) { return state.words.has(w); })) return false;
    if (!state.q) return true;
    if (/[a-z]/i.test(state.q)) {
      var hay = ((l.en || '') + ' ' + l.w.map(function (w) { return LEX[w] ? LEX[w].en : ''; }).join(' ')).toLowerCase();
      return hay.indexOf(state.q.toLowerCase()) !== -1;
    }
    return normFa(l.v.join(' ')).indexOf(normFa(state.q)) !== -1;
  }

  function itemNode(line) {
    var li = el('li', 'item');
    li.dataset.id = line.id;
    var b = el('button', 'row');
    b.type = 'button';
    b.append(beyt(line, 'md'));
    var r = el('p', 'ref');
    r.append(el('span', null, label(line)));
    b.append(r);
    li.append(b);
    return li;
  }

  function renderList() {
    var host = $('#list');
    var rows = LINES.filter(matches);
    host.replaceChildren();
    var shown = 0;
    if (state.order === 'word') {
      Object.keys(LEX).forEach(function (lemma) {
        if (state.words.size && !state.words.has(lemma)) return;
        var g = rows.filter(function (l) { return l.w.indexOf(lemma) !== -1; });
        if (!g.length) return;
        var head = el('div', 'group');
        var h = el('h3', null, lemma); h.lang = 'fa';
        head.append(h, el('span', null, LEX[lemma].en + ' · ' + g.length));
        var ul = el('ul', 'items');
        g.forEach(function (l) { ul.append(itemNode(l)); });
        host.append(head, ul);
        shown += g.length;
      });
    } else {
      var ul2 = el('ul', 'items');
      rows.forEach(function (l) { ul2.append(itemNode(l)); });
      host.append(ul2);
      shown = rows.length;
    }
    if (!rows.length) host.append(el('p', 'none', 'No couplets match.'));
    $('#list-count').textContent = rows.length === LINES.length
      ? LINES.length + ' couplets. Tap one to read it in section 2.'
      : rows.length + ' of ' + LINES.length + ' couplets.';
    markSelectedInList();
  }

  function markSelectedInList() {
    var id = state.sel && state.sel.id;
    var line = id ? BY_ID.get(id) : null;
    document.querySelectorAll('#list .item').forEach(function (li) {
      var on = li.dataset.id === id;
      li.classList.toggle('is-selected', on);
      var old = li.querySelector('.inline-trans');
      if (old) old.remove();
      if (on && line) li.append(transText(line, 'inline-trans'));
    });
  }

  function renderChips() {
    var host = $('#chips');
    host.replaceChildren();
    var all = el('button', 'chip all', 'All words');
    all.type = 'button';
    all.setAttribute('aria-pressed', state.words.size ? 'false' : 'true');
    all.addEventListener('click', function () { state.words.clear(); renderChips(); renderList(); });
    host.append(all);
    Object.keys(LEX).forEach(function (lemma) {
      if (!COUNTS[lemma]) return;
      var b = el('button', 'chip');
      b.type = 'button';
      b.lang = 'fa';
      b.title = LEX[lemma].en;
      b.setAttribute('aria-pressed', state.words.has(lemma) ? 'true' : 'false');
      var word = el('span', null, lemma);
      word.lang = 'fa';
      b.append(word, el('small', null, String(COUNTS[lemma])));
      b.addEventListener('click', function () {
        if (state.words.has(lemma)) state.words.delete(lemma); else state.words.add(lemma);
        renderChips(); renderList();
      });
      host.append(b);
    });
  }

  /* ---------- wiring ---------- */
  $('#again').addEventListener('click', another);
  $('#list').addEventListener('click', function (e) {
    var row = e.target.closest('.row');
    if (!row) return;
    select(row.closest('.item').dataset.id, 'list');
  });
  var qTimer;
  $('#q').addEventListener('input', function (e) {
    var v = e.target.value.trim();
    clearTimeout(qTimer);
    qTimer = setTimeout(function () { state.q = v; renderList(); }, 120);
  });
  document.querySelectorAll('.seg').forEach(function (b) {
    b.addEventListener('click', function () {
      state.order = b.dataset.order;
      document.querySelectorAll('.seg').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      renderList();
    });
  });

  /* ---------- start ---------- */
  renderChips();
  renderList();

  var fromLink = null;
  var m = /^#([a-z]+)\/([^\/]+)\/(\d+)$/.exec(location.hash);
  if (m) {
    var id = m[1] + '/' + m[2] + '#' + m[3];
    if (BY_ID.has(id)) fromLink = id;
  }
  var first = draw();
  renderRandom(first);
  if (fromLink) {
    select(fromLink, 'link');
    var t = $('#translation');
    if (t && t.scrollIntoView) setTimeout(function () { t.scrollIntoView(); }, 50);
  } else {
    select(first.id, 'random');
  }
})();
