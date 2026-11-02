/* Complete directional HD-2D traffic. A vehicle retains its physical length,
 * width, ground contact and identity across rear/quarter/side/front artwork. */
(function(global){
  'use strict';
  let api;const materials=new Map(),cache=new Map();
  const heights={sedan:1.55,taxi:1.65,suv:1.95,wagon:1.85,pickup:1.9,bluetruck:2.2,bus:3.4,gravel:3.5,rebar:3.5,logs:3.5,semi:3.8,flatbed:3.6,tanker:3.6,scooter:1.72,motorbike:1.78};
  const order=['rear','rearQuarter','side','frontQuarter','front'];
  const boundaries=[.20,1.12,2.02,Math.PI-.20];
  // The paintings use a higher camera than the road. These tyre windows are
  // measured in the cropped artwork; the lowest opaque tyre pixels become
  // support points, not the bottom of the bumper or a shared sprite baseline.
  const axleWindows={
    rearQuarter:{sedan:[.035,.59,.94],taxi:[.04,.57,.92],suv:[.04,.59,.94],wagon:[.04,.58,.92],pickup:[.04,.59,.93],bluetruck:[.10,.55,.91],bus:[.10,.56,.88],gravel:[.09,.52,.92],rebar:[.08,.46,.92],logs:[.09,.47,.92],semi:[.08,.43,.91],flatbed:[.10,.48,.90],tanker:[.08,.47,.91]},
    frontQuarter:{sedan:[.07,.40,.94],taxi:[.07,.37,.92],suv:[.08,.36,.93],wagon:[.08,.36,.93],pickup:[.08,.39,.93],bluetruck:[.08,.42,.93],bus:[.10,.40,.92],gravel:[.08,.40,.92],rebar:[.09,.48,.93],logs:[.08,.48,.93],semi:[.08,.45,.93],flatbed:[.08,.45,.93],tanker:[.08,.47,.93]}
  };
  function tyrePoint(d,w,h,u,radius=.045){
    const lo=Math.max(0,Math.floor((u-radius)*w)),hi=Math.min(w-1,Math.ceil((u+radius)*w));let bottom=-1,columns=[];
    for(let x=lo;x<=hi;x++){let y=h-1;for(;y>=h*.48;y--){const i=(y*w+x)*4;if(d[i+3]>=192&&Math.max(d[i],d[i+1],d[i+2])<150)break;}if(y>=h*.48){if(y>bottom){bottom=y;columns=[x];}else if(y===bottom)columns.push(x);}}
    if(bottom<0)throw Error('Traffic tyre support missing');
    return{u:(columns[Math.floor(columns.length/2)]+.5)/w,v:(bottom+1)/h};
  }
  function supports(type,view,c){
    const w=c.width,h=c.height,d=c.getContext('2d').getImageData(0,0,w,h).data,bike=type==='scooter'||type==='motorbike';
    const point=(u,s,l,r)=>({...tyrePoint(d,w,h,u,r),s,l});
    if(bike&&(view==='rear'||view==='front'))return[point(.5,view==='rear'?-.34:.34,0,.20)];
    if(view==='rear')return[point(.14,-.34,-.42,.10),point(.86,-.34,.42,.10)];
    if(view==='front')return[point(.14,.34,.42,.10),point(.86,.34,-.42,.10)];
    if(view==='side')return[point(bike?.22:.20,-.34,bike?0:.42,.08),point(bike?.80:.82,.34,bike?0:.42,.08)];
    const us=axleWindows[view]?.[type];
    if(bike)return view==='rearQuarter'?[point(.27,-.34,0,.10),point(.85,.34,0,.08)]:[point(.15,-.34,0,.08),point(.65,.34,0,.10)];
    return view==='rearQuarter'?[point(us[0],-.34,-.42,.025),point(us[1],-.34,.42),point(us[2],.34,.42)]:[point(us[0],-.34,.42,.025),point(us[1],.34,.42),point(us[2],.34,-.42,.025)];
  }
  const state={ready:false,frames:0,hits:0,last:null};
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function material(type,view,canvas,lights=[]){
    if(!order.includes(view))return;
    const g=canvas.getContext('2d'),d=g.getImageData(0,0,canvas.width,canvas.height).data;
    let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(d[(y*canvas.width+x)*4+3]>=128){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    if(x1<x0)return;const c=document.createElement('canvas');c.width=x1-x0+1;c.height=y1-y0+1;c.getContext('2d').drawImage(canvas,x0,y0,c.width,c.height,0,0,c.width,c.height);
    const set=materials.get(type)||{};set[view]={canvas:c,supports:supports(type,view,c),lights:lights.map(q=>[q[0]-x0,q[1]-y0,q[2],q[3]])};materials.set(type,set);
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
    if(!base){const c=art.canvas;base={name:'traffic_'+key,x:0,y:0,w:c.width,h:c.height,wh:heights[type],ax:.5,ay:1,page:{lv:api.mips(c),hz:[]},lights:art.lights,supports:art.supports};cache.set(key,base);state.frames++;}else state.hits++;
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
  function groundRig(sprite,k,project){
    const view=sprite.meta.directional.view,side=sprite.flip?-1:1;
    const centre=project(0,0);if(!centre)return null;
    const scale=sprite.wh*k/sprite.h;
    // Retain the painted width and round tyres. A collider's length must not
    // stretch a short painted bus into an accordion when its side is visible.
    const contacts=sprite.supports.map(q=>{const x=centre.x+side*(q.u-.5)*sprite.w*scale,p=project(q.s,q.l*side,x);return{...q,screen:p?{...p,x}:null};});
    if(contacts.some(q=>!q.screen))return null;
    const sy=scale,strips=[];
    if(contacts.length===1){const a=contacts[0];strips.push({u0:0,u1:1,xx:sy,xy:0,sy,tx:a.screen.x-sy*a.u*sprite.w,ty:a.screen.y-sy*a.v*sprite.h});return{strips,contacts,view};}
    for(let i=0;i<contacts.length-1;i++){
      const a=contacts[i],b=contacts[i+1],dx=(b.u-a.u)*sprite.w;
      if(dx<1)return null;
      const xx=(b.screen.x-a.screen.x)/dx,xy=(b.screen.y-a.screen.y-sy*(b.v-a.v)*sprite.h)/dx;
      if(Math.abs(xx)<.00001||Math.sign(xx)!==(sprite.flip?-1:1))return null;
      strips.push({u0:i? a.u:0,u1:i===contacts.length-2?1:b.u,xx,xy,sy,tx:a.screen.x-xx*a.u*sprite.w,ty:a.screen.y-xy*a.u*sprite.w-sy*a.v*sprite.h});
    }
    return{strips,contacts,view};
  }
  function groundPoint(sprite,rig,u,v){
    const t=rig.strips.find(q=>u<=q.u1)||rig.strips.at(-1),x=u*sprite.w,y=v*sprite.h;
    return{x:t.xx*x+t.tx,y:t.xy*x+t.sy*y+t.ty};
  }
  global.FormosaTrafficViews={configure,material,frame,choose,haze,groundRig,groundPoint,state};
})(typeof window!=='undefined'?window:globalThis);
