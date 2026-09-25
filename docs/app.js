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
  const titles = {anasayfa:'Roman Atölyesi & Dünyam', bolumler:'Bölümler', yazim:'Yazım Modu', dunya:'Dünyam', iliski:'İlişki Haritası', akis:'Hikâye Akışı', sozluk:'Sözlük',
    gunluk:'Yazar Günlüğü', arama:'Arama', okuma:'Okuma Modu', istatistik:'İstatistikler', ai:'AI Asistan', ayarlar:'Ayarlar'};
  document.getElementById('masthead-title').textContent = titles[name] || 'Roman Atölyesi';
  if(name==='anasayfa') renderHomeDashboard();
  if(name==='bolumler') renderBolumlerList();
  if(name==='yazim') renderYazimList();
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

/* ============ ANA SAYFA ============ */
function renderHomeDashboard(){
  const tiles = [
    {s:'bolumler', ic:'📖', lb:'Bölümler', sub:chapters.length+' bölüm'},
    {s:'yazim', ic:'✍️', lb:'Yazım Modu', sub:'Tam ekran yaz'},
    {s:'dunya', ic:'🌍', lb:'Dünyam', sub:entries.length+' madde'},
    {s:'iliski', ic:'🕸️', lb:'İlişki Haritası', sub:'Karakter bağları'},
    {s:'akis', ic:'📈', lb:'Hikâye Akışı', sub:'Ana hat & zaman çizelgesi'},
    {s:'sozluk', ic:'📕', lb:'Sözlük', sub:glossary.length+' terim'},
    {s:'gunluk', ic:'📝', lb:'Yazar Günlüğü', sub:journal.length+' not'},
    {s:'arama', ic:'🔎', lb:'Arama', sub:'Her yerde ara'},
    {s:'okuma', ic:'📗', lb:'Okuma Modu', sub:'Yazdır / indir'},
    {s:'istatistik', ic:'📊', lb:'İstatistikler', sub:totalWordCount()+' kelime'},
    {s:'ai', ic:'✨', lb:'AI Asistan', sub:'Romanına danış'},
    {s:'ayarlar', ic:'⚙️', lb:'Ayarlar', sub:'API, tema, yedek'}
  ];
  document.getElementById('home-grid').innerHTML = tiles.map(t=>`
    <div class="home-tile" onclick="goScreen('${t.s}')"><div class="ic">${t.ic}</div><div class="lb">${t.lb}</div><div class="sub">${t.sub}</div></div>`).join('');
}
function copyText(text){ if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(()=>toast('Kopyalandı')).catch(()=>toast('Kopyalanamadı')); } else { toast('Kopyalanamadı'); } }

/* ============ MODAL ============ */
function openModal(html){ document.getElementById('modal-body').innerHTML = html; document.getElementById('modal-overlay').classList.add('open'); }
function closeModal(){ document.getElementById('modal-overlay').classList.remove('open'); }
document.getElementById('modal-overlay').addEventListener('click', e=>{ if(e.target.id==='modal-overlay') closeModal(); });

/* ============ ZENGİN METİN EDİTÖRÜ ============ */
let savedRange = null, savedEditorEl = null;
function editorToolbarHtml(editorId, showQuickAdd){
  return `<div class="toolbar">
    <button type="button" onmousedown="event.preventDefault();fmt('bold')"><b>K</b></button>
    <button type="button" onmousedown="event.preventDefault();fmt('italic')"><i>İ</i></button>
    <button type="button" onmousedown="event.preventDefault();fmt('underline')"><u>A</u></button>
    <button type="button" onmousedown="event.preventDefault();fmt('formatBlock','H3')">H3</button>
    <button type="button" onmousedown="event.preventDefault();fmt('formatBlock','P')">P</button>
    <button type="button" onmousedown="event.preventDefault();insertImageInto('${editorId}')">🖼️</button>
    <button type="button" onmousedown="event.preventDefault();openLinkPicker('${editorId}')">🔗</button>
    ${showQuickAdd ? `<button type="button" onmousedown="event.preventDefault();quickAddCharacterFromEditor('${editorId}')">👤+</button>` : ''}
  </div>`;
}
function registerEditor(editorId){
  const el = document.getElementById(editorId);
  if(!el) return;
  el.addEventListener('mouseup', ()=>captureRange(editorId));
  el.addEventListener('keyup', ()=>captureRange(editorId));
  el.addEventListener('focus', ()=>captureRange(editorId));
  el.addEventListener('click', e=>{ const t=e.target.closest('b.entlink'); if(t) openEntryPreview(t.dataset.id); });
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
  containerEl.querySelectorAll('b.entlink').forEach(b=>{
    b.style.cursor='pointer';
    b.onclick = (ev)=>{ ev.preventDefault(); openEntryPreview(b.dataset.id); };
  });
}

/* ============ MADDE ÖNİZLEME (küçük pencere) ============ */
function openEntryPreview(id){
  const e = entries.find(x=>x.id===id);
  if(!e){ toast('Madde bulunamadı (silinmiş olabilir)'); return; }
  const cat = catById(e.cat);
  const bodyText = stripHtml(e.body);
  openModal(`<button class="modal-close" onclick="closeModal()">✕</button>
    ${e.cover?`<div class="cover-wrap" style="aspect-ratio:16/9"><img src="${e.cover}"></div>`:''}
    <h3>${cat.icon} ${escapeHtml(e.title)}</h3>
    <span class="chip" style="background:${cat.color};color:#fff;border:none">${cat.label}</span>
    <div class="infobox">${cat.fields.map(f=> e.fields[f.key] ? `<div class="irow"><b>${f.label}</b><span>${escapeHtml(e.fields[f.key])}</span></div>`:'').join('')}</div>
    <div style="max-height:160px;overflow-y:auto;font-family:var(--font-editor);line-height:1.55;margin-top:6px;">${escapeHtml(bodyText.slice(0,450))}${bodyText.length>450?'…':''}</div>
    <div class="btn-row"><button class="btn primary" onclick="closeModal();maddeReturnScreen=currentScreen;openMadde('${id}')">Ansiklopediye Git</button></div>`);
}

/* ============ ROMAN İÇİNDE OTOMATİK MADDE BAĞLANTISI ============ */
const TR_WORD = "A-Za-zÇĞİIÖŞÜçğıiöşü0-9";
function isWordChar(ch){ return !!ch && new RegExp('['+TR_WORD+']').test(ch); }
function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function autoLinkTextNode(text, cands){
  const segments = []; let i = 0;
  while(i < text.length){
    let matched = null, matchLen = 0, sfx = 0;
    for(const c of cands){
      const t = c.title, len = t.length;
      if(len<2) continue;
      if(text.substr(i, len).toLowerCase() === t.toLowerCase()){
        const leftOk = i===0 || !isWordChar(text[i-1]);
        let after = i+len, s=0;
        const rightCh = text[after];
        if(rightCh === "'" || rightCh === "’"){ s=1; let j=after+1; while(j<text.length && isWordChar(text[j])){ j++; s++; } }
        const rightOk = !isWordChar(text[after+s]);
        if(leftOk && rightOk){ matched=c; matchLen=len; sfx=s; break; }
      }
    }
    if(matched){
      segments.push({type:'link', value:text.substr(i, matchLen+sfx), id:matched.id});
      i += matchLen+sfx;
    } else {
      if(segments.length && segments[segments.length-1].type==='text'){ segments[segments.length-1].value += text[i]; }
      else segments.push({type:'text', value:text[i]});
      i++;
    }
  }
  return segments;
}
function walkAndLink(root, cands){
  Array.from(root.childNodes).forEach(node=>{
    if(node.nodeType===Node.TEXT_NODE){
      if(!node.nodeValue || !node.nodeValue.trim()) return;
      const segs = autoLinkTextNode(node.nodeValue, cands);
      if(segs.some(s=>s.type==='link')){
        const frag = document.createDocumentFragment();
        segs.forEach(s=>{
          if(s.type==='link'){ const b=document.createElement('b'); b.className='entlink'; b.dataset.id=s.id; b.textContent=s.value; frag.appendChild(b); }
          else frag.appendChild(document.createTextNode(s.value));
        });
        root.replaceChild(frag, node);
      }
    } else if(node.nodeType===Node.ELEMENT_NODE){
      if(node.tagName==='A' || (node.tagName==='B' && node.classList.contains('entlink')) || node.tagName==='IMG') return;
      walkAndLink(node, cands);
    }
  });
}
function autoLinkScene(html){
  const container = document.createElement('div'); container.innerHTML = html||'';
  const cands = entries.filter(e=>e.title && e.title.trim().length>1).map(e=>({id:e.id, title:e.title.trim()})).sort((a,b)=>b.title.length-a.title.length);
  if(cands.length) walkAndLink(container, cands);
  return container.innerHTML;
}

/* ============ ROMANDAN HIZLI KARAKTER EKLE ============ */
function quickAddCharacterFromEditor(editorId){
  captureRange(editorId);
  const selText = window.getSelection().toString().trim();
  window._qcEditorId = editorId;
  openModal(`<button class="modal-close" onclick="closeModal()">✕</button><h3>👤 Ansiklopediye Karakter Ekle</h3>
    <div class="field"><label>Ad</label><input type="text" id="qc-name" value="${escapeHtml(selText)}"></div>
    <div class="field"><label>Rol</label><select id="qc-role"><option>Yan Karakter</option><option>Baş Karakter</option><option>Antagonist</option><option>Figüran</option></select></div>
    <button class="btn primary block" onclick="quickAddCharacterSave()">Kaydet ve Bağla</button>`);
}
function quickAddCharacterSave(){
  const editorId = window._qcEditorId;
  const name = document.getElementById('qc-name').value.trim();
  if(!name) return toast('Ad gerekli');
  const role = document.getElementById('qc-role').value;
  const data = {id:uid(), cat:'karakter', title:name, tags:[], cover:null, fields:{rol:role}, body:'',
    family:{spouseId:null,childrenIds:[],siblingIds:[]}, relatedIds:[], createdAt:Date.now(), updatedAt:Date.now()};
  entries.push(data); save(LS.entries, entries);
  closeModal();
  const el = document.getElementById(editorId);
  if(el){
    el.focus();
    if(savedRange && savedEditorEl===editorId){ const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
    document.execCommand('insertHTML', false, `<a class="wikilink" data-type="entry" data-id="${data.id}" contenteditable="false">${escapeHtml(name)}</a>&nbsp;`);
  }
  toast('Karakter ansiklopediye eklendi: '+name);
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
      ${editorToolbarHtml('scene-ed-'+i, true)}
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
  const linkedScenes = (window._draftScenes||[]).map(sc=>({...sc, body: autoLinkScene(sc.body)}));
  const data = {
    id: editingChapterId || uid(),
    title: document.getElementById('bd-baslik').value.trim(),
    summary: document.getElementById('bd-ozet').value.trim(),
    transition: document.getElementById('bd-gecis').value.trim(),
    tags: document.getElementById('bd-etiket').value.split(',').map(s=>s.trim()).filter(Boolean),
    mood: Number(document.getElementById('bd-mood').value),
    wordGoal: Number(document.getElementById('bd-hedef').value)||0,
    scenes: linkedScenes,
    order: editingChapterId ? chapters.find(c=>c.id===editingChapterId).order : chapters.length,
    createdAt: editingChapterId ? chapters.find(c=>c.id===editingChapterId).createdAt : Date.now(),
    updatedAt: Date.now()
  };
  if(!data.title){ toast('Başlık gerekli'); return; }
  if(editingChapterId){ chapters = chapters.map(c=>c.id===editingChapterId?data:c); }
  else { chapters.push(data); }
  save(LS.chapters, chapters);
  editingChapterId = data.id;
  window._draftScenes = JSON.parse(JSON.stringify(linkedScenes));
  const newWords = chapterWordCount(data);
  logWritingToday(newWords - oldWords);
  toast('Bölüm kaydedildi');
  return data;
}
function saveChapterAndLeave(){ if(saveChapter()) goScreen('bolumler'); }
function deleteChapter(){
  if(!editingChapterId) return;
  if(!confirm('Bu bölümü silmek istediğine emin misin?')) return;
  chapters = chapters.filter(c=>c.id!==editingChapterId);
  chapters.forEach((c,i)=>c.order=i);
  save(LS.chapters, chapters); toast('Bölüm silindi'); goScreen('bolumler');
}

/* ============ YAZIM MODU (tam ekran odak) ============ */
function renderYazimList(){
  const list = chapters.slice().sort((a,b)=>a.order-b.order);
  const el = document.getElementById('yazim-list');
  if(!list.length){
    el.innerHTML = '<div class="empty-state"><div class="big">✍️</div>Önce bir bölüm oluştur.</div><button class="btn block" onclick="openChapter(null)">+ Yeni Bölüm</button>';
    return;
  }
  el.innerHTML = list.map((c,i)=>`
    <div class="card" onclick="openChapter('${c.id}');openFocusMode('${c.id}')">
      <div class="card-row"><h3>${i+1}. ${escapeHtml(c.title||'Adsız Bölüm')}</h3><span class="muted">${chapterWordCount(c)} kelime</span></div>
      <div class="muted">${escapeHtml(c.summary||'Yazmaya devam etmek için dokun')}</div>
    </div>`).join('');
}
let focusSceneIndex = 0;
function openFocusMode(chapterId){
  if(!window._draftScenes || editingChapterId!==chapterId){
    // güvenlik: chapter yüklü değilse yükle
    if(chapterId) openChapter(chapterId);
  }
  if(!window._draftScenes || !window._draftScenes.length){ window._draftScenes = window._draftScenes||[]; window._draftScenes.push({id:uid(), title:'', body:''}); }
  focusSceneIndex = 0;
  document.getElementById('focus-toolbar-wrap').innerHTML = editorToolbarHtml('focus-editor', true);
  renderFocusScreen();
  document.getElementById('focus-overlay').classList.add('open');
}
function renderFocusScreen(){
  const title = document.getElementById('bd-baslik') ? (document.getElementById('bd-baslik').value || 'Adsız Bölüm') : 'Bölüm';
  document.getElementById('focus-title').textContent = title;
  const scenes = window._draftScenes||[];
  if(focusSceneIndex<0) focusSceneIndex=0;
  if(focusSceneIndex>scenes.length-1) focusSceneIndex=scenes.length-1;
  document.getElementById('focus-scene-label').textContent = (focusSceneIndex+1)+'/'+scenes.length;
  const ed = document.getElementById('focus-editor');
  ed.innerHTML = (scenes[focusSceneIndex]||{}).body || '';
  registerEditor('focus-editor');
  ed.oninput = ()=>{ if(window._draftScenes[focusSceneIndex]){ window._draftScenes[focusSceneIndex].body = ed.innerHTML; updateFocusWordcount(); } };
  updateFocusWordcount();
}
function updateFocusWordcount(){
  const total = (window._draftScenes||[]).reduce((s,sc)=>s+countWords(stripHtml(sc.body)),0);
  document.getElementById('focus-wordcount').textContent = total+' kelime (bölüm toplamı)';
}
function focusPrevScene(){ if(focusSceneIndex>0){ focusSceneIndex--; renderFocusScreen(); } }
function focusNextScene(){
  const scenes = window._draftScenes||[];
  if(focusSceneIndex < scenes.length-1){ focusSceneIndex++; renderFocusScreen(); }
  else { scenes.push({id:uid(), title:'', body:''}); focusSceneIndex = scenes.length-1; renderFocusScreen(); }
}
function closeFocusMode(){
  document.getElementById('focus-overlay').classList.remove('open');
  const title = document.getElementById('bd-baslik').value.trim();
  if(title){ saveChapter(); document.getElementById('bd-sil').style.display = editingChapterId ? 'inline-block':'none'; }
  else { toast('Kaydetmek için bölüme bir başlık ver'); }
  if(currentScreen==='bolum-detay'){ renderScenes(); }
}

/* ============ DÜNYA / ANSİKLOPEDİ ============ */
let dunyaKategoriFilter = 'hepsi';
function renderKategoriChips(){
  let html = `<button class="chip ${dunyaKategoriFilter==='hepsi'?'active':''}" onclick="setDunyaFilter('hepsi')">Hepsi</button>`;
  CATEGORIES.forEach(c=> html += `<button class="chip ${dunyaKategoriFilter===c.id?'active':''}" onclick="setDunyaFilter('${c.id}')">${c.icon} ${c.label}</button>`);
  document.getElementById('dunya-kategori-chips').innerHTML = html;
}
function setDunyaFilter(id){ dunyaKategoriFilter=id; renderKategoriChips(); renderDunyaList(); }
function renderDunyaStats(){
  const total = entries.length;
  const byCat = {}; entries.forEach(e=> byCat[e.cat]=(byCat[e.cat]||0)+1);
  const topCats = CATEGORIES.filter(c=>byCat[c.id]).sort((a,b)=>(byCat[b.id]||0)-(byCat[a.id]||0)).slice(0,3);
  const withCover = entries.filter(e=>e.cover).length;
  let html = `<div class="stat-box"><div class="n">${total}</div><div class="l">toplam madde</div></div>
    <div class="stat-box"><div class="n">${byCat['karakter']||0}</div><div class="l">karakter</div></div>`;
  html += topCats.map(c=>`<div class="stat-box"><div class="n">${byCat[c.id]}</div><div class="l">${c.icon} ${c.label}</div></div>`).join('');
  html += `<div class="stat-box"><div class="n">${withCover}</div><div class="l">kapak görselli</div></div>`;
  document.getElementById('dunya-stat-grid').innerHTML = html;
}
function renderDunyaList(){
  renderKategoriChips();
  renderDunyaStats();
  const q = (document.getElementById('dunya-filter').value||'').toLowerCase();
  let list = entries.filter(e=> (dunyaKategoriFilter==='hepsi'||e.cat===dunyaKategoriFilter) &&
    (!q || e.title.toLowerCase().includes(q) || (e.tags||[]).some(t=>t.toLowerCase().includes(q))));
  const el = document.getElementById('dunya-list');
  if(!list.length){ el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="big">🌍</div>Henüz madde yok</div>'; }
  else {
    el.innerHTML = list.map(e=>{
      const c = catById(e.cat);
      return `<div class="dunya-card" onclick="maddeReturnScreen='dunya';openMadde('${e.id}')">
        <div class="thumb">${e.cover?`<img src="${e.cover}">`:`<span class="ph">${c.icon}</span>`}</div>
        <div class="body">
          <span class="chip" style="background:${c.color};color:#fff;border:none;font-size:.68rem;padding:2px 8px;">${c.label}</span>
          <h3>${escapeHtml(e.title)}</h3>
          <div class="chips">${(e.tags||[]).slice(0,2).map(t=>`<span class="chip tag-chip">#${escapeHtml(t)}</span>`).join('')}</div>
        </div>
      </div>`;
    }).join('');
  }
  el.insertAdjacentHTML('beforeend', `<button class="btn block" style="margin-top:6px;grid-column:1/-1" onclick="goScreen('dunya-kategori')">+ Yeni Madde</button>`);
}
function renderKategoriSecim(){
  document.getElementById('kategori-secim-list').innerHTML = CATEGORIES.map(c=>
    `<div class="list-item" style="cursor:pointer" onclick="newEntryDraft('${c.id}')"><span>${c.icon} ${c.label}</span><span>›</span></div>`).join('');
}
function newEntryDraft(catId){
  const draft = {id:null, cat:catId, title:'', tags:[], cover:null, fields:{}, body:'', family:{spouseId:null,childrenIds:[],siblingIds:[]}, relatedIds:[]};
  editingEntryId = null;
  maddeReturnScreen = 'dunya'; window._maddeDraft = draft; window._maddeMode='edit';
  window._entryAiLog = [];
  goScreen('madde'); renderMadde();
}
let editingEntryId = null;
function openMadde(id){ editingEntryId=id; window._maddeMode='view'; window._entryAiLog=[]; goScreen('madde'); renderMadde(); }
function madeeGeriDon(){ goScreen(maddeReturnScreen||'dunya'); }
function renderEntryAiPanel(entry, cat, editMode){
  window._entryAiLog = window._entryAiLog || [];
  return `<div class="entry-ai-box">
    <h3 style="font-family:var(--font-editor);color:var(--navy);margin:0 0 8px;">✨ AI Yardımcı</h3>
    <div class="btn-row" style="margin-top:0">
      ${editMode ? `<button class="btn" onclick="entryAiImprove()">🪄 İçeriği Geliştir</button>` : ''}
      <button class="btn" onclick="entryAiIdeas()">💡 Fikir Öner</button>
    </div>
    <div class="chat-log" id="entry-ai-log" style="margin-top:10px;"></div>
    <div class="field" style="margin-bottom:8px;"><textarea id="entry-ai-input" rows="2" placeholder="Bu madde hakkında bir şey sor..."></textarea></div>
    <button class="btn primary block" onclick="entryAiAsk()">Sor</button>
  </div>`;
}
function renderEntryAiLog(){
  const el = document.getElementById('entry-ai-log'); if(!el) return;
  el.innerHTML = (window._entryAiLog||[]).map((m,i)=> m.role==='ai'
    ? `<div class="ai-msg-row"><div class="msg ai">${escapeHtml(m.text)}</div><button class="ai-copy-btn" onclick="copyText(window._entryAiLog[${i}].text)">📋 Kopyala</button></div>`
    : `<div class="msg user">${escapeHtml(m.text)}</div>`).join('');
}
function currentMaddeEntry(){
  const isDraft = !!window._maddeDraft && window._maddeMode==='edit' && !editingEntryId;
  return isDraft ? window._maddeDraft : entries.find(e=>e.id===editingEntryId);
}
function buildEntryAiContext(entry, cat){
  const bodyNow = document.getElementById('md-body') ? stripHtml(document.getElementById('md-body').innerHTML) : stripHtml(entry.body);
  return `Bu bir roman dünyası ansiklopedi maddesi.\nKategori: ${cat.label}\nBaşlık: ${entry.title||'(adsız)'}\nAlanlar: ${JSON.stringify(entry.fields||{})}\nMevcut içerik:\n${bodyNow||'(henüz yazılmadı)'}`;
}
async function entryAiImprove(){
  const entry = currentMaddeEntry(); if(!entry) return;
  const cat = catById(entry.cat);
  window._entryAiLog.push({role:'user', text:'İçeriği geliştir'}); renderEntryAiLog();
  const prompt = `Sen bir roman/dünya ansiklopedisi editörüsün. Aşağıdaki maddeyi zenginleştir; akıcı, edebi bir Türkçeyle yeniden yaz. Var olan bilgileri koru, tutarsız veya uydurma detay ekleme, gerekirse kategoriye uygun makul detaylarla tamamla.\n\n${buildEntryAiContext(entry, cat)}`;
  const resp = await callGemini(prompt);
  if(resp==null) return;
  window._entryAiLog.push({role:'ai', text:resp}); renderEntryAiLog();
  openModal(`<button class="modal-close" onclick="closeModal()">✕</button><h3>🪄 Geliştirilmiş İçerik</h3>
    <div style="max-height:280px;overflow-y:auto;font-family:var(--font-editor);line-height:1.6;white-space:pre-wrap;background:var(--paper2);border-radius:10px;padding:10px;">${escapeHtml(resp)}</div>
    <div class="btn-row">
      <button class="btn primary" onclick="applyAiToBody('${entry.id||''}')">Editöre Uygula</button>
      <button class="btn" onclick="copyText(window._entryAiLog[window._entryAiLog.length-1].text)">📋 Kopyala</button>
    </div>`);
}
function applyAiToBody(){
  const last = [...(window._entryAiLog||[])].reverse().find(m=>m.role==='ai');
  const ed = document.getElementById('md-body');
  if(ed && last){ ed.innerText = last.text; toast('İçeriğe uygulandı'); }
  closeModal();
}
async function entryAiIdeas(){
  const entry = currentMaddeEntry(); if(!entry) return;
  const cat = catById(entry.cat);
  window._entryAiLog.push({role:'user', text:'Bu madde için fikir öner'}); renderEntryAiLog();
  const resp = await callGemini(`Sen bir roman dünya kurma (worldbuilding) asistanısın. ${buildEntryAiContext(entry,cat)}\n\nBu maddeyi daha ilginç hale getirecek, hikâyeyle bağlantı kurabilecek 3-4 kısa fikir öner.`);
  if(resp==null) return;
  window._entryAiLog.push({role:'ai', text:resp}); renderEntryAiLog();
}
async function entryAiAsk(){
  const entry = currentMaddeEntry(); if(!entry) return;
  const cat = catById(entry.cat);
  const q = document.getElementById('entry-ai-input').value.trim(); if(!q) return;
  document.getElementById('entry-ai-input').value='';
  window._entryAiLog.push({role:'user', text:q}); renderEntryAiLog();
  const resp = await callGemini(buildEntryAiContext(entry,cat)+'\n\nSORU: '+q);
  if(resp==null) return;
  window._entryAiLog.push({role:'ai', text:resp}); renderEntryAiLog();
}
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
      </div>
      ${renderEntryAiPanel(entry, cat, false)}`;
    wireWikiNav(document.getElementById('madde-body-view'));
    renderEntryAiLog();
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
      </div>
      ${renderEntryAiPanel(entry, cat, true)}`;
    registerEditor('md-body');
    renderEntryAiLog();
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
  goScreen('anasayfa');
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
});
