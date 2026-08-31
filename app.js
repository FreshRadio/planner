/* Fall 2026 planner — app logic
   Data comes from three places, in priority order:
     1. localStorage override  (pasted in the Sync tab)
     2. data.json              (published in the repo)
     3. localStorage cache     (last good copy, so it works offline)
*/

const K = {
  over:'fp_override', cache:'fp_cache',
  ticks:'fp_ticks', done:'fp_done', books:'fp_books'
};
const ORDER = {exam:0, quiz:1, project:2, due:3, career:4, lecture:5};
const GRADED = ['exam','quiz','due','project'];
const COURSE_NAME = {
  EM306:'E M 306 — Statics',
  M427J:'M 427J — Diff Eq w/ Linear Algebra',
  ME316T:'M E 316T — Thermodynamics',
  LEB:'LEB 320F — Business Law & Ethics'
};

let D = null;            // the live data object
let dataSource = '';     // where it came from, shown on the Sync tab
let dayIdx = new Date().getDay();
let planIdx = 0;
let filter = 'all';
let refTab = 'courses';
let ticks = {}, done = {}, books = [];

/* ── small helpers ─────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const today = () => iso(new Date());
const el = (tag, cls, txt) => { const n=document.createElement(tag); if(cls)n.className=cls; if(txt!=null)n.textContent=txt; return n; };
const keyOf = e => e.date+'|'+e.text;
const isGraded = e => GRADED.includes(e.type);
const sortEv = (a,b) => a.date.localeCompare(b.date) || ((ORDER[a.type]??9)-(ORDER[b.type]??9));
const dayDiff = (a,b) => Math.round((new Date(a+'T12:00:00') - new Date(b+'T12:00:00'))/864e5);
const fmt = (ds,o) => new Date(ds+'T12:00:00').toLocaleDateString('en-US',o);

function readJSON(k, fb){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } }
function writeJSON(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }

/* "8:45 AM" -> minutes since midnight */
function toMin(t){
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim());
  if(!m) return null;
  let h = +m[1] % 12;
  if(/pm/i.test(m[3])) h += 12;
  return h*60 + (+m[2]);
}
function nowMin(){ const n=new Date(); return n.getHours()*60+n.getMinutes(); }

/* ── data loading ──────────────────────────────────────────── */
async function loadData(){
  const over = readJSON(K.over, null);
  if(over){ D=over; dataSource='update you pasted'; return; }
  try{
    const r = await fetch('data.json?t='+Date.now(), {cache:'no-store'});
    if(!r.ok) throw 0;
    D = await r.json();
    dataSource = 'published data.json';
    writeJSON(K.cache, D);
  }catch{
    const c = readJSON(K.cache, null);
    if(c){ D=c; dataSource='offline cache'; }
    else { D=null; dataSource='nothing — could not load data.json'; }
  }
}

function validate(o){
  if(!o || typeof o!=='object') return 'That is not a JSON object.';
  if(!Array.isArray(o.events)) return 'Missing an "events" array.';
  if(!o.dayPlan || typeof o.dayPlan!=='object') return 'Missing "dayPlan".';
  for(let i=0;i<7;i++) if(!o.dayPlan[i]) return 'dayPlan is missing day '+i+'.';
  if(!Array.isArray(o.weekPlan)) return 'Missing a "weekPlan" array.';
  const bad = o.events.find(e => !e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date));
  if(bad) return 'An event has a bad date: '+JSON.stringify(bad).slice(0,60);
  return null;
}

/* ── masthead ──────────────────────────────────────────────── */
function renderMast(){
  const n = new Date(), ts = today();
  $('mastDay').textContent  = n.toLocaleDateString('en-US',{weekday:'long'});
  $('mastDate').textContent = n.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});

  const d = dayDiff(D.semester.finalTarget, ts);
  $('mastCount').textContent = d>0 ? d+' days left' : d===0 ? 'final today' : 'semester done';

  const wi = weekIndex();
  $('mastWeek').textContent = wi>=0 ? 'week '+D.weekPlan[wi].n : '';

  const next = D.events.filter(e=>e.date>=ts && isGraded(e)).sort(sortEv)[0];
  const box = $('mastNext');
  if(next){
    const dd = dayDiff(next.date, ts);
    box.textContent = next.course+' '+next.type+' — '+(dd<=0?'today':dd===1?'tomorrow':'in '+dd+' days');
    box.classList.toggle('is-urgent', dd<=2);
  } else { box.textContent=''; box.classList.remove('is-urgent'); }
}

function weekIndex(){
  const ts = today(); let idx=-1;
  D.weekPlan.forEach((w,i)=>{ if(ts>=w.start) idx=i; });
  return idx;
}

/* ── day view ──────────────────────────────────────────────── */
function renderDay(){
  const plan = D.dayPlan[dayIdx];
  const live = dayIdx === new Date().getDay();
  $('dayLabel').textContent = plan.name;

  const rail = $('rail'); rail.innerHTML='';
  const mins = plan.blocks.map(b=>toMin(b.time));
  const now  = nowMin();
  let currentIdx = -1;
  if(live){
    for(let i=0;i<mins.length;i++){
      if(mins[i]!=null && mins[i]<=now && (i===mins.length-1 || mins[i+1]==null || mins[i+1]>now)) currentIdx=i;
    }
  }

  let ok=0, total=0;
  plan.blocks.forEach((b,i)=>{
    const slot = el('div','slot');
    if(b.kind==='class') slot.classList.add('is-class');
    if(live && i===currentIdx) slot.classList.add('is-now');
    if(live && mins[i]!=null && mins[i]<now && i!==currentIdx) slot.classList.add('is-past');

    slot.appendChild(el('div','slot-time', b.time));
    slot.appendChild(el('div','slot-node'));

    const card = el('div','slot-card');
    let box;
    if(b.kind==='class'){
      box = el('div','tick is-fixed','●');
    } else {
      total++;
      const tk = 'tick_'+today()+'_'+b.key;
      const on = !!ticks[tk];
      if(on){ ok++; slot.classList.add('is-done'); }
      box = el('button','tick'+(on?' is-on':''),'✓');
      box.setAttribute('aria-label', (on?'Mark undone: ':'Mark done: ')+b.name);
      box.addEventListener('click', ()=>{ ticks[tk]=!ticks[tk]; writeJSON(K.ticks,ticks); renderDay(); });
    }
    card.appendChild(box);

    const body = el('div','');
    body.appendChild(el('div','slot-name', b.name));
    if(b.meta) body.appendChild(el('div','slot-meta', b.meta));
    card.appendChild(body);

    slot.appendChild(card);
    rail.appendChild(slot);
  });

  const pct = total ? Math.round(ok/total*100) : 0;
  $('dayProgLabel').textContent = live
    ? ok+' of '+total+' blocks done today'
    : total+' checkable blocks on '+plan.name;
  $('dayProgFill').style.width = (live?pct:0)+'%';
}

/* ── plan view ─────────────────────────────────────────────── */
function renderPlan(){
  const w = D.weekPlan[planIdx], cur = weekIndex();
  $('planLabel').textContent = 'Week '+w.n+(planIdx===cur?' — now':'');

  const b = $('planBody'); b.innerHTML='';
  b.appendChild(el('div','plan-phase', w.phase+' · week of '+fmt(w.start,{month:'long',day:'numeric'})));

  [['Aerospace build','aero','aeroDone','Tue + Thu 8:45am · Sat 10am'],
   ['Python / CS','py','pyDone','Mon 8pm · Tue + Thu 10:30am'],
   ['Applications','apps',null,'Sun 2:30pm']
  ].forEach(([name,key,doneKey,when])=>{
    const blk = el('div','plan-blk');
    const top = el('div','plan-top');
    top.appendChild(el('div','plan-name', name));
    top.appendChild(el('div','plan-when', when));
    blk.appendChild(top);
    blk.appendChild(el('div','plan-text', w[key]));
    if(doneKey) blk.appendChild(el('div','plan-done','Done by Sunday: '+w[doneKey]));
    b.appendChild(blk);
  });

  b.appendChild(el('div','plan-debt','If you fall behind: '+w.debt));
}

/* ── tasks view ────────────────────────────────────────────── */
function renderTasks(){
  const ts = today();
  let evs = D.events.filter(e=>e.date>=ts);
  if(filter==='graded') evs = evs.filter(isGraded);
  else if(filter!=='all') evs = evs.filter(e=>e.type===filter);
  evs.sort(sortEv);

  const all = D.events.filter(e=>e.date>=ts && isGraded(e));
  const n = all.filter(e=>done[keyOf(e)]).length;
  $('taskProgLabel').textContent = n+' of '+all.length+' remaining graded items done';
  $('taskProgFill').style.width = (all.length?Math.round(n/all.length*100):0)+'%';

  const body = $('taskBody'); body.innerHTML='';
  if(!evs.length){ body.appendChild(el('div','empty','Nothing here.')); return; }

  let last='';
  evs.forEach(e=>{
    if(e.date!==last){
      last=e.date;
      body.appendChild(el('div','datehead',
        e.date===ts ? 'Today · '+fmt(e.date,{month:'short',day:'numeric'})
                    : fmt(e.date,{weekday:'short',month:'short',day:'numeric'})));
    }
    const k = keyOf(e), on = !!done[k];
    const row = el('div','task'+(on?' is-done':''));
    const box = el('button','tick'+(on?' is-on':''),'✓');
    box.setAttribute('aria-label',(on?'Mark undone: ':'Mark done: ')+e.text);
    box.addEventListener('click',()=>{ done[k]=!done[k]; writeJSON(K.done,done); renderTasks(); renderMast(); });
    row.appendChild(box);

    const bd = el('div','');
    bd.appendChild(el('div','task-text', e.text));
    const meta = el('div','task-meta');
    meta.appendChild(el('span','pill '+e.type, e.type));
    meta.appendChild(el('span','task-course', e.course));
    bd.appendChild(meta);
    row.appendChild(bd);
    body.appendChild(row);
  });
}

/* ── reference view ────────────────────────────────────────── */
function renderRef(){
  const b = $('refBody'); b.innerHTML='';

  if(refTab==='courses'){
    D.courses.forEach(c=>{
      const s = el('div','refsec');
      s.appendChild(el('h3','', c.name));
      [['Lecture',c.when],['Discussion',c.disc],['Office hours',c.oh],
       ['Unique',c.unique+' · '+c.prof],['AI policy',c.ai]
      ].forEach(([l,v])=>{
        if(!v || v==='—') return;
        const r = el('div','refrow'), left = el('div','');
        left.appendChild(el('div','reflabel', l));
        left.appendChild(el('div','refnote', v));
        r.appendChild(left); s.appendChild(r);
      });
      b.appendChild(s);
    });
    return;
  }

  if(refTab==='grades'){
    ['EM306','M427J','ME316T','LEB'].forEach(c=>{
      const items = D.grades.filter(g=>g.course===c);
      if(!items.length) return;
      const s = el('div','refsec');
      s.appendChild(el('h3','', COURSE_NAME[c]));
      items.forEach(g=>{
        const r = el('div','refrow'), left = el('div','');
        left.appendChild(el('div','reflabel', g.label));
        left.appendChild(el('div','refnote', g.note));
        r.appendChild(left);
        r.appendChild(el('div','refval', g.weight));
        s.appendChild(r);
      });
      b.appendChild(s);
    });
    return;
  }

  const s = el('div','refsec');
  s.appendChild(el('h3','', 'Reading — '+books.filter(x=>x.read).length+' of '+books.length+' done'));
  books.forEach((bk,i)=>{
    const row = el('div','book'+(bk.read?' is-read':''));
    const box = el('button','tick'+(bk.read?' is-on':''),'✓');
    box.setAttribute('aria-label',(bk.read?'Mark unread: ':'Mark read: ')+bk.title);
    box.addEventListener('click',()=>{ books[i].read=!books[i].read; writeJSON(K.books,books); renderRef(); });
    row.appendChild(box);
    row.appendChild(el('div','book-t', bk.title));
    s.appendChild(row);
  });
  b.appendChild(s);
}

/* ── sync view ─────────────────────────────────────────────── */
function renderSync(){
  const over = readJSON(K.over,null);
  const s = $('syncState'); s.innerHTML='';
  s.appendChild(el('div','','Version: '+(D.version||'unknown')));
  s.appendChild(el('div','','Data updated: '+(D.updated||'unknown')));
  s.appendChild(el('div','','Loaded from: '+dataSource));
  s.appendChild(el('div','', D.events.length+' events · '+D.weekPlan.length+' weeks planned'));
  if(over) s.appendChild(el('div','','You are running a pasted update. "Reset to published" drops it.'));
}

function msg(text, ok){
  const m = $('syncMsg');
  m.textContent = text;
  m.className = 'sync-msg '+(ok?'ok':'bad');
}

/* ── view switching ────────────────────────────────────────── */
function show(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('is-active'));
  document.querySelectorAll('.tabbtn').forEach(t=>t.classList.remove('is-on'));
  $('v-'+name).classList.add('is-active');
  document.querySelector('.tabbtn[data-view="'+name+'"]').classList.add('is-on');
  window.scrollTo(0,0);
}

function renderAll(){ renderMast(); renderDay(); renderPlan(); renderTasks(); renderRef(); renderSync(); }

/* ── boot ──────────────────────────────────────────────────── */
(async function(){
  await loadData();

  if(!D){
    document.querySelector('main').innerHTML =
      '<div class="empty">Could not load data.json, and there is no cached copy yet.<br><br>' +
      'Open this page once while online, or paste your data into the Sync tab.</div>';
    return;
  }

  ticks = readJSON(K.ticks,{});
  done  = readJSON(K.done,{});
  books = readJSON(K.books,null) || JSON.parse(JSON.stringify(D.books||[]));

  planIdx = Math.max(0, weekIndex());
  renderAll();

  document.querySelectorAll('.tabbtn').forEach(t=>
    t.addEventListener('click',()=>show(t.dataset.view)));

  $('dayPrev').addEventListener('click',()=>{ dayIdx=(dayIdx+6)%7; renderDay(); });
  $('dayNext').addEventListener('click',()=>{ dayIdx=(dayIdx+1)%7; renderDay(); });
  $('dayToday').addEventListener('click',()=>{ dayIdx=new Date().getDay(); renderDay(); });

  $('planPrev').addEventListener('click',()=>{ if(planIdx>0){planIdx--;renderPlan();} });
  $('planNext').addEventListener('click',()=>{ if(planIdx<D.weekPlan.length-1){planIdx++;renderPlan();} });
  $('planNow').addEventListener('click',()=>{ planIdx=Math.max(0,weekIndex()); renderPlan(); });

  document.querySelectorAll('#filters .chip').forEach(c=>
    c.addEventListener('click',()=>{
      filter=c.dataset.filter;
      document.querySelectorAll('#filters .chip').forEach(x=>x.classList.remove('is-on'));
      c.classList.add('is-on'); renderTasks();
    }));

  document.querySelectorAll('#refTabs .chip').forEach(c=>
    c.addEventListener('click',()=>{
      refTab=c.dataset.ref;
      document.querySelectorAll('#refTabs .chip').forEach(x=>x.classList.remove('is-on'));
      c.classList.add('is-on'); renderRef();
    }));

  $('syncApply').addEventListener('click',()=>{
    const raw = $('syncInput').value.trim();
    if(!raw){ msg('Paste the JSON first.',false); return; }
    let parsed;
    try{ parsed = JSON.parse(raw); }
    catch(err){ msg('That is not valid JSON. '+err.message, false); return; }
    const problem = validate(parsed);
    if(problem){ msg(problem, false); return; }
    writeJSON(K.over, parsed);
    D = parsed; dataSource='update you pasted';
    planIdx = Math.max(0, weekIndex());
    renderAll();
    $('syncInput').value='';
    msg('Applied. Now on version '+(D.version||'unknown')+', '+D.events.length+' events.', true);
  });

  $('syncRevert').addEventListener('click',async ()=>{
    localStorage.removeItem(K.over);
    await loadData();
    planIdx = Math.max(0, weekIndex());
    renderAll();
    msg('Back to the published data.json.', true);
  });

  $('syncCopy').addEventListener('click',async ()=>{
    const text = JSON.stringify(D,null,1);
    try{ await navigator.clipboard.writeText(text); msg('Copied '+text.length+' characters.', true); }
    catch{ $('syncInput').value=text; msg('Clipboard blocked — the data is in the box above, select and copy it.', false); }
  });

  // re-mark the current block as time passes
  setInterval(()=>{ if(dayIdx===new Date().getDay()) renderDay(); }, 60000);

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
})();
