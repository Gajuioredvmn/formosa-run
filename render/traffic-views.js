/* Complete directional HD-2D traffic. A vehicle retains its physical length,
 * width, ground contact and identity across rear/quarter/side/front artwork. */
(function(global){
  'use strict';
  let api;const materials=new Map(),cache=new Map();
  const heights={sedan:1.55,taxi:1.65,suv:1.95,wagon:1.85,pickup:1.9,bluetruck:2.2,bus:3.4,gravel:3.5,rebar:3.5,logs:3.5,semi:3.8,flatbed:3.6,tanker:3.6,scooter:1.72,motorbike:1.78};
  const order=['rear','rearQuarter','side','frontQuarter','front'];
  const boundaries=[.20,1.12,2.02,Math.PI-.20];
  const state={ready:false,frames:0,hits:0,last:null};
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function material(type,view,canvas,lights=[]){
    if(!order.includes(view))return;
    const g=canvas.getContext('2d'),d=g.getImageData(0,0,canvas.width,canvas.height).data;
    let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(d[(y*canvas.width+x)*4+3]>=128){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    if(x1<x0)return;const c=document.createElement('canvas');c.width=x1-x0+1;c.height=y1-y0+1;c.getContext('2d').drawImage(canvas,x0,y0,c.width,c.height,0,0,c.width,c.height);
    const set=materials.get(type)||{};set[view]={canvas:c,lights:lights.map(q=>[q[0]-x0,q[1]-y0,q[2],q[3]])};materials.set(type,set);
  }
  function configure(value){api=value;cache.clear();state.ready=true;}
  function choose(angle,previous){
    const a=Math.abs(wrap(angle));let band=boundaries.findIndex(b=>a<b);if(band<0)band=4;
    if(previous!=null&&Math.abs(previous-band)===1){const boundary=boundaries[Math.min(previous,band)];if(Math.abs(a-boundary)<.035)band=previous;}
    return{band,view:order[band],flip:angle<0&&band>0&&band<4};
  }
  function frame(type,angle,previous){
    if(!api||!api.types[type])return null;
    const a=wrap(angle),choice=choose(a,previous),set=materials.get(type);if(!set)return null;
    const art=set[choice.view]||set.side||set.rear;if(!art)return null;
    const key=type+':'+choice.view;let base=cache.get(key);
    if(!base){const c=art.canvas;base={name:'traffic_'+key,x:0,y:0,w:c.width,h:c.height,wh:heights[type],ax:.5,ay:1,page:{lv:api.mips(c),hz:[]},lights:art.lights};cache.set(key,base);state.frames++;}else state.hits++;
    const t=api.types[type],height=base.wh+Math.min(t.len,6)*.10*Math.abs(Math.sin(a));
    // Keep the authored aspect ratio: forcing a long vehicle's collider width
    // onto a perspective painting flattened its tyres and stretched its cab.
    const worldWidth=height*base.w/base.h;
    const meta={type,angle:a,band:choice.band,view:choice.view,front:choice.band>=3,length:t.len,width:t.wid,complete:order.every(v=>set[v]),physicalProjectedWidth:t.wid*Math.abs(Math.cos(a))+t.len*Math.abs(Math.sin(a))};state.last=meta;
    return{...base,wh:height,flip:choice.flip,worldWidth,meta:{lights:base.lights,directional:meta}};
  }
  function haze(sprite,level,hex){
    const p=sprite.page;if(p.hazeCol!==hex){p.hz=[];p.hazeCol=hex;}
    if(!p.hz[level]){const src=p.lv[level],c=document.createElement('canvas');c.width=src.width;c.height=src.height;const g=c.getContext('2d');g.drawImage(src,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#'+hex.toString(16).padStart(6,'0');g.fillRect(0,0,c.width,c.height);p.hz[level]=c;}
  }
  global.FormosaTrafficViews={configure,material,frame,choose,haze,state};
})(typeof window!=='undefined'?window:globalThis);
