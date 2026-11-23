// GTA6 攻略ノート。中身はすべて data.json、チェックは端末ごとに localStorage に保存。
const SECK = ['鍵', 'アラーム', 'トラッカー'];
const LS = 'gta6-note-v1';
const $ = (s) => document.querySelector(s);
const fmt = (v) => '$' + (v || 0).toLocaleString('en-US');
let ITEMS = [];
let checks = {};
let filter = 'all';
try { checks = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { checks = {}; }

function save() { try { localStorage.setItem(LS, JSON.stringify(checks)); } catch (e) { /* 保存できない環境でも表示は続ける */ } }

function matches(it) {
  if (filter === 'w' && it.cat !== 'w') return false;
  if (filter === 'v' && it.cat !== 'v') return false;
  if (filter === 'miss' && !it.miss) return false;
  if (filter === 'money' && !it.money) return false;
  if ($('#todo').checked && checks[it.id]) return false;
  const q = $('#q').value.trim().toLowerCase();
  if (q) {
    const hay = (it.n + it.sub + it.steps.join('') + (it.memo || '')).replace(/<[^>]+>/g, '').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function chips(it) {
  const c = [`<span class="chip ${it.cat}">${it.cat === 'w' ? '金武器' : 'レア車'}</span>`];
  if (it.miss) c.push('<span class="chip miss">取り逃し注意</span>');
  if (it.gtaplus) c.push('<span class="chip">GTA+</span>');
  if (it.sale) c.push(`<span class="chip ${it.money ? 'money' : ''}"><span class="price">${fmt(it.sale)}</span></span>`);
  return c.join('');
}

function render() {
  const W = ITEMS.filter((i) => i.cat === 'w');
  const V = ITEMS.filter((i) => i.cat === 'v');
  const got = ITEMS.filter((i) => checks[i.id]).length;
  const gw = W.filter((i) => checks[i.id]).length;
  const gv = V.filter((i) => checks[i.id]).length;
  $('#sAll').innerHTML = `${got}<small>/${ITEMS.length}</small>`;
  $('#tAll').style.width = (ITEMS.length ? got / ITEMS.length * 100 : 0) + '%';
  $('#sW').innerHTML = `${gw}<small>/${W.length}</small>`;
  $('#tW').style.width = (W.length ? gw / W.length * 100 : 0) + '%';
  $('#sMoney').textContent = fmt(V.filter((i) => checks[i.id]).reduce((s, i) => s + (i.sale || 0), 0));
  $('#sV').textContent = `${gv}/${V.length} 台`;
  $('#cAll').textContent = ITEMS.length;
  $('#cW').textContent = W.length;
  $('#cV').textContent = V.length;
  $('#cMiss').textContent = ITEMS.filter((i) => i.miss).length;
  $('#cMoney').textContent = ITEMS.filter((i) => i.money).length;

  const left = ITEMS.filter((i) => i.miss && !checks[i.id]);
  const al = $('#missAlert');
  al.hidden = !left.length;
  al.innerHTML = left.length
    ? `<span aria-hidden="true">⚠</span><div><b>取り逃し注意 ${left.length}件が未取得</b><br>${left.map((i) => `${i.n}：${i.missText}`).join('<br>')}</div>`
    : '';

  const rows = ITEMS.filter(matches);
  $('#list').innerHTML = rows.length ? rows.map((it) => `<div class="card${checks[it.id] ? ' done' : ''}">
  <button class="chk" role="checkbox" aria-checked="${!!checks[it.id]}" data-id="${it.id}" aria-label="${it.n} を取得済みにする">✓</button>
  <img class="thumb" src="img/${it.cover}.jpg" alt="" loading="lazy">
  <button class="open" data-open="${it.id}"><span class="nm">${it.n}</span><span class="sub">${it.sub}</span><span class="chips">${chips(it)}</span></button>
 </div>`).join('') : '<div class="empty">条件に合うものはありません</div>';
}

function toggle(id) {
  if (checks[id]) delete checks[id]; else checks[id] = true;
  save();
  render();
  if (!$('#scrim').hidden) openSheet(id);
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

document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-id]');
  if (c) { toggle(c.dataset.id); return; }
  const o = e.target.closest('[data-open]');
  if (o) { openSheet(o.dataset.open); return; }
  const im = e.target.closest('[data-img]');
  if (im) { $('#lb img').src = im.dataset.img; $('#lb').hidden = false; return; }
  if (e.target.id === 'close' || e.target.id === 'scrim') { closeSheet(); return; }
  if (e.target.closest('#lb')) { $('#lb').hidden = true; return; }
  const t = e.target.closest('.tab');
  if (t) {
    filter = t.dataset.f;
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-pressed', b === t));
    render();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#lb').hidden) $('#lb').hidden = true; else if (!$('#scrim').hidden) closeSheet();
});
$('#q').addEventListener('input', render);
$('#todo').addEventListener('change', render);

fetch('data.json?t=' + Date.now())
  .then((r) => r.json())
  .then((d) => {
    ITEMS = d.items || [];
    $('#updated').textContent = d.updated ? `データ更新：${d.updated}` : '';
    render();
  })
  .catch(() => { $('#list').innerHTML = '<div class="empty">データを読み込めませんでした。通信を確認して開き直してください。</div>'; });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
