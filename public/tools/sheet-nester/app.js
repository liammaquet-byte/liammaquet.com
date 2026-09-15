(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const els = {
    sheetWidth: $('#sheetWidth'), sheetHeight: $('#sheetHeight'), units: $('#units'), margin: $('#margin'), gap: $('#gap'), allowRotate: $('#allowRotate'),
    rectModeBtn: $('#rectModeBtn'), dxfModeBtn: $('#dxfModeBtn'), rectMode: $('#rectMode'), dxfMode: $('#dxfMode'),
    partsBody: $('#partsBody'), rowTemplate: $('#partRowTemplate'), addPartBtn: $('#addPartBtn'), clearPartsBtn: $('#clearPartsBtn'), nestBtn: $('#nestBtn'), exampleBtn: $('#exampleBtn'),
    dxfFiles: $('#dxfFiles'), clearDxfBtn: $('#clearDxfBtn'), dxfBody: $('#dxfBody'), dxfEmpty: $('#dxfEmpty'), dxfTableWrap: $('#dxfTableWrap'), rotationStep: $('#rotationStep'), curveTolerance: $('#curveTolerance'), nestDxfBtn: $('#nestDxfBtn'),
    errorBox: $('#errorBox'), resultsPanel: $('#resultsPanel'), resultSummary: $('#resultSummary'), stats: $('#stats'), preview: $('#preview'), sheetIndicator: $('#sheetIndicator'), prevSheetBtn: $('#prevSheetBtn'), nextSheetBtn: $('#nextSheetBtn'), exportSheetBtn: $('#exportSheetBtn'), exportAllBtn: $('#exportAllBtn'), statusPill: $('#statusPill')
  };

  let state = { mode: 'rect', result: null, sheetIndex: 0, settings: null, imported: [] };
  const EPS = 1e-7;

  class MaxRectsBin {
    constructor(width, height, heuristic) { this.width = width; this.height = height; this.heuristic = heuristic; this.freeRects = [{ x: 0, y: 0, w: width, h: height }]; this.usedRects = []; }
    scoreRect(w, h) {
      let best = null;
      for (const free of this.freeRects) {
        if (w > free.w + EPS || h > free.h + EPS) continue;
        const dh = Math.abs(free.w - w), dv = Math.abs(free.h - h), short = Math.min(dh, dv), long = Math.max(dh, dv), area = free.w * free.h - w * h;
        let s1, s2;
        if (this.heuristic === 'area') [s1, s2] = [area, short]; else if (this.heuristic === 'long') [s1, s2] = [long, short]; else if (this.heuristic === 'bottom') [s1, s2] = [free.y + h, free.x + w]; else [s1, s2] = [short, long];
        const c = { x: free.x, y: free.y, w, h, score1: s1, score2: s2 };
        if (!best || s1 < best.score1 - EPS || (Math.abs(s1 - best.score1) < EPS && s2 < best.score2 - EPS)) best = c;
      }
      return best;
    }
    place(rect) {
      const next = [];
      for (const f of this.freeRects) {
        if (!rectIntersects(f, rect)) { next.push(f); continue; }
        if (rect.x < f.x + f.w && rect.x + rect.w > f.x) {
          if (rect.y > f.y && rect.y < f.y + f.h) next.push({ x: f.x, y: f.y, w: f.w, h: rect.y - f.y });
          if (rect.y + rect.h < f.y + f.h) next.push({ x: f.x, y: rect.y + rect.h, w: f.w, h: f.y + f.h - rect.y - rect.h });
        }
        if (rect.y < f.y + f.h && rect.y + rect.h > f.y) {
          if (rect.x > f.x && rect.x < f.x + f.w) next.push({ x: f.x, y: f.y, w: rect.x - f.x, h: f.h });
          if (rect.x + rect.w < f.x + f.w) next.push({ x: rect.x + rect.w, y: f.y, w: f.x + f.w - rect.x - rect.w, h: f.h });
        }
      }
      this.freeRects = pruneRects(next);
      this.usedRects.push(rect);
    }
  }

  function rectIntersects(a, b) { return !(b.x >= a.x + a.w - EPS || b.x + b.w <= a.x + EPS || b.y >= a.y + a.h - EPS || b.y + b.h <= a.y + EPS); }
  function pruneRects(rects) {
    const clean = rects.filter(r => r.w > EPS && r.h > EPS), keep = new Array(clean.length).fill(true);
    for (let i = 0; i < clean.length; i++) for (let j = 0; j < clean.length; j++) if (i !== j && keep[i] && clean[i].x >= clean[j].x - EPS && clean[i].y >= clean[j].y - EPS && clean[i].x + clean[i].w <= clean[j].x + clean[j].w + EPS && clean[i].y + clean[i].h <= clean[j].y + clean[j].h + EPS) keep[i] = false;
    return clean.filter((_, i) => keep[i]);
  }

  function switchMode(mode) {
    state.mode = mode; hideResults(); clearError();
    els.rectMode.hidden = mode !== 'rect'; els.dxfMode.hidden = mode !== 'dxf';
    els.rectModeBtn.classList.toggle('active', mode === 'rect'); els.dxfModeBtn.classList.toggle('active', mode === 'dxf');
    els.statusPill.textContent = mode === 'rect' ? 'Rectangle mode' : 'DXF mode';
  }

  function commonSettings() {
    const sheetW = +els.sheetWidth.value, sheetH = +els.sheetHeight.value, margin = +(els.margin.value || 0), gap = +(els.gap.value || 0);
    if (!(sheetW > 0) || !(sheetH > 0)) throw new Error('Enter a valid sheet width and height.');
    if (!(margin >= 0) || !(gap >= 0)) throw new Error('Margin and part gap must be zero or greater.');
    if (sheetW - 2 * margin <= 0 || sheetH - 2 * margin <= 0) throw new Error('The edge margin leaves no usable sheet area.');
    return { sheetW, sheetH, margin, gap, units: els.units.value, globalRotate: els.allowRotate.checked };
  }

  function addPartRow(part = {}) {
    const frag = els.rowTemplate.content.cloneNode(true), row = frag.querySelector('.part-row');
    row.querySelector('.part-width').value = part.width ?? ''; row.querySelector('.part-height').value = part.height ?? ''; row.querySelector('.part-qty').value = part.qty ?? 1; row.querySelector('.part-rotate').checked = part.rotate ?? true;
    row.querySelector('.remove-part').onclick = () => { row.remove(); if (!els.partsBody.children.length) addPartRow(); };
    els.partsBody.appendChild(frag);
  }
  function clearParts() { els.partsBody.innerHTML = ''; addPartRow(); hideResults(); }
  function loadExample() {
    els.sheetWidth.value = 2440; els.sheetHeight.value = 1220; els.margin.value = 10; els.gap.value = 3; els.units.value = 'mm'; els.allowRotate.checked = true; els.partsBody.innerHTML = '';
    [{ width: 720, height: 420, qty: 4 }, { width: 610, height: 380, qty: 5 }, { width: 500, height: 300, qty: 4 }, { width: 350, height: 260, qty: 6 }].forEach(addPartRow); hideResults();
  }
  function readRectSettings() {
    const s = commonSettings(), parts = []; let rowNo = 0;
    for (const row of els.partsBody.querySelectorAll('.part-row')) {
      rowNo++; const width = +row.querySelector('.part-width').value, height = +row.querySelector('.part-height').value, qty = +row.querySelector('.part-qty').value, rotate = row.querySelector('.part-rotate').checked;
      if (!row.querySelector('.part-width').value && !row.querySelector('.part-height').value) continue;
      if (!(width > 0) || !(height > 0)) throw new Error(`Part row ${rowNo} needs a valid width and height.`); if (!Number.isInteger(qty) || qty < 1) throw new Error(`Part row ${rowNo} needs a quantity of 1 or more.`);
      parts.push({ width, height, qty, rotate, rowNo });
    }
    if (!parts.length) throw new Error('Add at least one part.'); return { ...s, mode: 'rect', parts };
  }
  function expandRectParts(s) {
    const out = []; let id = 1;
    s.parts.forEach((p, typeIndex) => { for (let i = 0; i < p.qty; i++) out.push({ id: id++, typeIndex, originalW: p.width, originalH: p.height, canRotate: s.globalRotate && p.rotate, area: p.width * p.height, maxSide: Math.max(p.width, p.height), minSide: Math.min(p.width, p.height) }); });
    return out;
  }
  function seededShuffle(items, seed) { const a = [...items]; let s = seed >>> 0; const rnd = () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function rectOrderings(parts) { const v = [[...parts].sort((a,b)=>b.area-a.area||b.maxSide-a.maxSide), [...parts].sort((a,b)=>b.maxSide-a.maxSide||b.area-a.area), [...parts].sort((a,b)=>b.originalW-a.originalW||b.originalH-a.originalH), [...parts].sort((a,b)=>b.originalH-a.originalH||b.originalW-a.originalW)]; for(let i=1;i<=5;i++) v.push(seededShuffle(parts, 7919*i+parts.length)); return v; }
  function packRectangles(parts, s, heuristic) {
    const usableW = s.sheetW - 2*s.margin + s.gap, usableH = s.sheetH - 2*s.margin + s.gap, bins = [];
    for (const part of parts) {
      let best = null; const os = [{pw:part.originalW+s.gap,ph:part.originalH+s.gap,w:part.originalW,h:part.originalH,rotated:false}];
      if (part.canRotate && Math.abs(part.originalW-part.originalH)>EPS) os.push({pw:part.originalH+s.gap,ph:part.originalW+s.gap,w:part.originalH,h:part.originalW,rotated:true});
      for (let bi=0;bi<bins.length;bi++) for (const o of os) { const score=bins[bi].scoreRect(o.pw,o.ph); if(score && (!best||score.score1<best.score.score1-EPS||(Math.abs(score.score1-best.score.score1)<EPS&&score.score2<best.score.score2-EPS))) best={bi,bin:bins[bi],score,o}; }
      if (!best) { const bin=new MaxRectsBin(usableW,usableH,heuristic); bins.push(bin); for (const o of os) { const score=bin.scoreRect(o.pw,o.ph); if(score){best={bi:bins.length-1,bin,score,o};break;} } }
      if (!best) throw new Error(`Part ${fmt(part.originalW)} × ${fmt(part.originalH)} does not fit the usable sheet area.`);
      const r={x:best.score.x,y:best.score.y,w:best.o.pw,h:best.o.ph,part,actualW:best.o.w,actualH:best.o.h,rotated:best.o.rotated}; best.bin.place(r);
    }
    const sheets=bins.map((bin,sheetIndex)=>{const placements=bin.usedRects.map(r=>({kind:'rect',id:r.part.id,typeIndex:r.part.typeIndex,x:r.x+s.margin,y:r.y+s.margin,w:r.actualW,h:r.actualH,rotated:r.rotated,originalW:r.part.originalW,originalH:r.part.originalH}));return{sheetIndex,placements,partArea:placements.reduce((z,p)=>z+p.w*p.h,0)};});
    return summarizeResult(sheets,s,parts.length,'rect');
  }
  function nestRectangles(s) {
    const parts=expandRectParts(s); let best=null, attempts=0;
    for(const ordered of rectOrderings(parts)) for(const h of ['short','area','long','bottom']) { attempts++; const r=packRectangles(ordered,s,h); if(!best||comparePacked(r,best)<0) best=r; }
    best.attempts=attempts; return best;
  }

  function comparePacked(a,b){ if(a.sheets.length!==b.sheets.length)return a.sheets.length-b.sheets.length; if(Math.abs(a.lastSheetUtil-b.lastSheetUtil)>1e-10)return b.lastSheetUtil-a.lastSheetUtil; return a.compactness-b.compactness; }
  function summarizeResult(sheets,s,totalParts,mode){ const sheetArea=s.sheetW*s.sheetH,totalPartArea=sheets.reduce((z,x)=>z+x.partArea,0),overallUtilization=totalPartArea/(sheets.length*sheetArea),lastSheetUtil=sheets.length?sheets[sheets.length-1].partArea/sheetArea:0,compactness=sheets.reduce((z,sh)=>z+sheetCompactness(sh),0); return{sheets,totalPartArea,overallUtilization,lastSheetUtil,compactness,totalParts,mode,attempts:1}; }
  function sheetCompactness(sh){ if(!sh.placements.length)return 0; let maxX=0,maxY=0; for(const p of sh.placements){ if(p.kind==='rect'){maxX=Math.max(maxX,p.x+p.w);maxY=Math.max(maxY,p.y+p.h);}else{maxX=Math.max(maxX,p.x+p.orientation.w);maxY=Math.max(maxY,p.y+p.orientation.h);} } return maxX*maxY; }

  // ---------- DXF parsing and exact-geometry preservation ----------
  const ignoredDxfEntities = new Set(['TEXT','MTEXT','DIMENSION','HATCH','POINT','LEADER','MLEADER']);
  const rejectedDxfEntities = new Set(['SPLINE','ELLIPSE','INSERT','SOLID','3DFACE','TRACE','REGION','BODY','3DSOLID','IMAGE','WIPEOUT']);

  function parseDxf(text, name, tolerance) {
    const raw=text.replace(/\r/g,'').split('\n'), pairs=[]; for(let i=0;i+1<raw.length;i+=2)pairs.push({code:+raw[i].trim(),value:raw[i+1].trim()});
    let inEntities=false; const entities=[], unsupported=new Set();
    for(let i=0;i<pairs.length;){
      const p=pairs[i];
      if(p.code===0&&p.value==='SECTION'&&pairs[i+1]?.code===2&&pairs[i+1]?.value==='ENTITIES'){inEntities=true;i+=2;continue;}
      if(inEntities&&p.code===0&&p.value==='ENDSEC'){inEntities=false;i++;continue;}
      if(!inEntities||p.code!==0){i++;continue;}
      const type=p.value; if(type==='POLYLINE'){
        const header=[]; i++; while(i<pairs.length&&pairs[i].code!==0)header.push(pairs[i++]); const verts=[];
        while(i<pairs.length&&pairs[i].code===0&&pairs[i].value==='VERTEX'){const vp=[];i++;while(i<pairs.length&&pairs[i].code!==0)vp.push(pairs[i++]);verts.push(vp);}
        if(i<pairs.length&&pairs[i].code===0&&pairs[i].value==='SEQEND')i++;
        entities.push(parsePolylineEntity(header,verts)); continue;
      }
      const data=[]; i++; while(i<pairs.length&&pairs[i].code!==0)data.push(pairs[i++]);
      if(['LWPOLYLINE','LINE','ARC','CIRCLE'].includes(type)) entities.push(parseEntity(type,data)); else if(rejectedDxfEntities.has(type))unsupported.add(type); else if(!ignoredDxfEntities.has(type)&&type!=='SEQEND') unsupported.add(type);
    }
    if(unsupported.size) throw new Error(`${name}: unsupported design entit${unsupported.size===1?'y':'ies'} ${[...unsupported].join(', ')}. File rejected so geometry is not silently altered.`);
    const clean=entities.filter(Boolean); if(!clean.length)throw new Error(`${name}: no supported geometry found.`);
    const closed=clean.map((e,index)=>({e,index,poly:sampleClosedEntity(e,tolerance)})).filter(x=>x.poly&&x.poly.length>=3);
    if(!closed.length)throw new Error(`${name}: no closed LWPOLYLINE, closed POLYLINE, or CIRCLE was found for the nesting boundary.`);
    for(const c of closed)c.area=Math.abs(polygonArea(c.poly)); closed.sort((a,b)=>b.area-a.area); const outer=closed[0], bb=bounds(outer.poly);
    if(!(bb.w>EPS&&bb.h>EPS))throw new Error(`${name}: the detected outer profile has zero width or height.`);
    return {name,entities:clean,outerIndex:outer.index,outerPoints:outer.poly,baseMinX:bb.minX,baseMinY:bb.minY,width:bb.w,height:bb.h,area:outer.area,entityCount:clean.length};
  }
  function val(data,code,def=0){const p=data.find(x=>x.code===code);return p?+p.value:def;}
  function parseEntity(type,data){
    if(type==='LINE')return{type,x1:val(data,10),y1:val(data,20),x2:val(data,11),y2:val(data,21)};
    if(type==='CIRCLE')return{type,cx:val(data,10),cy:val(data,20),r:Math.abs(val(data,40))};
    if(type==='ARC')return{type,cx:val(data,10),cy:val(data,20),r:Math.abs(val(data,40)),a0:val(data,50),a1:val(data,51)};
    if(type==='LWPOLYLINE'){
      const vertices=[]; let current=null; for(const p of data){ if(p.code===10){if(current)vertices.push(current);current={x:+p.value,y:0,bulge:0};} else if(current&&p.code===20)current.y=+p.value; else if(current&&p.code===42)current.bulge=+p.value; } if(current)vertices.push(current);
      return{type,vertices,closed:(val(data,70,0)&1)!==0};
    }
    return null;
  }
  function parsePolylineEntity(header,verts){ const vertices=verts.map(v=>({x:val(v,10),y:val(v,20),bulge:val(v,42,0)})); return{type:'POLYLINE',vertices,closed:(val(header,70,0)&1)!==0}; }
  function sampleClosedEntity(e,tol){ if(e.type==='CIRCLE')return sampleCircle(e.cx,e.cy,e.r,tol); if((e.type==='LWPOLYLINE'||e.type==='POLYLINE')&&e.closed)return samplePolyline(e.vertices,true,tol); return null; }
  function sampleCircle(cx,cy,r,tol){const n=curveSegments(r,Math.PI*2,tol,24);const pts=[];for(let i=0;i<n;i++){const a=2*Math.PI*i/n;pts.push({x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)});}return pts;}
  function curveSegments(r,sweep,tol,minSeg=4){ if(!(r>0))return minSeg; const t=Math.max(1e-9,Math.min(tol,r*0.5)); const maxAng=2*Math.acos(Math.max(-1,Math.min(1,1-t/r))); return Math.min(4096,Math.max(minSeg,Math.ceil(Math.abs(sweep)/Math.max(maxAng,Math.PI/1800)))); }
  function samplePolyline(vs,closed,tol){ const out=[]; const count=closed?vs.length:vs.length-1; for(let i=0;i<count;i++){const a=vs[i],b=vs[(i+1)%vs.length]; if(!out.length)out.push({x:a.x,y:a.y}); if(Math.abs(a.bulge||0)<1e-12)out.push({x:b.x,y:b.y}); else out.push(...sampleBulge(a,b,a.bulge,tol).slice(1));} if(!closed&&vs.length)out.push({x:vs.at(-1).x,y:vs.at(-1).y}); if(closed&&out.length>1&&dist2(out[0],out.at(-1))<EPS*EPS)out.pop(); return out; }
  function sampleBulge(a,b,bulge,tol){ const dx=b.x-a.x,dy=b.y-a.y,c=Math.hypot(dx,dy),theta=4*Math.atan(bulge); if(c<EPS)return[{x:a.x,y:a.y},{x:b.x,y:b.y}]; const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,off=c*(1-bulge*bulge)/(4*bulge),ux=-dy/c,uy=dx/c,cx=mx+ux*off,cy=my+uy*off,r=Math.hypot(a.x-cx,a.y-cy),start=Math.atan2(a.y-cy,a.x-cx),n=curveSegments(r,theta,tol,2),pts=[]; for(let i=0;i<=n;i++){const ang=start+theta*i/n;pts.push({x:cx+r*Math.cos(ang),y:cy+r*Math.sin(ang)});} pts[0]={x:a.x,y:a.y};pts[n]={x:b.x,y:b.y};return pts; }

  async function importDxfFiles(fileList){ clearError(); const tolerance=readTolerance(); for(const file of [...fileList]){ try{const text=await file.text(); const parsed=parseDxf(text,file.name,tolerance); state.imported.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),file:parsed,qty:1,rotate:true});}catch(e){showError(e.message||String(e));} } els.dxfFiles.value=''; renderDxfList(); }
  function readTolerance(){const t=+els.curveTolerance.value;if(!(t>0))throw new Error('Curve collision tolerance must be greater than zero.');return t;}
  function renderDxfList(){ els.dxfEmpty.hidden=state.imported.length>0; els.dxfTableWrap.hidden=!state.imported.length; els.dxfBody.innerHTML=''; for(const item of state.imported){const tr=document.createElement('tr');tr.innerHTML=`<td><div class="dxf-name"></div></td><td>${fmt(item.file.width)} × ${fmt(item.file.height)}</td><td><input class="dxf-qty" type="number" min="1" step="1" value="${item.qty}"></td><td class="rotate-column"><input class="dxf-rotate" type="checkbox" ${item.rotate?'checked':''}></td><td><button type="button" class="remove-part" aria-label="Remove DXF">×</button></td>`; const name=tr.querySelector('.dxf-name'); name.textContent=item.file.name; const sub=document.createElement('span');sub.className='dxf-sub';sub.textContent=`${item.file.entityCount} preserved geometr${item.file.entityCount===1?'y':'ies'}`;name.appendChild(sub);tr.querySelector('.dxf-qty').onchange=e=>item.qty=Math.max(1,parseInt(e.target.value,10)||1);tr.querySelector('.dxf-rotate').onchange=e=>item.rotate=e.target.checked;tr.querySelector('.remove-part').onclick=()=>{state.imported=state.imported.filter(x=>x.id!==item.id);renderDxfList();hideResults();};els.dxfBody.appendChild(tr);} }
  function readDxfSettings(){const s=commonSettings(),tolerance=readTolerance(),rotationStep=+els.rotationStep.value;if(!state.imported.length)throw new Error('Import at least one DXF part first.'); for(const item of state.imported){if(!Number.isInteger(item.qty)||item.qty<1)throw new Error(`${item.file.name}: quantity must be 1 or more.`);} return{...s,mode:'dxf',tolerance,rotationStep,parts:state.imported};}

  function buildOrientations(file,canRotate,step){ const src=file.outerPoints.map(p=>({x:p.x-file.baseMinX,y:p.y-file.baseMinY})), angles=canRotate?Array.from({length:Math.ceil(360/step)},(_,i)=>(i*step)%360):[0], seen=new Set(), out=[]; for(const angle of angles){const key=((angle%360)+360)%360;if(seen.has(key))continue;seen.add(key);const rp=src.map(p=>rotatePoint(p,key)),bb=bounds(rp),points=rp.map(p=>({x:p.x-bb.minX,y:p.y-bb.minY}));out.push({angle:key,points,w:bb.w,h:bb.h,rotMinX:bb.minX,rotMinY:bb.minY});} return out; }
  function rotatePoint(p,deg){const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c};}
  function buildDxfInstances(s){const out=[];let serial=1;for(let ti=0;ti<s.parts.length;ti++){const item=s.parts[ti],orientations=buildOrientations(item.file,s.globalRotate&&item.rotate,s.rotationStep);for(let q=0;q<item.qty;q++)out.push({id:serial++,typeIndex:ti,file:item.file,orientations,area:item.file.area,maxSide:Math.max(item.file.width,item.file.height),bboxArea:item.file.width*item.file.height});}return out;}
  function dxfOrderings(parts){return[[...parts].sort((a,b)=>b.area-a.area||b.maxSide-a.maxSide),[...parts].sort((a,b)=>b.bboxArea-a.bboxArea||b.area-a.area),[...parts].sort((a,b)=>b.maxSide-a.maxSide||b.area-a.area)];}
  function nestDxf(s){const instances=buildDxfInstances(s);if(instances.length>120)throw new Error('This browser nester currently limits DXF jobs to 120 part instances to keep collision testing responsive.');let best=null,attempts=0;for(const order of dxfOrderings(instances)){attempts++;const r=packPolygons(order,s);if(!best||comparePacked(r,best)<0)best=r;}best.attempts=attempts;return best;}

  function packPolygons(parts,s){const sheets=[];for(const part of parts){let choice=null;for(let si=0;si<sheets.length;si++){const c=findPolygonPlacement(part,sheets[si],s);if(c&&(!choice||placementScore(c)<placementScore(choice)))choice={...c,sheetIndex:si};}if(!choice){const sh={sheetIndex:sheets.length,placements:[],partArea:0};const c=findPolygonPlacement(part,sh,s);if(!c)throw new Error(`${part.file.name} does not fit the usable sheet area at the permitted rotations.`);sheets.push(sh);choice={...c,sheetIndex:sheets.length-1};}const sh=sheets[choice.sheetIndex],placement={kind:'dxf',id:part.id,typeIndex:part.typeIndex,file:part.file,orientation:choice.orientation,x:choice.x,y:choice.y,polygon:choice.polygon};sh.placements.push(placement);sh.partArea+=part.area;}
    return summarizeResult(sheets,s,parts.length,'dxf');}
  function placementScore(c){return c.y*1e9+c.x*1e5+(c.y+c.orientation.h)*100+(c.x+c.orientation.w);}
  function findPolygonPlacement(part,sheet,s){let best=null;for(const o of part.orientations){if(o.w>s.sheetW-2*s.margin+EPS||o.h>s.sheetH-2*s.margin+EPS)continue;const candidates=polygonCandidates(o,sheet,s);for(const c of candidates){const poly=o.points.map(p=>({x:p.x+c.x,y:p.y+c.y}));if(!insideSheet(poly,s))continue;if(sheet.placements.some(p=>polygonsTooClose(poly,p.polygon,s.gap)))continue;const found={x:c.x,y:c.y,orientation:o,polygon:poly};if(!best||placementScore(found)<placementScore(best))best=found;if(best&&best.y<=s.margin+EPS&&best.x<=s.margin+EPS)break;}}return best;}
  function polygonCandidates(o,sheet,s){const raw=[{x:s.margin,y:s.margin},{x:s.sheetW-s.margin-o.w,y:s.margin},{x:s.margin,y:s.sheetH-s.margin-o.h}];for(const p of sheet.placements){const bb=bounds(p.polygon);raw.push({x:bb.maxX+s.gap,y:bb.minY},{x:bb.minX,y:bb.maxY+s.gap},{x:bb.maxX+s.gap,y:Math.max(s.margin,bb.maxY-o.h)},{x:Math.max(s.margin,bb.maxX-o.w),y:bb.maxY+s.gap});const a=sampleForCandidates(p.polygon,20),b=sampleForCandidates(o.points,20);for(const q of a)for(const r of b){raw.push({x:q.x-r.x+s.gap,y:q.y-r.y},{x:q.x-r.x-s.gap,y:q.y-r.y},{x:q.x-r.x,y:q.y-r.y+s.gap},{x:q.x-r.x,y:q.y-r.y-s.gap});}}
    const map=new Map();for(const c of raw){if(c.x<s.margin-EPS||c.y<s.margin-EPS||c.x+o.w>s.sheetW-s.margin+EPS||c.y+o.h>s.sheetH-s.margin+EPS)continue;const k=`${Math.round(c.x*1e5)},${Math.round(c.y*1e5)}`;if(!map.has(k))map.set(k,c);}return[...map.values()].sort((a,b)=>a.y-b.y||a.x-b.x).slice(0,5000);}
  function sampleForCandidates(poly,max){if(poly.length<=max)return poly;const out=[];for(let i=0;i<max;i++)out.push(poly[Math.floor(i*poly.length/max)]);return out;}
  function insideSheet(poly,s){return poly.every(p=>p.x>=s.margin-EPS&&p.y>=s.margin-EPS&&p.x<=s.sheetW-s.margin+EPS&&p.y<=s.sheetH-s.margin+EPS);}
  function polygonsTooClose(a,b,gap){const ba=bounds(a),bb=bounds(b);if(ba.maxX+gap<bb.minX-EPS||bb.maxX+gap<ba.minX-EPS||ba.maxY+gap<bb.minY-EPS||bb.maxY+gap<ba.minY-EPS)return false;if(gap<=EPS)return polygonsOverlapStrict(a,b);if(polygonsIntersect(a,b))return true;const g2=gap*gap;for(let i=0;i<a.length;i++){const a1=a[i],a2=a[(i+1)%a.length];for(let j=0;j<b.length;j++){const b1=b[j],b2=b[(j+1)%b.length];if(segmentDistance2(a1,a2,b1,b2)<g2-EPS)return true;}}return false;}

  function polygonsOverlapStrict(a,b){for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(segmentsProperIntersect(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;return pointInPolyStrict(a[0],b)||pointInPolyStrict(b[0],a);}
  function segmentsProperIntersect(a,b,c,d){const c1=cross(a,b,c),c2=cross(a,b,d),c3=cross(c,d,a),c4=cross(c,d,b);return ((c1>EPS&&c2<-EPS)||(c1<-EPS&&c2>EPS))&&((c3>EPS&&c4<-EPS)||(c3<-EPS&&c4>EPS));}
  function pointInPolyStrict(p,poly){for(let i=0,j=poly.length-1;i<poly.length;j=i++)if(onSeg(poly[j],poly[i],p))return false;let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];const hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x);if(hit)inside=!inside;}return inside;}
  function polygonsIntersect(a,b){for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(segmentsIntersect(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;return pointInPoly(a[0],b)||pointInPoly(b[0],a);}
  function cross(a,b,c){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
  function onSeg(a,b,p){return Math.abs(cross(a,b,p))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;}
  function segmentsIntersect(a,b,c,d){const c1=cross(a,b,c),c2=cross(a,b,d),c3=cross(c,d,a),c4=cross(c,d,b);if(((c1>EPS&&c2<-EPS)||(c1<-EPS&&c2>EPS))&&((c3>EPS&&c4<-EPS)||(c3<-EPS&&c4>EPS)))return true;return onSeg(a,b,c)||onSeg(a,b,d)||onSeg(c,d,a)||onSeg(c,d,b);}
  function pointInPoly(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(onSeg(a,b,p))return true;const hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x);if(hit)inside=!inside;}return inside;}
  function pointSegDist2(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<EPS)return dist2(p,a);let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;t=Math.max(0,Math.min(1,t));return dist2(p,{x:a.x+t*dx,y:a.y+t*dy});}
  function segmentDistance2(a,b,c,d){if(segmentsIntersect(a,b,c,d))return 0;return Math.min(pointSegDist2(a,c,d),pointSegDist2(b,c,d),pointSegDist2(c,a,b),pointSegDist2(d,a,b));}
  function dist2(a,b){const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy;}
  function polygonArea(poly){let z=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)z+=(poly[j].x*poly[i].y-poly[i].x*poly[j].y);return z/2;}
  function bounds(pts){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of pts){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}return{minX,minY,maxX,maxY,w:maxX-minX,h:maxY-minY};}

  // ---------- Rendering ----------
  function renderResults(){const {result,settings}=state;if(!result||!settings)return;state.sheetIndex=Math.min(state.sheetIndex,result.sheets.length-1);const current=result.sheets[state.sheetIndex],sheetArea=settings.sheetW*settings.sheetH,util=current.partArea/sheetArea;els.resultsPanel.hidden=false;els.resultSummary.textContent=result.mode==='dxf'?`${result.totalParts} imported part${result.totalParts===1?'':'s'} placed across ${result.sheets.length} sheet${result.sheets.length===1?'':'s'}. Best of ${result.attempts} shape-packing attempts.`:`${result.totalParts} parts placed across ${result.sheets.length} sheet${result.sheets.length===1?'':'s'}. Best of ${result.attempts} packing attempts.`;els.stats.innerHTML=[statHtml('Sheets',result.sheets.length),statHtml(result.mode==='dxf'?'Profile area use':'Overall material use',`${(result.overallUtilization*100).toFixed(1)}%`),statHtml('Shown sheet use',`${(util*100).toFixed(1)}%`),statHtml('Shown sheet waste',`${((1-util)*100).toFixed(1)}%`)].join('');els.sheetIndicator.textContent=`Sheet ${state.sheetIndex+1} of ${result.sheets.length}`;els.prevSheetBtn.disabled=state.sheetIndex===0;els.nextSheetBtn.disabled=state.sheetIndex===result.sheets.length-1;renderPreview(current,settings);els.resultsPanel.scrollIntoView({behavior:'smooth',block:'start'});}
  function statHtml(label,value){return`<div class="stat"><small>${label}</small><strong>${value}</strong></div>`;}
  function renderPreview(sheet,s){const pad=Math.max(s.sheetW,s.sheetH)*.015;els.preview.setAttribute('viewBox',`${-pad} ${-pad} ${s.sheetW+2*pad} ${s.sheetH+2*pad}`);els.preview.replaceChildren();const sheetRect=svg('rect',{x:0,y:0,width:s.sheetW,height:s.sheetH,fill:'#fff',stroke:'#17212b','stroke-width':Math.max(s.sheetW,s.sheetH)/450});els.preview.appendChild(sheetRect);const palette=['#dce9ff','#e2f4ea','#fff0d4','#f1e4ff','#ffe1e1','#dff4f4','#ececec'];for(const p of sheet.placements){if(p.kind==='rect'){els.preview.appendChild(svg('rect',{x:p.x,y:p.y,width:p.w,height:p.h,fill:palette[p.typeIndex%palette.length],stroke:'#3a4754','stroke-width':Math.max(s.sheetW,s.sheetH)/900,'vector-effect':'non-scaling-stroke'}));}else{const pts=p.polygon.map(q=>`${q.x},${s.sheetH-q.y}`).join(' ');els.preview.appendChild(svg('polygon',{points:pts,fill:palette[p.typeIndex%palette.length],stroke:'#3a4754','stroke-width':Math.max(s.sheetW,s.sheetH)/900,'vector-effect':'non-scaling-stroke','fill-rule':'evenodd'}));}}}
  function svg(tag,attrs){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}

  // ---------- DXF export ----------
  function dxfHeader(units){const insunits=units==='in'?1:4;return['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70',String(insunits),'0','ENDSEC','0','SECTION','2','TABLES','0','ENDSEC','0','SECTION','2','ENTITIES'];}
  function rectDxf(p,xOffset){const y0=-p.y,y1=-(p.y+p.h),pts=[[p.x+xOffset,y0],[p.x+p.w+xOffset,y0],[p.x+p.w+xOffset,y1],[p.x+xOffset,y1]],out=['0','LWPOLYLINE','100','AcDbEntity','8','0','100','AcDbPolyline','90','4','70','1'];for(const q of pts)out.push('10',num(q[0]),'20',num(q[1]));return out;}
  function transformedPoint(x,y,p,xOffset){const file=p.file,o=p.orientation,local={x:x-file.baseMinX,y:y-file.baseMinY},r=rotatePoint(local,o.angle);return{x:r.x-o.rotMinX+p.x+xOffset,y:r.y-o.rotMinY+p.y};}
  function exportEntity(e,p,xOffset){
    if(e.type==='LINE'){const a=transformedPoint(e.x1,e.y1,p,xOffset),b=transformedPoint(e.x2,e.y2,p,xOffset);return['0','LINE','100','AcDbEntity','8','0','100','AcDbLine','10',num(a.x),'20',num(a.y),'30','0','11',num(b.x),'21',num(b.y),'31','0'];}
    if(e.type==='CIRCLE'){const c=transformedPoint(e.cx,e.cy,p,xOffset);return['0','CIRCLE','100','AcDbEntity','8','0','100','AcDbCircle','10',num(c.x),'20',num(c.y),'30','0','40',num(e.r)];}
    if(e.type==='ARC'){const c=transformedPoint(e.cx,e.cy,p,xOffset);return['0','ARC','100','AcDbEntity','8','0','100','AcDbCircle','10',num(c.x),'20',num(c.y),'30','0','40',num(e.r),'100','AcDbArc','50',num(normDeg(e.a0+p.orientation.angle)),'51',num(normDeg(e.a1+p.orientation.angle))];}
    if(e.type==='LWPOLYLINE'||e.type==='POLYLINE'){const out=['0','LWPOLYLINE','100','AcDbEntity','8','0','100','AcDbPolyline','90',String(e.vertices.length),'70',e.closed?'1':'0'];for(const v of e.vertices){const q=transformedPoint(v.x,v.y,p,xOffset);out.push('10',num(q.x),'20',num(q.y));if(Math.abs(v.bulge||0)>1e-12)out.push('42',num(v.bulge));}return out;}
    return[];
  }
  function normDeg(a){a%=360;if(a<0)a+=360;return a;}
  function buildDxf(sheets,s,allSheets){const lines=dxfHeader(s.units),sep=Math.max(s.margin,s.gap,s.sheetW*.05,1);sheets.forEach((sheet,index)=>{const xOffset=allSheets?index*(s.sheetW+sep):0;for(const p of sheet.placements){if(p.kind==='rect')lines.push(...rectDxf(p,xOffset));else for(const e of p.file.entities)lines.push(...exportEntity(e,p,xOffset));}});lines.push('0','ENDSEC','0','EOF');return lines.join('\r\n')+'\r\n';}
  function downloadText(filename,text){const blob=new Blob([text],{type:'application/dxf;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);}
  function exportCurrentSheet(){if(!state.result)return;downloadText(`sheet-${state.sheetIndex+1}.dxf`,buildDxf([state.result.sheets[state.sheetIndex]],state.settings,false));}
  function exportAllSheets(){if(!state.result)return;downloadText('all-sheets.dxf',buildDxf(state.result.sheets,state.settings,true));}

  function runNest(kind){clearError();els.statusPill.textContent='Calculating…';const btn=kind==='dxf'?els.nestDxfBtn:els.nestBtn;btn.disabled=true;requestAnimationFrame(()=>{try{const settings=kind==='dxf'?readDxfSettings():readRectSettings(),result=kind==='dxf'?nestDxf(settings):nestRectangles(settings);state.result=result;state.settings=settings;state.sheetIndex=0;els.statusPill.textContent='Nested';renderResults();}catch(e){showError(e instanceof Error?e.message:String(e));}finally{btn.disabled=false;}});}
  function showError(message){els.errorBox.textContent=message;els.errorBox.hidden=false;els.statusPill.textContent='Check inputs';}
  function clearError(){els.errorBox.hidden=true;els.errorBox.textContent='';}
  function hideResults(){els.resultsPanel.hidden=true;state.result=null;state.settings=null;state.sheetIndex=0;}
  function fmt(n){return Number.isInteger(n)?String(n):Number(n.toFixed(3)).toString();}
  function num(n){return Number((Math.abs(n)<1e-10?0:n).toFixed(8)).toString();}

  els.rectModeBtn.onclick=()=>switchMode('rect'); els.dxfModeBtn.onclick=()=>switchMode('dxf'); els.addPartBtn.onclick=()=>addPartRow(); els.clearPartsBtn.onclick=clearParts; els.exampleBtn.onclick=loadExample; els.nestBtn.onclick=()=>runNest('rect'); els.nestDxfBtn.onclick=()=>runNest('dxf');
  els.dxfFiles.onchange=e=>importDxfFiles(e.target.files); els.clearDxfBtn.onclick=()=>{state.imported=[];renderDxfList();hideResults();clearError();};
  els.prevSheetBtn.onclick=()=>{state.sheetIndex--;renderResults();}; els.nextSheetBtn.onclick=()=>{state.sheetIndex++;renderResults();}; els.exportSheetBtn.onclick=exportCurrentSheet; els.exportAllBtn.onclick=exportAllSheets;

  addPartRow({width:600,height:400,qty:4}); addPartRow({width:500,height:300,qty:6}); renderDxfList();
})();
