'use strict';
/* ── helpers.js ─ General utilities ── */
const H = (() => {
  /* IDs */
  const uid = (p='') => (p?p+'-':'') + crypto.randomUUID().replace(/-/g,'').slice(0,16);
  const rctCode = () => { const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<12;i++){if(i&&i%4===0)s+='-'; s+=c[Math.floor(Math.random()*c.length)];} return s; };
  const now = () => new Date().toISOString();

  /* Dates */
  const fmtDate = iso => { if(!iso) return '-'; const d=new Date(iso); return isNaN(d)?iso:d.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}); };
  const fmtDT = iso => { if(!iso) return '-'; const d=new Date(iso); return isNaN(d)?iso:d.toLocaleString('en-PH',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); };
  const daysUntil = iso => { if(!iso) return null; const t=new Date(iso); t.setHours(0,0,0,0); const d=new Date(); d.setHours(0,0,0,0); return Math.ceil((t-d)/86400000); };
  const toInput = iso => { if(!iso) return ''; const d=new Date(iso); return isNaN(d)?'':d.toISOString().split('T')[0]; };

  /* Money */
  const peso = (v, symbol=true) => { const n=parseFloat(v)||0; const s=n.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}); const sym=symbol?(window.Settings?Settings.get('currencySymbol','₱'):'₱'):''; return sym+s; };
  const num = v => parseFloat(v)||0;

  /* String */
  const esc = s => { if(typeof s!=='string') return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); };
  const trunc = (s,n=36) => !s?'':s.length>n?s.slice(0,n)+'…':s;
  const hl = (t,q) => { if(!q) return esc(t); const safe=esc(t); const r=esc(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return safe.replace(new RegExp(`(${r})`,'gi'),'<mark style="background:rgba(79,142,247,0.25);color:inherit;border-radius:2px">$1</mark>'); };

  /* Password */
  const pwdStrength = p => { let s=0; if(p.length>=8)s++; if(p.length>=12)s++; if(/[A-Z]/.test(p))s++; if(/[0-9]/.test(p))s++; if(/[^A-Za-z0-9]/.test(p))s++; return s<=1?'w':s<=3?'m':'s'; };
  const hashPwd = async p => { const enc=new TextEncoder(); const salt=crypto.getRandomValues(new Uint8Array(16)); const km=await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveBits']); const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},km,256); const hArr=Array.from(new Uint8Array(bits)); const sArr=Array.from(salt); return sArr.map(b=>b.toString(16).padStart(2,'0')).join('')+':'+hArr.map(b=>b.toString(16).padStart(2,'0')).join(''); };
  const verifyPwd = async (p,stored) => { try { const [sh,hh]=stored.split(':'); const salt=new Uint8Array(sh.match(/.{2}/g).map(b=>parseInt(b,16))); const enc=new TextEncoder(); const km=await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveBits']); const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},km,256); const computed=Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,'0')).join(''); return computed===hh; } catch{return false;} };

  /* DOM */
  const el = id => document.getElementById(id);
  const qs = (s,c=document) => c.querySelector(s);
  const qsa = (s,c=document) => Array.from(c.querySelectorAll(s));

  /* Debounce */
  const debounce = (fn,ms=300) => { let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

  /* Validate */
  const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  /* Status chip */
  const chip = st => {
    const m = { 'Pending':'ch-pending','In Progress':'ch-progress','Revision':'ch-revision','Completed':'ch-completed','Delivered':'ch-delivered','Cancelled':'ch-cancelled','Paid':'ch-paid','Partial':'ch-partial','Draft':'ch-draft','Sent':'ch-sent','Overdue':'ch-overdue' };
    return `<span class="chip ${m[st]||'ch-blue'}">${esc(st)}</span>`;
  };

  /* CSV */
  const toCSV = (rows,headers) => { const ln=[headers.join(',')]; for(const r of rows) ln.push(r.map(c=>{const s=String(c??''); return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:''+s;}).join(',')); return ln.join('\n'); };
  const dlFile = (content,name,type='text/plain') => { const b=new Blob([content],{type}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); };
  const dlJSON = (obj,name) => dlFile(JSON.stringify(obj,null,2),name,'application/json');

  /* File read */
  const readFile = (file,mode='text') => new Promise((res,rej) => { const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=()=>rej(new Error('File read failed')); if(mode==='dataURL') r.readAsDataURL(file); else r.readAsText(file); });

  /* Paginate */
  const paginate = (arr,page,pp) => { const s=(page-1)*pp; return { items:arr.slice(s,s+pp), total:arr.length, pages:Math.ceil(arr.length/pp)||1 }; };
  const renderPager = (cid,cur,total,cb) => { const c=el(cid); if(!c) return; if(total<=1){c.innerHTML='';return;} const range=getRange(cur,total); let h=`<button class="pg-btn" ${cur===1?'disabled':''} data-p="${cur-1}">‹</button>`; for(const p of range) { if(p==='…') h+=`<span class="pg-info">…</span>`; else h+=`<button class="pg-btn ${p===cur?'on':''}" data-p="${p}">${p}</button>`; } h+=`<button class="pg-btn" ${cur===total?'disabled':''} data-p="${cur+1}">›</button>`; c.innerHTML=h; c.querySelectorAll('.pg-btn:not([disabled])').forEach(b=>b.addEventListener('click',()=>cb(+b.dataset.p))); };
  const getRange = (cur,total) => { if(total<=7) return Array.from({length:total},(_,i)=>i+1); const p=[1]; if(cur>3) p.push('…'); for(let i=Math.max(2,cur-1);i<=Math.min(total-1,cur+1);i++) p.push(i); if(cur<total-2) p.push('…'); p.push(total); return p; };

  /* Sort */
  const sortArr = (arr,key,dir='asc') => [...arr].sort((a,b)=>{let va=a[key],vb=b[key]; if(typeof va==='string')va=va.toLowerCase(); if(typeof vb==='string')vb=vb.toLowerCase(); if(va<vb) return dir==='asc'?-1:1; if(va>vb) return dir==='asc'?1:-1; return 0;});

  /* Search */
  const search = (items,q,fields) => { if(!q) return items; const ql=q.toLowerCase(); return items.filter(it=>fields.some(f=>String(it[f]??'').toLowerCase().includes(ql))); };

  /* Sanitize file names - hyphens not underscores */
  const sanitizeFile = name => String(name||'file')
    .trim()
    .replace(/[^\w\s.-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .toLowerCase();

  /* Format number without currency for inputs */
  const numFmt = v => { const n = parseFloat(v) || 0; return n.toLocaleString('en-PH', {minimumFractionDigits:2,maximumFractionDigits:2}); };

  return { uid,rctCode,now,fmtDate,fmtDT,daysUntil,toInput,peso,numFmt,num,esc,trunc,hl,pwdStrength,hashPwd,verifyPwd,el,qs,qsa,debounce,validEmail,chip,toCSV,dlFile,dlJSON,readFile,paginate,renderPager,sortArr,search,sanitizeFile };
})();

