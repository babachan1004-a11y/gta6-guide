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

// ---------- 同期（Google Apps Script 経由でスプレッドシートに保存） ----------
// marks = { id: { v: 1|0, t: 更新時刻ms } }。端末どうしは項目ごとに新しい方を採用する。
const LS_MARKS = 'gta6-marks';
const LS_SYNC = 'gta6-sync';
let marks = {};
try { marks = JSON.parse(localStorage.getItem(LS_MARKS) || '{}') || {}; } catch (e) { marks = {}; }
// 旧形式のチェックを引き継ぐ
Object.keys(checks).forEach((id) => { if (!marks[id]) marks[id] = { v: 1, t: 1 }; });
let syncUrl = '';
try { syncUrl = localStorage.getItem(LS_SYNC) || ''; } catch (e) { syncUrl = ''; }
let syncState = syncUrl ? 'wait' : 'off';
let pushTimer = null;
let pushing = false;
let dirty = false;

function applyMarks() {
  checks = {};
  Object.keys(marks).forEach((id) => { if (marks[id].v) checks[id] = true; });
}
function mergeMarks(remote) {
  let changed = false;
  Object.keys(remote || {}).forEach((id) => {
    const r = remote[id];
    if (r && typeof r.t === 'number' && (!marks[id] || r.t > marks[id].t)) { marks[id] = { v: r.v ? 1 : 0, t: r.t }; changed = true; }
  });
  return changed;
}
function setSync(state) {
  syncState = state;
  const el = $('#syncBtn');
  if (!el) return;
  const label = { off: '同期オフ', wait: '同期中…', ok: '同期済み', err: '同期エラー' }[state];
  el.textContent = label;
  el.dataset.state = state;
}
async function pull() {
  if (!syncUrl) return;
  setSync('wait');
  try {
    const r = await fetch(syncUrl, { cache: 'no-store' });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    j.marks = j.marks || {};
    const changed = mergeMarks(j.marks);
    const localNewer = Object.keys(marks).some((id) => !j.marks[id] || marks[id].t > j.marks[id].t);
    if (changed) { applyMarks(); saveLocal(); renderAll(); }
    if (localNewer) schedulePush(); else setSync('ok');
  } catch (e) { setSync('err'); }
}
async function push() {
  if (!syncUrl) return;
  if (pushing) { dirty = true; return; }
  pushing = true; dirty = false;
  setSync('wait');
  try {
    const r = await fetch(syncUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ marks }) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    if (mergeMarks(j.marks)) { applyMarks(); saveLocal(); renderAll(); }
    setSync('ok');
  } catch (e) { setSync('err'); }
  pushing = false;
  if (dirty) push();
}
function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(push, 800); }
function saveLocal() {
  try { localStorage.setItem(LS_MARKS, JSON.stringify(marks)); localStorage.setItem(LS, JSON.stringify(checks)); } catch (e) { /* 保存できない環境でも表示は続ける */ }
}
function save() { saveLocal(); schedulePush(); }

// 同期リンク（…/#sync=<URLをbase64url>）で開いたら、この端末に同期先を覚える
(function readSyncLink() {
  const m = location.hash.match(/^#sync=([A-Za-z0-9_-]+)$/);
  if (!m) return;
  try {
    const url = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
    if (/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\?k=[\w-]+$/.test(url)) {
      syncUrl = url;
      localStorage.setItem(LS_SYNC, url);
    }
  } catch (e) { /* 壊れたリンクは無視 */ }
  history.replaceState(null, '', location.pathname);
}());

function openSync() {
  const on = !!syncUrl;
  $('#sheet').innerHTML = `<div class="sheet-h"><div><h2 id="dTitle">端末間の同期</h2></div><button class="x" id="close" aria-label="閉じる">×</button></div>
  ${on ? `<p>この端末は同期がオンです。チェックはあなたの Google ドライブのスプレッドシート「GTA6攻略ノート 同期データ」に保存され、ほかの端末と自動で合わせます。</p>
   <p class="muted">状態：${{ wait: '同期中', ok: '同期済み', err: 'つながりません（通信を確認してください。この端末には保存されています）', off: 'オフ' }[syncState]}</p>
   <div class="links"><button class="btn" id="syncNow">今すぐ同期</button><button class="btn" id="syncOff">この端末の同期をやめる</button></div>`
  : `<p>この端末は同期がオフです。チェックはこの端末の中だけに保存されています。</p>
   <p>同期するには、別に送られた<b>同期リンク</b>をこの端末で一度開いてください。</p>`}`;
  $('#scrim').hidden = false;
  document.body.style.overflow = 'hidden';
}
document.addEventListener('click', (e) => {
  if (e.target.id === 'syncBtn') { openSync(); return; }
  if (e.target.id === 'syncNow') { pull(); closeSheet(); return; }
  if (e.target.id === 'syncOff') {
    try { localStorage.removeItem(LS_SYNC); } catch (err) { /* 無視 */ }
    syncUrl = ''; setSync('off'); closeSheet();
  }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
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
  const pick = (m) => (!todo || !checks[m.id]) && (!q || (m.n + m.tips.join('') + (m.guide ? m.guide.f.join('') + (m.guide.h || []).join('') : '')).toLowerCase().includes(q));
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
   <button class="mopen" data-m="${m.id}" aria-expanded="${open}"><span class="nm">${m.n}</span><span class="chips">${flags(m)}</span>${m.tips.length || m.guide ? `<span class="more" aria-hidden="true">${open ? '▲' : '▼'}</span>` : '<span class="more" aria-hidden="true">›</span>'}</button>
   ${open ? `<div class="mbody">${m.tips.length ? `<ul class="tips">${m.tips.map((t) => `<li>${t}</li>`).join('')}</ul>` : (m.guide ? '' : '<p class="muted">特に注意点はありません。</p>')}${guideHtml(m.guide)}${m.url ? `<a class="ext" href="${m.url}" target="_blank" rel="noopener">GameWith でもっと詳しく ↗</a>` : ''}${m.src ? `<a class="ext" href="${m.src}" target="_blank" rel="noopener">${m.srcName || '情報元'}を見る ↗</a>` : ''}</div>` : ''}
  </div>`;
}

function guideHtml(g) {
  if (!g) return '';
  return `<div class="guide">
   <h4>流れ</h4><ol class="flow">${g.f.map((s) => `<li>${s}</li>`).join('')}</ol>
   ${g.h && g.h.length ? `<h4>コツ</h4><ul class="tips">${g.h.map((s) => `<li>${s}</li>`).join('')}</ul>` : ''}
   ${g.r ? `<p class="rew"><b>報酬</b>${g.r}</p>` : ''}
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
  marks[id] = { v: checks[id] ? 0 : 1, t: Date.now() };
  applyMarks();
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
    applyMarks();
    renderAll();
    setSync(syncState);
    pull();
  })
  .catch(() => { $('#storyList').innerHTML = '<div class="empty">データを読み込めませんでした。通信を確認して開き直してください。</div>'; });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
