// GTA6 攻略ノート。中身はすべて data.json、チェックは端末ごとに localStorage に保存。
const SECK = ['鍵', 'アラーム', 'トラッカー'];
const LS = 'gta6-note-v1';
const LS_UI = 'gta6-note-ui';
const $ = (s) => document.querySelector(s);
const fmt = (v) => '$' + (v || 0).toLocaleString('en-US');
const plain = (s) => String(s).replace(/<[^>]+>/g, '');
let D = { items: [], story: { chapters: [] }, subs: [], system: [] };
let ITEMS = [];
let checks = {};
let filter = 'all';
let ui = { view: 'story', ch: 1, sideType: 'すべて' };
try { checks = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { checks = {}; }
try { ui = { ...ui, ...(JSON.parse(localStorage.getItem(LS_UI) || '{}') || {}) }; } catch (e) { /* 既定値のまま */ }

function save() { try { localStorage.setItem(LS, JSON.stringify(checks)); } catch (e) { /* 保存できない環境でも表示は続ける */ } }
function saveUi() { try { localStorage.setItem(LS_UI, JSON.stringify(ui)); } catch (e) { /* 同上 */ } }
const count = (arr) => arr.filter((x) => checks[x.id]).length;
const allMissions = () => D.story.chapters.flatMap((c) => c.missions);

// ---------- 上の進捗 ----------
function renderStats() {
  const ms = allMissions();
  const set = (k, got, all) => {
    $('#s' + k).innerHTML = `${got}<small>/${all}</small>`;
    $('#t' + k).style.width = (all ? got / all * 100 : 0) + '%';
  };
  set('Story', count(ms), ms.length);
  set('Side', count(D.subs), D.subs.length);
  set('Item', count(ITEMS), ITEMS.length);
}

// ---------- ストーリー ----------
function flags(m) {
  const c = [];
  if (m.g === 's') c.push('<span class="chip">寄り道</span>');
  else if (m.opt) c.push('<span class="chip">任意</span>');
  if (m.miss) c.push('<span class="chip miss">取り逃し注意</span>');
  if (m.love) c.push('<span class="chip love">親密度</span>');
  if (m.money) c.push('<span class="chip money">お金</span>');
  return c.join('');
}

function renderStory() {
  const chs = D.story.chapters;
  if (!chs.length) return;
  if (!chs.find((c) => c.no === ui.ch)) ui.ch = chs[0].no;
  $('#chapters').innerHTML = chs.map((c) => `<button class="tab" data-ch="${c.no}" aria-pressed="${c.no === ui.ch}">${c.no}章<span class="c">${count(c.missions)}/${c.missions.length}</span></button>`).join('');
  $('#sysList').innerHTML = D.system.map((s) => `<li>${s}</li>`).join('');
  const ch = chs.find((c) => c.no === ui.ch);
  const warn = $('#chWarn');
  warn.hidden = !ch.warn.length;
  warn.innerHTML = `<span aria-hidden="true">⚠</span><div><b>${ch.no}章の取り逃し注意</b><ul>${ch.warn.map((w) => `<li>${w}</li>`).join('')}</ul></div>`;
  const q = $('#qStory').value.trim().toLowerCase();
  const todo = $('#todoStory').checked;
  const pick = (m) => (!todo || !checks[m.id]) && (!q || (m.n + m.tips.join('')).toLowerCase().includes(q));
  const group = (g, label) => {
    const rows = ch.missions.filter((m) => m.g === g && pick(m));
    if (!rows.length) return '';
    return `<h3 class="grp">${label}<span>${count(ch.missions.filter((m) => m.g === g))}/${ch.missions.filter((m) => m.g === g).length}</span></h3><div class="mlist">${rows.map(missionRow).join('')}</div>`;
  };
  const html = group('m', 'メイン') + group('s', '寄り道');
  $('#storyList').innerHTML = html || '<div class="empty">条件に合うミッションはありません</div>';
}

function missionRow(m) {
  const on = !!checks[m.id];
  const open = ui.open === m.id;
  return `<div class="mrow${on ? ' done' : ''}${m.miss ? ' miss' : ''}">
   <button class="chk sm" role="checkbox" aria-checked="${on}" data-id="${m.id}" aria-label="${m.n} をクリア済みにする">✓</button>
   <button class="mopen" data-m="${m.id}" aria-expanded="${open}"><span class="nm">${m.n}</span><span class="chips">${flags(m)}</span>${m.tips.length ? `<span class="more" aria-hidden="true">${open ? '▲' : '▼'}</span>` : '<span class="more" aria-hidden="true">›</span>'}</button>
   ${open ? `<div class="mbody">${m.tips.length ? `<ul class="tips">${m.tips.map((t) => `<li>${t}</li>`).join('')}</ul>` : '<p class="muted">特に注意点はありません。</p>'}<a class="ext" href="${m.url}" target="_blank" rel="noopener">攻略チャートを見る（GameWith）↗</a></div>` : ''}
  </div>`;
}

// ---------- サイド ----------
function renderSide() {
  const types = ['すべて', ...new Set(D.subs.map((s) => s.type))];
  if (!types.includes(ui.sideType)) ui.sideType = 'すべて';
  $('#sideTypes').innerHTML = types.map((t) => {
    const arr = t === 'すべて' ? D.subs : D.subs.filter((s) => s.type === t);
    return `<button class="tab" data-st="${t}" aria-pressed="${t === ui.sideType}">${t}<span class="c">${count(arr)}/${arr.length}</span></button>`;
  }).join('');
  const q = $('#qSide').value.trim().toLowerCase();
  const todo = $('#todoSide').checked;
  const rows = D.subs.filter((s) => (ui.sideType === 'すべて' || s.type === ui.sideType) && (!todo || !checks[s.id])
    && (!q || (s.n + s.when + s.cond + s.rew + (s.note || '')).toLowerCase().includes(q)));
  $('#sideList').innerHTML = rows.length ? rows.map((s) => {
    const on = !!checks[s.id];
    return `<div class="scard${on ? ' done' : ''}">
     <button class="chk" role="checkbox" aria-checked="${on}" data-id="${s.id}" aria-label="${s.n} をクリア済みにする">✓</button>
     <div class="sbody"><div class="nm">${s.n}</div><div class="chips"><span class="chip v">${s.type}</span>${s.miss ? `<span class="chip miss">${s.miss}</span>` : ''}${s.money ? '<span class="chip money">金策</span>' : ''}</div>
      <dl class="kv"><dt>発生</dt><dd>${s.when}</dd><dt>始め方</dt><dd>${s.cond}</dd><dt>報酬</dt><dd>${s.rew}</dd>${s.note ? `<dt>メモ</dt><dd>${s.note}</dd>` : ''}</dl></div>
    </div>`;
  }).join('') : '<div class="empty">条件に合う依頼はありません</div>';
}

// ---------- 武器・車 ----------
function matches(it) {
  if (filter === 'w' && it.cat !== 'w') return false;
  if (filter === 'v' && it.cat !== 'v') return false;
  if (filter === 'miss' && !it.miss) return false;
  if (filter === 'money' && !it.money) return false;
  if ($('#todo').checked && checks[it.id]) return false;
  const q = $('#q').value.trim().toLowerCase();
  if (q && !plain(it.n + it.sub + it.steps.join('') + (it.memo || '')).toLowerCase().includes(q)) return false;
  return true;
}

function chips(it) {
  const c = [`<span class="chip ${it.cat}">${it.cat === 'w' ? '金武器' : 'レア車'}</span>`];
  if (it.miss) c.push('<span class="chip miss">取り逃し注意</span>');
  if (it.gtaplus) c.push('<span class="chip">GTA+</span>');
  if (it.sale) c.push(`<span class="chip ${it.money ? 'money' : ''}"><span class="price">${fmt(it.sale)}</span></span>`);
  return c.join('');
}

function renderItems() {
  const W = ITEMS.filter((i) => i.cat === 'w');
  const V = ITEMS.filter((i) => i.cat === 'v');
  $('#sMoney').textContent = fmt(V.filter((i) => checks[i.id]).reduce((s, i) => s + (i.sale || 0), 0));
  $('#sV').textContent = `（${count(V)}/${V.length} 台）`;
  $('#cAll').textContent = ITEMS.length;
  $('#cW').textContent = W.length;
  $('#cV').textContent = V.length;
  $('#cMiss').textContent = ITEMS.filter((i) => i.miss).length;
  $('#cMoney').textContent = ITEMS.filter((i) => i.money).length;
  const left = ITEMS.filter((i) => i.miss && !checks[i.id]);
  const al = $('#missAlert');
  al.hidden = !left.length;
  al.innerHTML = left.length ? `<span aria-hidden="true">⚠</span><div><b>取り逃し注意 ${left.length}件が未取得</b><br>${left.map((i) => `${i.n}：${i.missText}`).join('<br>')}</div>` : '';
  const rows = ITEMS.filter(matches);
  $('#list').innerHTML = rows.length ? rows.map((it) => `<div class="card${checks[it.id] ? ' done' : ''}">
  <button class="chk" role="checkbox" aria-checked="${!!checks[it.id]}" data-id="${it.id}" aria-label="${it.n} を取得済みにする">✓</button>
  <img class="thumb" src="img/${it.cover}.jpg" alt="" loading="lazy">
  <button class="open" data-open="${it.id}"><span class="nm">${it.n}</span><span class="sub">${it.sub}</span><span class="chips">${chips(it)}</span></button>
 </div>`).join('') : '<div class="empty">条件に合うものはありません</div>';
}

function openSheet(id) {
  const it = ITEMS.find((i) => i.id === id);
  if (!it) return;
  const on = !!checks[id];
  const facts = [];
  if (it.cat === 'v') {
    (it.sec || []).forEach((s, k) => facts.push(`<div class="fact"><div class="k">${SECK[k]}</div><div class="v ${s === 'なし' ? 'ok' : s === '—' ? '' : 'ng'}">${s}</div></div>`));
    facts.push(`<div class="fact"><div class="k">売却価格</div><div class="v price">${it.sale ? fmt(it.sale) : '—'}</div></div>`);
    facts.push(`<div class="fact"><div class="k">登録費用</div><div class="v price">${it.reg ? fmt(it.reg) : '—'}</div></div>`);
  }
  $('#sheet').innerHTML = `<div class="sheet-h"><div><h2 id="dTitle">${it.n}</h2><div class="sub wrapline">${it.sub}</div><div class="chips gap">${chips(it)}</div></div><button class="x" id="close" aria-label="閉じる">×</button></div>
 <button class="big-chk" role="checkbox" aria-checked="${on}" data-id="${id}">${on ? '✓ 取得済み' : '取得したらタップ'}</button>
 ${it.miss ? `<div class="alert"><span aria-hidden="true">⚠</span><div><b>取り逃し注意</b>：${it.missText}</div></div>` : ''}
 <div><p class="sec-t">取り方</p><ol class="steps">${it.steps.map((s) => `<li>${s}</li>`).join('')}</ol></div>
 ${facts.length ? `<div class="facts">${facts.join('')}</div>` : ''}
 ${it.memo ? `<div class="memo">${it.memo}</div>` : ''}
 <div><p class="sec-t">マップと現地</p><div class="gal">${it.imgs.map((m) => `<figure><button data-img="img/${m[0]}.jpg" aria-label="${m[1]}を拡大"><img src="img/${m[0]}.jpg" alt="${m[1]}" loading="lazy"></button><figcaption>${m[1]}</figcaption></figure>`).join('')}</div></div>
 <div class="links"><a class="vid" href="${it.vid}" target="_blank" rel="noopener">▶ 動画で見る（${it.vl}）</a></div>`;
  $('#scrim').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#close').focus({ preventScroll: true });
}
function closeSheet() { $('#scrim').hidden = true; document.body.style.overflow = ''; }

// ---------- 画面の切り替え ----------
function renderView() {
  document.querySelectorAll('.view').forEach((b) => b.setAttribute('aria-selected', b.dataset.v === ui.view));
  $('#vStory').hidden = ui.view !== 'story';
  $('#vSide').hidden = ui.view !== 'side';
  $('#vItems').hidden = ui.view !== 'items';
}
function renderAll() {
  renderStats();
  renderView();
  if (ui.view === 'story') renderStory();
  if (ui.view === 'side') renderSide();
  if (ui.view === 'items') renderItems();
}

function toggle(id) {
  if (checks[id]) delete checks[id]; else checks[id] = true;
  save();
  renderAll();
  if (!$('#scrim').hidden) openSheet(id);
}

document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-id]');
  if (c) { e.preventDefault(); toggle(c.dataset.id); return; }
  const v = e.target.closest('.view');
  if (v) { ui.view = v.dataset.v; saveUi(); renderAll(); scrollTo({ top: 0 }); return; }
  const chb = e.target.closest('[data-ch]');
  if (chb) { ui.ch = +chb.dataset.ch; ui.open = null; saveUi(); renderStory(); return; }
  const mo = e.target.closest('[data-m]');
  if (mo) { ui.open = ui.open === mo.dataset.m ? null : mo.dataset.m; renderStory(); return; }
  const st = e.target.closest('[data-st]');
  if (st) { ui.sideType = st.dataset.st; saveUi(); renderSide(); return; }
  const o = e.target.closest('[data-open]');
  if (o) { openSheet(o.dataset.open); return; }
  const im = e.target.closest('[data-img]');
  if (im) { $('#lb img').src = im.dataset.img; $('#lb').hidden = false; return; }
  if (e.target.id === 'close' || e.target.id === 'scrim') { closeSheet(); return; }
  if (e.target.closest('#lb')) { $('#lb').hidden = true; return; }
  const t = e.target.closest('.tab[data-f]');
  if (t) {
    filter = t.dataset.f;
    document.querySelectorAll('.tab[data-f]').forEach((b) => b.setAttribute('aria-pressed', b === t));
    renderItems();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#lb').hidden) $('#lb').hidden = true; else if (!$('#scrim').hidden) closeSheet();
});
$('#q').addEventListener('input', renderItems);
$('#todo').addEventListener('change', renderItems);
$('#qStory').addEventListener('input', renderStory);
$('#todoStory').addEventListener('change', renderStory);
$('#qSide').addEventListener('input', renderSide);
$('#todoSide').addEventListener('change', renderSide);

fetch('data.json?t=' + Date.now())
  .then((r) => r.json())
  .then((d) => {
    D = { ...D, ...d };
    ITEMS = d.items || [];
    $('#updated').textContent = d.updated ? `データ更新：${d.updated}` : '';
    renderAll();
  })
  .catch(() => { $('#storyList').innerHTML = '<div class="empty">データを読み込めませんでした。通信を確認して開き直してください。</div>'; });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
