/* ============ VERİ KATMANI ============ */
const LS = {
  entries:'ra_entries_v1', chapters:'ra_chapters_v1', glossary:'ra_glossary_v1',
  journal:'ra_journal_v1', writingLog:'ra_writinglog_v1', settings:'ra_settings_v1'
};
function load(key, fallback){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
function save(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); return true; }catch(e){ toast('Kaydedilemedi: depolama dolu olabilir'); return false; } }

let entries = load(LS.entries, []);
let chapters = load(LS.chapters, []);
let glossary = load(LS.glossary, []);
let journal = load(LS.journal, []);
let writingLog = load(LS.writingLog, []); // [{date:'YYYY-MM-DD', words:n}]
let settings = load(LS.settings, {apiKey:'', textModel:'gemini-2.5-flash', theme:'acik', font:'Lora', dailyGoal:500, bookGoal:80000, anahat:''});

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function stripHtml(html){ const d=document.createElement('div'); d.innerHTML=html||''; return d.textContent||''; }
function countWords(text){ const t=(text||'').trim(); return t? t.split(/\s+/).length : 0; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ============ KATEGORİLER ============ */
const CATEGORIES = [
  {id:'karakter', label:'Karakter', icon:'👤', color:'#4A5D8A', hasFamily:true, fields:[
    {key:'rol', label:'Rol', type:'select', options:['Baş Karakter','Yan Karakter','Antagonist','Figüran']},
    {key:'yas', label:'Yaş', type:'text'},
    {key:'meslek', label:'Meslek', type:'text'},
    {key:'dogumyeri', label:'Doğum Yeri', type:'text'}
  ], bodyHint:'Fiziksel Özellikler, Kişilik, Geçmiş & Motivasyon...'},
  {id:'mekan', label:'Mekân', icon:'🏙️', color:'#2E7D6B', fields:[
    {key:'tur', label:'Tür', type:'select', options:['Şehir','Bina','Doğal Alan','Ülke/Bölge','Diğer']},
    {key:'onem', label:'Önem', type:'select', options:['Ana Mekân','Yan Mekân']},
    {key:'bolumler', label:'Geçtiği Bölümler', type:'text'}
  ], bodyHint:'Bu mekânı tasvir et...'},
  {id:'olay', label:'Olay', icon:'📜', color:'#8A4A3D', fields:[
    {key:'sira', label:'Sıra No (zaman çizelgesi sıralaması)', type:'number'},
    {key:'zaman', label:'Roman İçi Zaman', type:'text'},
    {key:'yer', label:'Yer', type:'text'},
    {key:'onem', label:'Önem', type:'select', options:['Ana Olay','Yan Olay']}
  ], bodyHint:'Olayı anlat...'},
  {id:'eser', label:'Eser', icon:'🎬', color:'#7A4A8A', fields:[
    {key:'tur', label:'Tür', type:'select', options:['Kitap','Şarkı','Sanat Eseri','Efsane','Diğer']},
    {key:'yaratici', label:'Yaratıcı', type:'text'}
  ], bodyHint:'Bu eser hakkında...'},
  {id:'kavram', label:'Kavram / Kural', icon:'🔬', color:'#2F5F8A', fields:[
    {key:'alan', label:'Alan', type:'select', options:['Büyü Sistemi','Teknoloji','Din/İnanç','Siyaset','Diğer']}
  ], bodyHint:'Bu kavramı / dünya kuralını açıkla...'},
  {id:'kurum', label:'Kurum', icon:'🏢', color:'#6B5B3A', fields:[
    {key:'tur', label:'Tür', type:'text'}, {key:'ulke', label:'Ülke/Bölge', type:'text'}
  ], bodyHint:'Kurum hakkında...'},
  {id:'yemek', label:'Yemek', icon:'🍽️', color:'#B5651D', fields:[{key:'koken', label:'Köken', type:'text'}], bodyHint:'Tarif / açıklama...'},
  {id:'hayvan', label:'Hayvan / Yaratık', icon:'🐾', color:'#5B7A3A', fields:[{key:'tur', label:'Tür', type:'text'}], bodyHint:'Açıklama...'},
  {id:'diger', label:'Diğer', icon:'📌', color:'#6B6B6B', fields:[], bodyHint:'Not...'}
];
function catById(id){ return CATEGORIES.find(c=>c.id===id) || CATEGORIES[CATEGORIES.length-1]; }

/* ============ NAVİGASYON ============ */
let currentScreen = 'bolumler';
let maddeReturnScreen = 'dunya';
function goScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const el = document.getElementById('screen-'+name);
  if(el) el.classList.add('active');
  currentScreen = name;
  document.querySelectorAll('.drawer button[data-screen]').forEach(b=>b.classList.toggle('active', b.dataset.screen===name));
  closeDrawer();
  const titles = {bolumler:'Bölümler', dunya:'Dünyam', iliski:'İlişki Haritası', akis:'Hikâye Akışı', sozluk:'Sözlük',
    gunluk:'Yazar Günlüğü', arama:'Arama', okuma:'Okuma Modu', istatistik:'İstatistikler', ai:'AI Asistan', ayarlar:'Ayarlar'};
  document.getElementById('masthead-title').textContent = titles[name] || 'Roman Atölyesi';
  if(name==='bolumler') renderBolumlerList();
  if(name==='dunya') renderDunyaList();
  if(name==='iliski') renderRelationshipGraph();
  if(name==='akis') refreshAkis();
  if(name==='sozluk') renderSozlukList();
  if(name==='gunluk') renderGunlukList();
  if(name==='okuma') renderOkuma();
  if(name==='istatistik') renderIstatistik();
  if(name==='ai') renderAiLog();
}
function toggleDrawer(){ document.getElementById('drawer').classList.toggle('open'); document.getElementById('drawer-overlay').classList.toggle('open'); }
function closeDrawer(){ document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('open'); }
document.getElementById('btn-menu').onclick = toggleDrawer;
document.getElementById('drawer-overlay').onclick = closeDrawer;
document.getElementById('btn-search-shortcut').onclick = ()=>goScreen('arama');
document.querySelectorAll('.drawer button[data-screen]').forEach(b=> b.onclick = ()=> goScreen(b.dataset.screen));

function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2200); }

/* ============ MODAL ============ */
function openModal(html){ document.getElementById('modal-body').innerHTML = html; document.getElementById('modal-overlay').classList.add('open'); }
function closeModal(){ document.getElementById('modal-overlay').classList.remove('open'); }
document.getElementById('modal-overlay').addEventListener('click', e=>{ if(e.target.id==='modal-overlay') closeModal(); });

/* ============ ZENGİN METİN EDİTÖRÜ ============ */
let savedRange = null, savedEditorEl = null;
function editorToolbarHtml(editorId){
  return `<div class="toolbar">
    <button type="button" onmousedown="event.preventDefault();fmt('bold')"><b>K</b></button>
    <button type="button" onmousedown="event.preventDefault();fmt('italic')"><i>İ</i></button>
    <button type="button" onmousedown="event.preventDefault();fmt('underline')"><u>A</u></button>
    <button type="button" onmousedown="event.preventDefault();fmt('formatBlock','H3')">H3</button>
    <button type="button" onmousedown="event.preventDefault();fmt('formatBlock','P')">P</button>
    <button type="button" onmousedown="event.preventDefault();insertImageInto('${editorId}')">🖼️</button>
    <button type="button" onmousedown="event.preventDefault();openLinkPicker('${editorId}')">🔗</button>
  </div>`;
}
function registerEditor(editorId){
  const el = document.getElementById(editorId);
  if(!el) return;
  el.addEventListener('mouseup', ()=>captureRange(editorId));
  el.addEventListener('keyup', ()=>captureRange(editorId));
  el.addEventListener('focus', ()=>captureRange(editorId));
}
function captureRange(editorId){
  const sel = window.getSelection();
  if(sel.rangeCount>0){ const r = sel.getRangeAt(0); if(document.getElementById(editorId).contains(r.commonAncestorContainer)){ savedRange = r.cloneRange(); savedEditorEl = editorId; } }
}
function fmt(cmd, val){
  const el = document.getElementById(savedEditorEl);
  if(!el) return;
  el.focus();
  if(savedRange){ const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
  document.execCommand(cmd, false, val || null);
}
function insertImageInto(editorId){
  const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange = ()=>{
    const f = inp.files[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const el = document.getElementById(editorId); el.focus();
      if(savedRange && savedEditorEl===editorId){ const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
      document.execCommand('insertHTML', false, `<img src="${reader.result}">`);
    };
    reader.readAsDataURL(f);
  };
  inp.click();
}
function openLinkPicker(editorId){
  captureRange(editorId);
  let items = '';
  entries.forEach(e=> items += `<div class="list-item" style="cursor:pointer" onclick="insertWikiLink('${editorId}','entry','${e.id}','${escapeHtml(e.title).replace(/'/g,"\\'")}')"><span>${catById(e.cat).icon} ${escapeHtml(e.title)}</span><span class="muted">${catById(e.cat).label}</span></div>`);
  chapters.forEach(c=> items += `<div class="list-item" style="cursor:pointer" onclick="insertWikiLink('${editorId}','chapter','${c.id}','${escapeHtml(c.title||'Adsız Bölüm').replace(/'/g,"\\'")}')"><span>📖 ${escapeHtml(c.title||'Adsız Bölüm')}</span><span class="muted">Bölüm</span></div>`);
  if(!items) items = '<p class="muted">Henüz bağlanabilecek madde veya bölüm yok.</p>';
  openModal(`<button class="modal-close" onclick="closeModal()">✕</button><h3>Bağlantı Ekle</h3>${items}`);
}
function insertWikiLink(editorId, type, id, label){
  closeModal();
  const el = document.getElementById(editorId); el.focus();
  if(savedRange && savedEditorEl===editorId){ const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
  document.execCommand('insertHTML', false, `<a class="wikilink" data-type="${type}" data-id="${id}" contenteditable="false">${escapeHtml(label)}</a>&nbsp;`);
}
function wireWikiNav(containerEl){
  containerEl.querySelectorAll('a.wikilink').forEach(a=>{
    a.style.cursor='pointer';
    a.onclick = (ev)=>{ ev.preventDefault();
      const type=a.dataset.type, id=a.dataset.id;
      if(type==='entry'){ maddeReturnScreen = currentScreen; openMadde(id); }
      else if(type==='chapter'){ openChapter(id); goScreen('bolum-detay'); }
    };
  });
}

/* ============ BÖLÜMLER ============ */
function chapterWordCount(ch){ return (ch.scenes||[]).reduce((s,sc)=>s+countWords(stripHtml(sc.body)),0); }
function totalWordCount(){ return chapters.reduce((s,c)=>s+chapterWordCount(c),0); }
function logWritingToday(delta){
  if(!delta) return;
  let today = writingLog.find(w=>w.date===todayStr());
  if(!today){ today = {date:todayStr(), words:0}; writingLog.push(today); }
  today.words += delta; if(today.words<0) today.words=0;
  if(writingLog.length>120) writingLog = writingLog.slice(-120);
  save(LS.writingLog, writingLog);
}
function computeStreak(){
  let streak=0; let d=new Date();
  while(true){
    const ds=d.toISOString().slice(0,10);
    const rec = writingLog.find(w=>w.date===ds);
    if(rec && rec.words>0){ streak++; d.setDate(d.getDate()-1); } else break;
  }
  return streak;
}
function renderBolumlerList(){
  document.getElementById('bl-toplam-kelime').textContent = totalWordCount();
  document.getElementById('bl-streak').textContent = computeStreak()+' gün';
  const list = chapters.slice().sort((a,b)=>a.order-b.order);
  const el = document.getElementById('bolumler-list');
  if(!list.length){ el.innerHTML = '<div class="empty-state"><div class="big">📖</div>Henüz bölüm yok</div>'; }
  else {
    el.innerHTML = list.map((c,i)=>`
      <div class="card" onclick="openChapter('${c.id}')">
        <div class="card-row"><h3>${i+1}. ${escapeHtml(c.title||'Adsız Bölüm')}</h3><span class="muted">${chapterWordCount(c)} kelime</span></div>
        <div class="muted">${escapeHtml(c.summary||'')}</div>
        <div class="chips">${(c.tags||[]).map(t=>`<span class="chip tag-chip">#${escapeHtml(t)}</span>`).join('')}</div>
      </div>`).join('');
  }
  el.insertAdjacentHTML('beforeend', `<button class="btn block" style="margin-top:6px" onclick="openChapter(null)">+ Yeni Bölüm</button>`);
}
let editingChapterId = null;
function openChapter(id){
  editingChapterId = id;
  const ch = id ? chapters.find(c=>c.id===id) : {id:null, title:'', summary:'', transition:'', tags:[], mood:5, wordGoal:0, scenes:[], order:chapters.length};
  document.getElementById('bd-baslik').value = ch.title||'';
  document.getElementById('bd-ozet').value = ch.summary||'';
  document.getElementById('bd-gecis').value = ch.transition||'';
  document.getElementById('bd-etiket').value = (ch.tags||[]).join(', ');
  document.getElementById('bd-mood').value = ch.mood||5;
  document.getElementById('bd-hedef').value = ch.wordGoal||'';
  document.getElementById('bd-sil').style.display = id ? 'inline-block':'none';
  window._draftScenes = JSON.parse(JSON.stringify(ch.scenes||[]));
  renderScenes();
  goScreen('bolum-detay');
}
function renderScenes(){
  const wrap = document.getElementById('bd-sahneler');
  wrap.innerHTML = (window._draftScenes||[]).map((sc,i)=>`
    <div class="card">
      <div class="card-row"><input type="text" style="border:none;background:transparent;font-weight:600;font-family:var(--font-editor);width:80%" value="${escapeHtml(sc.title||'')}" placeholder="Sahne ${i+1}" oninput="window._draftScenes[${i}].title=this.value">
      <button class="icon-btn" style="color:var(--danger)" onclick="removeScene(${i})">✕</button></div>
      ${editorToolbarHtml('scene-ed-'+i)}
      <div class="editor" id="scene-ed-${i}" contenteditable="true" oninput="window._draftScenes[${i}].body=this.innerHTML">${sc.body||''}</div>
    </div>`).join('');
  (window._draftScenes||[]).forEach((sc,i)=>registerEditor('scene-ed-'+i));
  let wc = (window._draftScenes||[]).reduce((s,sc)=>s+countWords(stripHtml(sc.body)),0);
  document.getElementById('bd-kelime-sayisi').textContent = '· '+wc+' kelime';
}
function addScene(){ window._draftScenes = window._draftScenes||[]; window._draftScenes.push({id:uid(), title:'', body:''}); renderScenes(); }
function removeScene(i){ window._draftScenes.splice(i,1); renderScenes(); }
function saveChapter(){
  const oldWords = editingChapterId ? chapterWordCount(chapters.find(c=>c.id===editingChapterId)) : 0;
  const data = {
    id: editingChapterId || uid(),
    title: document.getElementById('bd-baslik').value.trim(),
    summary: document.getElementById('bd-ozet').value.trim(),
    transition: document.getElementById('bd-gecis').value.trim(),
    tags: document.getElementById('bd-etiket').value.split(',').map(s=>s.trim()).filter(Boolean),
    mood: Number(document.getElementById('bd-mood').value),
    wordGoal: Number(document.getElementById('bd-hedef').value)||0,
    scenes: window._draftScenes||[],
    order: editingChapterId ? chapters.find(c=>c.id===editingChapterId).order : chapters.length,
    createdAt: editingChapterId ? chapters.find(c=>c.id===editingChapterId).createdAt : Date.now(),
    updatedAt: Date.now()
  };
  if(!data.title){ toast('Başlık gerekli'); return; }
  if(editingChapterId){ chapters = chapters.map(c=>c.id===editingChapterId?data:c); }
  else { chapters.push(data); }
  save(LS.chapters, chapters);
  const newWords = chapterWordCount(data);
  logWritingToday(newWords - oldWords);
  toast('Bölüm kaydedildi'); goScreen('bolumler');
}
function deleteChapter(){
  if(!editingChapterId) return;
  if(!confirm('Bu bölümü silmek istediğine emin misin?')) return;
  chapters = chapters.filter(c=>c.id!==editingChapterId);
  chapters.forEach((c,i)=>c.order=i);
  save(LS.chapters, chapters); toast('Bölüm silindi'); goScreen('bolumler');
}

/* ============ DÜNYA / ANSİKLOPEDİ ============ */
let dunyaKategoriFilter = 'hepsi';
function renderKategoriChips(){
  let html = `<button class="chip ${dunyaKategoriFilter==='hepsi'?'active':''}" onclick="setDunyaFilter('hepsi')">Hepsi</button>`;
  CATEGORIES.forEach(c=> html += `<button class="chip ${dunyaKategoriFilter===c.id?'active':''}" onclick="setDunyaFilter('${c.id}')">${c.icon} ${c.label}</button>`);
  document.getElementById('dunya-kategori-chips').innerHTML = html;
}
function setDunyaFilter(id){ dunyaKategoriFilter=id; renderKategoriChips(); renderDunyaList(); }
function renderDunyaList(){
  renderKategoriChips();
  const q = (document.getElementById('dunya-filter').value||'').toLowerCase();
  let list = entries.filter(e=> (dunyaKategoriFilter==='hepsi'||e.cat===dunyaKategoriFilter) &&
    (!q || e.title.toLowerCase().includes(q) || (e.tags||[]).some(t=>t.toLowerCase().includes(q))));
  const el = document.getElementById('dunya-list');
  if(!list.length){ el.innerHTML = '<div class="empty-state"><div class="big">🌍</div>Henüz madde yok</div>'; }
  else {
    el.innerHTML = list.map(e=>{
      const c = catById(e.cat);
      return `<div class="card" onclick="maddeReturnScreen='dunya';openMadde('${e.id}')">
        <div class="card-row"><h3>${c.icon} ${escapeHtml(e.title)}</h3><span class="chip" style="background:${c.color};color:#fff;border:none">${c.label}</span></div>
        <div class="chips">${(e.tags||[]).map(t=>`<span class="chip tag-chip">#${escapeHtml(t)}</span>`).join('')}</div>
      </div>`;
    }).join('');
  }
  el.insertAdjacentHTML('beforeend', `<button class="btn block" style="margin-top:6px" onclick="goScreen('dunya-kategori')">+ Yeni Madde</button>`);
}
function renderKategoriSecim(){
  document.getElementById('kategori-secim-list').innerHTML = CATEGORIES.map(c=>
    `<div class="list-item" style="cursor:pointer" onclick="newEntryDraft('${c.id}')"><span>${c.icon} ${c.label}</span><span>›</span></div>`).join('');
}
function newEntryDraft(catId){
  const draft = {id:null, cat:catId, title:'', tags:[], cover:null, fields:{}, body:'', family:{spouseId:null,childrenIds:[],siblingIds:[]}, relatedIds:[]};
  editingEntryId = null;
  maddeReturnScreen = 'dunya'; window._maddeDraft = draft; window._maddeMode='edit';
  goScreen('madde'); renderMadde();
}
let editingEntryId = null;
function openMadde(id){ editingEntryId=id; window._maddeMode='view'; goScreen('madde'); renderMadde(); }
function madeeGeriDon(){ goScreen(maddeReturnScreen||'dunya'); }
function renderMadde(){
  const isDraft = !!window._maddeDraft && window._maddeMode==='edit' && !editingEntryId;
  const entry = isDraft ? window._maddeDraft : entries.find(e=>e.id===editingEntryId);
  if(!entry){ document.getElementById('madde-icerik').innerHTML='<p class="muted">Madde bulunamadı.</p>'; return; }
  const cat = catById(entry.cat);
  if(window._maddeMode==='view'){
    document.getElementById('madde-icerik').innerHTML = `
      ${entry.cover?`<div class="cover-wrap"><img src="${entry.cover}"></div>`:''}
      <div class="card-row"><h2 class="screen-title" style="margin:0">${cat.icon} ${escapeHtml(entry.title)}</h2></div>
      <span class="chip" style="background:${cat.color};color:#fff;border:none">${cat.label}</span>
      <div class="chips">${(entry.tags||[]).map(t=>`<span class="chip tag-chip">#${escapeHtml(t)}</span>`).join('')}</div>
      <div class="infobox">${cat.fields.map(f=> entry.fields[f.key] ? `<div class="irow"><b>${f.label}</b><span>${escapeHtml(entry.fields[f.key])}</span></div>`:'').join('')}</div>
      ${renderFamilyView(entry, cat)}
      <div class="editor" style="border:none;padding:0" id="madde-body-view">${entry.body||''}</div>
      ${renderRelatedView(entry)}
      <div class="btn-row">
        <button class="btn primary" onclick="editingEntryId='${entry.id}';window._maddeMode='edit';window._maddeDraft=null;renderMadde()">Düzenle</button>
        <button class="btn danger" onclick="deleteMadde('${entry.id}')">Sil</button>
      </div>`;
    wireWikiNav(document.getElementById('madde-body-view'));
  } else {
    document.getElementById('madde-icerik').innerHTML = `
      <div class="cover-wrap" id="cover-wrap">${entry.cover?`<img src="${entry.cover}">`:'<span class="ph">Kapak görseli yok</span>'}
        <div class="cover-actions"><button onclick="pickCover()">📷 Görsel Seç</button></div></div>
      <div class="field"><label>Ad</label><input type="text" id="md-title" value="${escapeHtml(entry.title)}"></div>
      ${cat.fields.map(f=>renderFieldInput(f, entry.fields[f.key])).join('')}
      <div class="field"><label>Etiketler (virgülle ayır)</label><input type="text" id="md-tags" value="${(entry.tags||[]).join(', ')}"></div>
      ${cat.hasFamily ? renderFamilyEdit(entry) : ''}
      <div class="field"><label>İçerik</label>${editorToolbarHtml('md-body')}
        <div class="editor" id="md-body" contenteditable="true" data-placeholder="${cat.bodyHint||''}">${entry.body||''}</div></div>
      ${renderRelatedEdit(entry)}
      <div class="btn-row">
        <button class="btn primary" onclick="saveMadde('${entry.cat}')">Kaydet</button>
        <button class="btn" onclick="madeeGeriDon()">Vazgeç</button>
      </div>`;
    registerEditor('md-body');
    window._coverTemp = entry.cover;
    window._familyTemp = JSON.parse(JSON.stringify(entry.family||{spouseId:null,childrenIds:[],siblingIds:[]}));
    window._relatedTemp = (entry.relatedIds||[]).slice();
  }
}
function renderFieldInput(f, val){
  val = val || '';
  if(f.type==='select'){
    return `<div class="field"><label>${f.label}</label><select id="md-f-${f.key}"><option value="">—</option>${f.options.map(o=>`<option ${o===val?'selected':''}>${o}</option>`).join('')}</select></div>`;
  }
  return `<div class="field"><label>${f.label}</label><input type="${f.type==='number'?'number':'text'}" id="md-f-${f.key}" value="${escapeHtml(val)}"></div>`;
}
function pickCover(){
  const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange = ()=>{ const f=inp.files[0]; if(!f) return; const r=new FileReader();
    r.onload=()=>{ window._coverTemp = r.result; document.getElementById('cover-wrap').innerHTML = `<img src="${r.result}"><div class="cover-actions"><button onclick="pickCover()">📷 Görsel Seç</button></div>`; };
    r.readAsDataURL(f); };
  inp.click();
}
function renderFamilyEdit(entry){
  const opts = entries.filter(e=>e.cat==='karakter' && e.id && e.id!==entry.id);
  const optHtml = (selected)=> `<option value="">—</option>` + opts.map(o=>`<option value="${o.id}" ${selected===o.id?'selected':''}>${escapeHtml(o.title)}</option>`).join('');
  const fam = entry.family||{spouseId:null,childrenIds:[],siblingIds:[]};
  return `<div class="field"><label>Eş</label><select id="fam-spouse">${optHtml(fam.spouseId)}</select></div>
    <div class="field"><label>Çocuklar (birden fazla seçebilirsin)</label>
      <select id="fam-children" multiple size="4">${opts.map(o=>`<option value="${o.id}" ${(fam.childrenIds||[]).includes(o.id)?'selected':''}>${escapeHtml(o.title)}</option>`).join('')}</select></div>
    <div class="field"><label>Kardeşler</label>
      <select id="fam-siblings" multiple size="4">${opts.map(o=>`<option value="${o.id}" ${(fam.siblingIds||[]).includes(o.id)?'selected':''}>${escapeHtml(o.title)}</option>`).join('')}</select></div>`;
}
function renderFamilyView(entry, cat){
  if(!cat.hasFamily) return '';
  const fam = entry.family||{}; let rows='';
  const nm = id => { const e=entries.find(x=>x.id===id); return e?e.title:''; };
  if(fam.spouseId) rows += `<div class="irow"><b>Eş</b><span>${escapeHtml(nm(fam.spouseId))}</span></div>`;
  if((fam.childrenIds||[]).length) rows += `<div class="irow"><b>Çocuklar</b><span>${fam.childrenIds.map(nm).map(escapeHtml).join(', ')}</span></div>`;
  if((fam.siblingIds||[]).length) rows += `<div class="irow"><b>Kardeşler</b><span>${fam.siblingIds.map(nm).map(escapeHtml).join(', ')}</span></div>`;
  return rows ? `<div class="infobox">${rows}</div>` : '';
}
function renderRelatedEdit(entry){
  const others = entries.filter(e=>e.id && e.id!==entry.id);
  return `<div class="field"><label>İlgili Maddeler</label>
    <select id="related-sel" multiple size="5">${others.map(o=>`<option value="${o.id}" ${(entry.relatedIds||[]).includes(o.id)?'selected':''}>${catById(o.cat).icon} ${escapeHtml(o.title)}</option>`).join('')}</select></div>`;
}
function renderRelatedView(entry){
  const ids = entry.relatedIds||[]; if(!ids.length) return '';
  return `<h3 style="font-family:var(--font-editor);color:var(--navy);margin-top:16px;">İlgili Maddeler</h3>
    <div class="chips">${ids.map(id=>{ const e=entries.find(x=>x.id===id); return e?`<span class="chip" style="cursor:pointer" onclick="maddeReturnScreen='dunya';openMadde('${e.id}')">${catById(e.cat).icon} ${escapeHtml(e.title)}</span>`:''; }).join('')}</div>`;
}
function saveMadde(catId){
  const cat = catById(catId);
  const title = document.getElementById('md-title').value.trim();
  if(!title){ toast('Ad gerekli'); return; }
  const fields = {};
  cat.fields.forEach(f=>{ const el=document.getElementById('md-f-'+f.key); if(el) fields[f.key]=el.value.trim(); });
  const isNew = !editingEntryId;
  const family = cat.hasFamily ? {
    spouseId: document.getElementById('fam-spouse').value || null,
    childrenIds: Array.from(document.getElementById('fam-children').selectedOptions).map(o=>o.value),
    siblingIds: Array.from(document.getElementById('fam-siblings').selectedOptions).map(o=>o.value)
  } : {spouseId:null,childrenIds:[],siblingIds:[]};
  const relatedIds = Array.from(document.getElementById('related-sel').selectedOptions).map(o=>o.value);
  const data = {
    id: editingEntryId || uid(), cat: catId, title,
    tags: document.getElementById('md-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
    cover: window._coverTemp || null,
    fields, body: document.getElementById('md-body').innerHTML,
    family, relatedIds,
    createdAt: isNew ? Date.now() : (entries.find(e=>e.id===editingEntryId)||{}).createdAt || Date.now(),
    updatedAt: Date.now()
  };
  if(isNew){ entries.push(data); editingEntryId = data.id; } else { entries = entries.map(e=>e.id===editingEntryId?data:e); }
  save(LS.entries, entries); window._maddeDraft=null; window._maddeMode='view';
  toast('Madde kaydedildi'); renderMadde();
}
function deleteMadde(id){
  if(!confirm('Bu maddeyi silmek istediğine emin misin?')) return;
  entries = entries.filter(e=>e.id!==id);
  entries.forEach(e=>{ e.relatedIds=(e.relatedIds||[]).filter(r=>r!==id);
    if(e.family){ if(e.family.spouseId===id) e.family.spouseId=null;
      e.family.childrenIds=(e.family.childrenIds||[]).filter(x=>x!==id);
      e.family.siblingIds=(e.family.siblingIds||[]).filter(x=>x!==id); } });
  save(LS.entries, entries); toast('Madde silindi'); madeeGeriDon();
}

/* ============ İLİŞKİ HARİTASI ============ */
function renderRelationshipGraph(){
  const chars = entries.filter(e=>e.cat==='karakter');
  const svg = document.getElementById('iliski-svg');
  if(chars.length<2){ svg.innerHTML = `<text x="20" y="40" fill="var(--ink-soft)" font-size="13">Haritayı görmek için en az 2 karakter ve aralarında bir ilişki ekle.</text>`; return; }
  const cx=170, cy=170, r=125; const n=chars.length;
  const pos = {};
  chars.forEach((c,i)=>{ const a = (i/n)*2*Math.PI - Math.PI/2; pos[c.id] = {x:cx+r*Math.cos(a), y:cy+r*Math.sin(a)}; });
  let lines=''; const seen=new Set();
  chars.forEach(c=>{
    const fam=c.family||{};
    const linkTo=(otherId,label,color)=>{
      if(!otherId || !pos[otherId]) return;
      const key=[c.id,otherId].sort().join('-')+label;
      if(seen.has(key)) return; seen.add(key);
      lines += `<line x1="${pos[c.id].x}" y1="${pos[c.id].y}" x2="${pos[otherId].x}" y2="${pos[otherId].y}" stroke="${color}" stroke-width="1.6" opacity="0.75"/>`;
    };
    linkTo(fam.spouseId,'sp','#b8863f');
    (fam.childrenIds||[]).forEach(id=>linkTo(id,'ch','#4A5D8A'));
    (fam.siblingIds||[]).forEach(id=>linkTo(id,'si','#2E7D6B'));
    (c.relatedIds||[]).forEach(id=>{ if(pos[id]) linkTo(id,'re','#999'); });
  });
  let nodes = chars.map(c=>`
    <g style="cursor:pointer" onclick="maddeReturnScreen='iliski';openMadde('${c.id}')">
      <circle cx="${pos[c.id].x}" cy="${pos[c.id].y}" r="16" fill="var(--navy)" stroke="#fff" stroke-width="2"/>
      <text x="${pos[c.id].x}" y="${pos[c.id].y+4}" font-size="13" text-anchor="middle" fill="#fff">${escapeHtml(c.title[0]||'?')}</text>
      <text x="${pos[c.id].x}" y="${pos[c.id].y+30}" font-size="10" text-anchor="middle" fill="var(--ink)">${escapeHtml(c.title.split(' ')[0])}</text>
    </g>`).join('');
  svg.innerHTML = lines + nodes;
}

/* ============ HİKÂYE AKIŞI ============ */
function switchAkis(which){
  document.querySelectorAll('.sub-tabs [data-akis]').forEach(b=>b.classList.toggle('active', b.dataset.akis===which));
  ['anahat','zaman','duygu'].forEach(k=> document.getElementById('akis-'+k).classList.toggle('hidden', k!==which));
  if(which==='zaman') renderZamanCizelgesi();
  if(which==='duygu') renderDuyguGrafik();
}
function refreshAkis(){ document.getElementById('anahat-metin').value = settings.anahat||''; switchAkis('anahat'); }
function saveAnahat(){ settings.anahat = document.getElementById('anahat-metin').value; save(LS.settings, settings); toast('Ana hat kaydedildi'); }
function renderZamanCizelgesi(){
  const olaylar = entries.filter(e=>e.cat==='olay').sort((a,b)=> (Number(a.fields.sira)||9999)-(Number(b.fields.sira)||9999));
  const el = document.getElementById('akis-zaman');
  if(!olaylar.length){ el.innerHTML = '<div class="empty-state"><div class="big">📜</div>Henüz olay maddesi eklenmedi. Dünyam ekranından "Olay" kategorisiyle ekleyebilirsin.</div>'; return; }
  el.innerHTML = olaylar.map(o=>`
    <div class="card" onclick="maddeReturnScreen='akis';openMadde('${o.id}')">
      <div class="card-row"><h3>${o.fields.sira?('#'+o.fields.sira+' · '):''}${escapeHtml(o.title)}</h3><span class="chip">${escapeHtml(o.fields.onem||'')}</span></div>
      <div class="muted">${escapeHtml(o.fields.zaman||'')} ${o.fields.yer?'· '+escapeHtml(o.fields.yer):''}</div>
    </div>`).join('');
}
function renderDuyguGrafik(){
  const list = chapters.slice().sort((a,b)=>a.order-b.order);
  const svg = document.getElementById('duygu-svg');
  if(!list.length){ svg.innerHTML = `<text x="10" y="30" fill="var(--ink-soft)" font-size="12">Henüz bölüm yok.</text>`; return; }
  const w=320,h=160,pad=22; const step = (w-2*pad)/Math.max(list.length-1,1);
  let pts = list.map((c,i)=> [pad+i*step, h-pad-((c.mood||5)/10)*(h-2*pad)]);
  let path = pts.map((p,i)=> (i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  let dots = pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--gold)"/><text x="${p[0]}" y="${h-6}" font-size="8" text-anchor="middle" fill="var(--ink-soft)">${i+1}</text>`).join('');
  svg.innerHTML = `<line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="var(--line)"/><path d="${path}" fill="none" stroke="var(--navy2)" stroke-width="2"/>${dots}`;
}

/* ============ SÖZLÜK ============ */
function addTerim(){
  const t=document.getElementById('soz-terim').value.trim(), d=document.getElementById('soz-tanim').value.trim();
  if(!t) return toast('Terim gerekli');
  glossary.push({id:uid(), term:t, def:d}); save(LS.glossary, glossary);
  document.getElementById('soz-terim').value=''; document.getElementById('soz-tanim').value='';
  renderSozlukList();
}
function deleteTerim(id){ glossary=glossary.filter(g=>g.id!==id); save(LS.glossary, glossary); renderSozlukList(); }
function renderSozlukList(){
  const el = document.getElementById('sozluk-list');
  if(!glossary.length){ el.innerHTML = '<div class="empty-state"><div class="big">📕</div>Henüz terim yok</div>'; return; }
  el.innerHTML = glossary.slice().sort((a,b)=>a.term.localeCompare(b.term,'tr')).map(g=>`
    <div class="card"><div class="card-row"><h3>${escapeHtml(g.term)}</h3><button class="icon-btn" style="color:var(--danger)" onclick="deleteTerim('${g.id}')">✕</button></div>
    <div class="muted">${escapeHtml(g.def)}</div></div>`).join('');
}

/* ============ YAZAR GÜNLÜĞÜ ============ */
function addGunluk(){
  const t=document.getElementById('gunluk-metin').value.trim(); if(!t) return;
  journal.unshift({id:uid(), date:new Date().toISOString(), text:t}); save(LS.journal, journal);
  document.getElementById('gunluk-metin').value=''; renderGunlukList();
}
function deleteGunluk(id){ journal=journal.filter(j=>j.id!==id); save(LS.journal, journal); renderGunlukList(); }
function renderGunlukList(){
  const el = document.getElementById('gunluk-list');
  if(!journal.length){ el.innerHTML = '<div class="empty-state"><div class="big">📝</div>Henüz not yok</div>'; return; }
  el.innerHTML = journal.map(j=>`
    <div class="card"><div class="card-row"><span class="muted">${new Date(j.date).toLocaleDateString('tr-TR')}</span><button class="icon-btn" style="color:var(--danger)" onclick="deleteGunluk('${j.id}')">✕</button></div>
    <div>${escapeHtml(j.text)}</div></div>`).join('');
}

/* ============ ARAMA ============ */
function doSearch(){
  const q = document.getElementById('arama-input').value.trim().toLowerCase();
  const el = document.getElementById('arama-sonuc');
  if(!q){ el.innerHTML=''; return; }
  let out='';
  const chMatch = chapters.filter(c=> (c.title||'').toLowerCase().includes(q) || (c.summary||'').toLowerCase().includes(q) || (c.scenes||[]).some(s=>stripHtml(s.body).toLowerCase().includes(q)));
  const enMatch = entries.filter(e=> e.title.toLowerCase().includes(q) || stripHtml(e.body).toLowerCase().includes(q) || (e.tags||[]).some(t=>t.toLowerCase().includes(q)));
  const goMatch = glossary.filter(g=> g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q));
  const juMatch = journal.filter(j=> j.text.toLowerCase().includes(q));
  if(chMatch.length) out += `<h3 style="color:var(--navy)">📖 Bölümler</h3>` + chMatch.map(c=>`<div class="list-item" style="cursor:pointer" onclick="openChapter('${c.id}');goScreen('bolum-detay')">${escapeHtml(c.title||'Adsız')}</div>`).join('');
  if(enMatch.length) out += `<h3 style="color:var(--navy)">🌍 Dünya Maddeleri</h3>` + enMatch.map(e=>`<div class="list-item" style="cursor:pointer" onclick="maddeReturnScreen='arama';openMadde('${e.id}')">${catById(e.cat).icon} ${escapeHtml(e.title)}</div>`).join('');
  if(goMatch.length) out += `<h3 style="color:var(--navy)">📕 Sözlük</h3>` + goMatch.map(g=>`<div class="list-item">${escapeHtml(g.term)} — <span class="muted">${escapeHtml(g.def)}</span></div>`).join('');
  if(juMatch.length) out += `<h3 style="color:var(--navy)">📝 Günlük</h3>` + juMatch.map(j=>`<div class="list-item">${escapeHtml(j.text.slice(0,80))}</div>`).join('');
  el.innerHTML = out || '<p class="muted">Sonuç bulunamadı.</p>';
}

/* ============ OKUMA MODU ============ */
function renderOkuma(){
  const list = chapters.slice().sort((a,b)=>a.order-b.order);
  const el = document.getElementById('okuma-icerik');
  if(!list.length){ el.innerHTML = '<div class="empty-state">Henüz bölüm yok.</div>'; return; }
  el.innerHTML = list.map((c,i)=>`<h2>${i+1}. ${escapeHtml(c.title||'')}</h2>` + (c.scenes||[]).map(s=>`${s.title?`<div class="scene-title">${escapeHtml(s.title)}</div>`:''}<div>${s.body||''}</div>`).join('')).join('<hr style="border:none;border-top:1px solid var(--line);margin:26px 0;">');
  wireWikiNav(el);
}
function exportWord(){
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset="utf-8"><title>Roman</title></head><body>${document.getElementById('okuma-icerik').innerHTML}</body></html>`;
  const blob = new Blob(['\ufeff', html], {type:'application/msword'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'roman.doc'; a.click();
}

/* ============ İSTATİSTİKLER ============ */
function renderIstatistik(){
  const total = totalWordCount();
  document.getElementById('istat-grid').innerHTML = `
    <div class="stat-box"><div class="n">${total}</div><div class="l">toplam kelime</div></div>
    <div class="stat-box"><div class="n">${computeStreak()}</div><div class="l">gün seri</div></div>
    <div class="stat-box"><div class="n">${chapters.length}</div><div class="l">bölüm</div></div>
    <div class="stat-box"><div class="n">${settings.bookGoal?Math.min(100,Math.round(total/settings.bookGoal*100)):0}%</div><div class="l">kitap hedefi</div></div>`;
  document.getElementById('ayar-gunluk-hedef').value = settings.dailyGoal||'';
  document.getElementById('ayar-kitap-hedef').value = settings.bookGoal||'';
  const days = []; for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); days.push(d.toISOString().slice(0,10)); }
  const vals = days.map(d=> (writingLog.find(w=>w.date===d)||{words:0}).words);
  const maxV = Math.max(...vals, settings.dailyGoal||1, 1);
  const svg = document.getElementById('istat-svg'); const w=320,h=140,pad=20, bw=(w-2*pad)/7-8;
  let bars = vals.map((v,i)=>{ const x=pad+i*((w-2*pad)/7); const bh=(v/maxV)*(h-2*pad); return `<rect x="${x}" y="${h-pad-bh}" width="${bw}" height="${bh}" rx="3" fill="var(--navy2)"/><text x="${x+bw/2}" y="${h-6}" font-size="8" text-anchor="middle" fill="var(--ink-soft)">${days[i].slice(5)}</text>`; }).join('');
  svg.innerHTML = `<line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="var(--line)"/>` + bars;
}
function saveGoals(){
  settings.dailyGoal = Number(document.getElementById('ayar-gunluk-hedef').value)||0;
  settings.bookGoal = Number(document.getElementById('ayar-kitap-hedef').value)||0;
  save(LS.settings, settings); toast('Hedefler kaydedildi'); renderIstatistik();
}

/* ============ AI ASİSTAN ============ */
let aiLog = [];
function renderAiLog(){
  document.getElementById('ai-log').innerHTML = aiLog.map(m=>`<div class="msg ${m.role}">${escapeHtml(m.text)}</div>`).join('');
}
function buildNovelContext(){
  let ctx = 'ROMAN BAĞLAMI\n\nAna Hat:\n'+(settings.anahat||'(henüz yazılmadı)')+'\n\nBölüm Özetleri:\n';
  chapters.slice().sort((a,b)=>a.order-b.order).forEach((c,i)=>{ ctx += `${i+1}. ${c.title}: ${c.summary||'(özet yok)'}\n`; });
  ctx += '\nKarakterler:\n';
  entries.filter(e=>e.cat==='karakter').forEach(e=>{ ctx += `- ${e.title} (${e.fields.rol||''}): ${stripHtml(e.body).slice(0,220)}\n`; });
  ctx += '\nMekânlar:\n';
  entries.filter(e=>e.cat==='mekan').forEach(e=>{ ctx += `- ${e.title}: ${stripHtml(e.body).slice(0,150)}\n`; });
  return ctx;
}
async function callGemini(prompt){
  if(!settings.apiKey){ toast('Önce Ayarlar\'dan Gemini API anahtarını gir'); goScreen('ayarlar'); return null; }
  const model = settings.textModel || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey}`;
  try{
    const res = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
    const data = await res.json();
    if(data.error) return 'Hata: '+data.error.message;
    return data.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') || 'Yanıt alınamadı.';
  }catch(e){ return 'Bağlantı hatası: '+e.message; }
}
async function aiPreset(type){
  const prompts = {
    tutarlilik: 'Aşağıdaki roman bağlamını incele ve karakter/mekân/olay tutarsızlıklarını madde madde belirt:\n\n'+buildNovelContext(),
    ozet: 'Aşağıdaki roman bağlamına göre romanı 4-5 cümlede özetle:\n\n'+buildNovelContext(),
    oneri: 'Aşağıdaki roman bağlamına göre bir sonraki bölümde neler olabileceğine dair 3 öneri sun:\n\n'+buildNovelContext()
  };
  aiLog.push({role:'user', text: {tutarlilik:'Tutarlılık kontrolü', ozet:'Romanı özetle', oneri:'Sıradaki bölüm önerisi'}[type]});
  renderAiLog();
  const resp = await callGemini(prompts[type]);
  if(resp){ aiLog.push({role:'ai', text: resp}); renderAiLog(); }
}
async function aiSend(){
  const q = document.getElementById('ai-input').value.trim(); if(!q) return;
  aiLog.push({role:'user', text:q}); document.getElementById('ai-input').value=''; renderAiLog();
  const resp = await callGemini(buildNovelContext()+'\n\nSORU: '+q);
  if(resp){ aiLog.push({role:'ai', text:resp}); renderAiLog(); }
}

/* ============ AYARLAR ============ */
function saveApiSettings(){
  settings.apiKey = document.getElementById('ayar-api-key').value.trim();
  settings.textModel = document.getElementById('ayar-text-model').value.trim() || 'gemini-2.5-flash';
  save(LS.settings, settings); toast('Ayarlar kaydedildi');
}
function setTheme(t){ settings.theme=t; document.documentElement.setAttribute('data-theme', t==='acik'?'':t); save(LS.settings, settings); }
function setEditorFont(f){ settings.font=f; document.documentElement.style.setProperty('--font-editor', `'${f}',serif`); save(LS.settings, settings); }
function exportBackup(){
  const backup = {entries, chapters, glossary, journal, writingLog, settings, exportedAt: new Date().toISOString()};
  const blob = new Blob([JSON.stringify(backup,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'roman-atolyesi-yedek.json'; a.click();
}
function importBackup(ev){
  const f = ev.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{
      const d = JSON.parse(r.result);
      if(!confirm('Mevcut tüm veri bu yedekle değiştirilecek. Emin misin?')) return;
      entries = d.entries||[]; chapters = d.chapters||[]; glossary = d.glossary||[]; journal = d.journal||[];
      writingLog = d.writingLog||[]; settings = d.settings||settings;
      save(LS.entries,entries); save(LS.chapters,chapters); save(LS.glossary,glossary); save(LS.journal,journal);
      save(LS.writingLog,writingLog); save(LS.settings,settings);
      toast('Yedek geri yüklendi'); applySettingsToUi(); goScreen('bolumler');
    }catch(e){ toast('Geçersiz yedek dosyası'); }
  };
  r.readAsText(f);
}
function resetAll(){
  if(!confirm('TÜM veri kalıcı olarak silinecek. Emin misin?')) return;
  if(!confirm('Bu işlem geri alınamaz. Yine de silinsin mi?')) return;
  localStorage.clear(); location.reload();
}

/* ============ BAŞLANGIÇ ============ */
function applySettingsToUi(){
  document.documentElement.setAttribute('data-theme', settings.theme==='acik'?'':settings.theme);
  document.documentElement.style.setProperty('--font-editor', `'${settings.font||'Lora'}',serif`);
  document.getElementById('ayar-api-key').value = settings.apiKey||'';
  document.getElementById('ayar-text-model').value = settings.textModel||'gemini-2.5-flash';
  document.getElementById('ayar-font').value = settings.font||'Lora';
}
document.addEventListener('DOMContentLoaded', ()=>{
  renderKategoriSecim();
  applySettingsToUi();
  goScreen('bolumler');
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
});
