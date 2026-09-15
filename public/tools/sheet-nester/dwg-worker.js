/*
 * Sheet Nester DWG worker
 * Copyright (C) 2026 Sheet Nester contributors
 *
 * This worker integration is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * It loads @mlightcad/libredwg-web 0.7.10 / GNU LibreDWG, which is GPL-3.0.
 * See GPL-3.0.txt and THIRD_PARTY_NOTICES.md in this distribution.
 */
const LIBREDWG_VERSION = '0.7.10';
const CDN_MODULE = `https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@${LIBREDWG_VERSION}/dist/libredwg-web.js`;
let librePromise = null;

async function getLibreDwg() {
  if (!librePromise) {
    librePromise = (async () => {
      let mod;
      try {
        // Optional self-hosted copy. See THIRD_PARTY_NOTICES.md.
        mod = await import('./vendor/libredwg-web/dist/libredwg-web.js');
      } catch (_) {
        // Pinned upstream package from the public npm CDN.
        mod = await import(CDN_MODULE);
      }
      const libredwg = await mod.LibreDwg.create();
      return { libredwg, Dwg_File_Type: mod.Dwg_File_Type };
    })();
  }
  return librePromise;
}

const ignored = new Set([
  'TEXT','MTEXT','DIMENSION','LEADER','MULTILEADER','POINT','HATCH','TABLE','ACAD_TABLE',
  'IMAGE','ATTRIB','ATTDEF','VIEWPORT','TOLERANCE','RAY','XLINE'
]);
const rejected = new Set([
  'ELLIPSE','3DSOLID','SOLID','3DFACE','MLINE','SHAPE','PROXY_ENTITY','REGION','BODY','WIPEOUT','SECTION'
]);

const I = () => ({a:1,b:0,c:0,d:1,tx:0,ty:0});
const compose = (A,B) => ({
  a:A.a*B.a+A.c*B.b, b:A.b*B.a+A.d*B.b,
  c:A.a*B.c+A.c*B.d, d:A.b*B.c+A.d*B.d,
  tx:A.a*B.tx+A.c*B.ty+A.tx, ty:A.b*B.tx+A.d*B.ty+A.ty
});
const point = (t,p) => ({x:t.a*p.x+t.c*p.y+t.tx,y:t.b*p.x+t.d*p.y+t.ty,z:p.z||0});
const similarity = t => {
  const sx=Math.hypot(t.a,t.b), sy=Math.hypot(t.c,t.d), dot=t.a*t.c+t.b*t.d, det=t.a*t.d-t.b*t.c;
  return {ok:sx>1e-12&&Math.abs(sx-sy)<=1e-7*Math.max(sx,sy,1)&&Math.abs(dot)<=1e-7*Math.max(sx*sy,1)&&det>0,
    scale:(sx+sy)/2, rot:Math.atan2(t.b,t.a)*180/Math.PI};
};

function toInternal(e, t, unsupported) {
  const ext = e.extrusionDirection;
  if (ext && Number.isFinite(ext.z) && ext.z < -0.5) {
    unsupported.add('negative-extrusion geometry');
    return null;
  }
  if (e.type === 'LINE') {
    const a=point(t,e.startPoint), b=point(t,e.endPoint);
    return {type:'LINE',x1:a.x,y1:a.y,x2:b.x,y2:b.y};
  }
  if (e.type === 'SPLINE') {
    return {type:'SPLINE',degree:e.degree,flags:e.flag||0,knots:[...(e.knots||[])],
      weights:e.weights?.length?[...e.weights]:new Array((e.controlPoints||[]).length).fill(1),
      controls:(e.controlPoints||[]).map(p=>point(t,p)),fits:(e.fitPoints||[]).map(p=>point(t,p))};
  }
  if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE2D') {
    return {type:e.type==='LWPOLYLINE'?'LWPOLYLINE':'POLYLINE',
      vertices:(e.vertices||[]).map(v=>{const q=point(t,v);return{x:q.x,y:q.y,bulge:v.bulge||0};}),
      closed:e.type==='LWPOLYLINE'?!!((e.flag||0)&(512|1)):!!((e.flag||0)&1)};
  }
  const sim=similarity(t);
  if ((e.type==='ARC'||e.type==='CIRCLE') && !sim.ok) {
    unsupported.add('non-uniform/reflected block curve transform'); return null;
  }
  if (e.type === 'CIRCLE') {
    const c=point(t,e.center); return {type:'CIRCLE',cx:c.x,cy:c.y,r:Math.abs(e.radius)*sim.scale};
  }
  if (e.type === 'ARC') {
    const c=point(t,e.center); return {type:'ARC',cx:c.x,cy:c.y,r:Math.abs(e.radius)*sim.scale,
      a0:e.startAngle*180/Math.PI+sim.rot,a1:e.endAngle*180/Math.PI+sim.rot};
  }
  return null;
}

function expandEntities(source, blockMap, parent, unsupported, depth=0) {
  if (depth > 12) throw new Error('DWG block nesting is too deep.');
  const out=[];
  for (const e of source || []) {
    if (e.type === 'INSERT') {
      const block=blockMap.get(e.name);
      if (!block) { unsupported.add(`INSERT(${e.name||'unnamed'})`); continue; }
      const sx=Number.isFinite(e.xScale)?e.xScale:1, sy=Number.isFinite(e.yScale)?e.yScale:1;
      if (sx<=0 || sy<=0 || Math.abs(sx-sy)>1e-9*Math.max(Math.abs(sx),Math.abs(sy),1)) {
        unsupported.add('non-uniform/reflected INSERT scale'); continue;
      }
      const rot=e.rotation||0,c=Math.cos(rot),s=Math.sin(rot), cols=Math.max(1,Math.round(e.columnCount||1)), rows=Math.max(1,Math.round(e.rowCount||1));
      const base=block.basePoint||{x:0,y:0}, ins=e.insertionPoint||{x:0,y:0};
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const ox=col*(e.columnSpacing||0)-base.x, oy=row*(e.rowSpacing||0)-base.y;
        const local={a:c*sx,b:s*sx,c:-s*sy,d:c*sy,
          tx:ins.x+(c*sx)*ox+(-s*sy)*oy,ty:ins.y+(s*sx)*ox+(c*sy)*oy};
        out.push(...expandEntities(block.entities,blockMap,compose(parent,local),unsupported,depth+1));
      }
      continue;
    }
    if (['LINE','ARC','CIRCLE','LWPOLYLINE','POLYLINE2D','SPLINE'].includes(e.type)) {
      const q=toInternal(e,parent,unsupported); if(q)out.push(q); continue;
    }
    if (rejected.has(e.type)) unsupported.add(e.type);
    else if (!ignored.has(e.type) && e.type) unsupported.add(e.type);
  }
  return out;
}

function modelSpaceBlock(db) {
  const entries=db?.tables?.BLOCK_RECORD?.entries||[];
  return entries.find(b=>/^\*?model[_ ]space$/i.test(String(b.name||'')))
      || entries.find(b=>/model[_ ]space/i.test(String(b.name||'')));
}

async function parseDwgFile(arrayBuffer, name) {
  const {libredwg,Dwg_File_Type}=await getLibreDwg();
  let raw;
  try {
    raw=libredwg.dwg_read_data(arrayBuffer,Dwg_File_Type.DWG);
    if(!raw)throw new Error('LibreDWG could not decode this DWG.');
    const db=libredwg.convert(raw);
    const blocks=db?.tables?.BLOCK_RECORD?.entries||[];
    const blockMap=new Map(blocks.map(b=>[b.name,b]));
    const model=modelSpaceBlock(db);
    const source=model?.entities || db?.entities || [];
    const unsupported=new Set();
    const entities=expandEntities(source,blockMap,I(),unsupported,0);
    if(unsupported.size)throw new Error(`${name}: unsupported design entit${unsupported.size===1?'y':'ies'} ${[...unsupported].join(', ')}. File rejected so geometry is not silently altered.`);
    if(!entities.length)throw new Error(`${name}: no supported 2D cutting geometry found in model space.`);
    return {entities, decoder:`LibreDWG Web ${LIBREDWG_VERSION}`};
  } finally {
    if(raw)try{libredwg.dwg_free(raw);}catch(_){ }
  }
}


self.onmessage = async (event) => {
  const {id, arrayBuffer, name} = event.data || {};
  try {
    const result = await parseDwgFile(arrayBuffer, name || 'drawing.dwg');
    self.postMessage({id, ok:true, result});
  } catch (error) {
    self.postMessage({id, ok:false, error:error?.message || String(error)});
  }
};
