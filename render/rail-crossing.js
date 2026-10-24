/* Jiji arcade crossing: the original asphalt carriageway divides into a
 * raised local street and a lower through-road. Both meet the SAME transverse
 * railway: the local street at grade, the through-road below a supported deck.
 * This is a fictional arcade junction, not a claim about a real Jiji crossing.
 * No steering, acceleration, grip or original road-distance constants change. */
(function(global){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const state={image:null,bounds:null,warning:null};
  const base=typeof document!=='undefined'?new URL('../assets/pixel/jiji-train-side-v1.png',document.currentScript.src).href:'';
  async function loadAssets(){if(!base)return;try{const im=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=base;});const cv=document.createElement('canvas');cv.width=im.naturalWidth;cv.height=im.naturalHeight;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);const d=g.getImageData(0,0,cv.width,cv.height).data;let x0=cv.width,y0=cv.height,x1=0,y1=0;for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(d[(y*cv.width+x)*4+3]>=96){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}state.image=im;state.bounds=[x0,y0,x1-x0+1,y1-y0+1];}catch{state.warning='Jiji side art unavailable';}}
  function drawTrain(g,q,l,r){if(!state.image||!l||!r)return false;const [sx,sy,sw,sh]=state.bounds,parts=32,worldH=q.len*sh/sw;
    // The track is a world-space cross section, so its far end can be higher
    // on screen. Slicing follows BOTH projected wheel-contact endpoints; a
    // single screen-aligned rectangle made the train float above the deck.
    for(let i=0;i<parts;i++){const a=i/parts,b=(i+1)/parts,u=(a+b)*.5,x=l.x+(r.x-l.x)*a,w=(r.x-l.x)/parts,base=l.y+(r.y-l.y)*u,h=worldH*(l.k+(r.k-l.k)*u);g.drawImage(state.image,sx+sw*a,sy,sw/parts,sh,x,base-h,w+.35,h);}
    return true;
  }
  function registerSprites(api){for(const [name,title,line,col] of [['rail-detour','前方鐵路平交道','右側地下道 →',0x174f42],['rail-underpass','地下道　淨高4.6m','右側持續通行 →',0x154d82]]){const p=new api.Pix(240,108);p.rect(118,74,5,34,0xc4c7bb);p.rect(0,0,240,76,0xeae9d6);p.rect(3,3,234,70,col);p.text(title,120,9,20,0xfff6c9,{align:'center',maxW:226});p.text(line,120,40,19,0xffffff,{align:'center',maxW:224});api.addSprite(name,p,4.3,{collide:0,shadow:.15});}
    if(state.image){const h=92,w=Math.round(h*state.bounds[2]/state.bounds[3]),cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(state.image,...state.bounds,0,0,w,h);const p=new api.Pix(w,h);p.d.set(g.getImageData(0,0,w,h).data);api.addSprite('jijitrain',p,3.4,{collide:0,shadow:.2});}
  }
  function create(p){const j=p.secs?.findIndex(sec=>sec.L==='orchard'&&sec.R==='orchard'),s=j>=0?p.secStartS[j]+260:1640;
    // A one-lane local ramp branches off on the left. The main road's centre
    // stays in the through underpass; a divider at x=0 trapped the default
    // chase camera against a 5.2m retaining wall.
    let innerLeft=-Infinity;for(let at=s-180;at<=s+180;at+=4)innerLeft=Math.max(innerLeft,p.leftEdge(at));
    const axis=innerLeft+4.4;
    return {kind:'jijiCrossing',p,s,axis,start:s-180,end:s+180,divideStart:s-156,divideEnd:s+156,height:5.2,len:32,speed:12,period:22,t:0,on:false,warnOn:false,closed:false,gate:0,x:-70,bellT:0,notice:false};}
  function configure(D){if(D.p.id!=='s4b')return null;const q=create(D.p);D.p.railCrossing=q;
    // Remove only scenery whose old footprint would lie inside the embankment.
    for(const sg of [-1,1])D.gap(q.start-6,q.end+6,sg);
    D.gap(q.s-324,q.s-296,1);D.gap(q.start-38,q.start-10,1);
    D.p.wires=D.p.wires.filter(w=>w.s1<q.start-8||w.s>q.end+8);
    const pier=q.p.rightEdge(q.s)+1.4;D.collide(q.s,pier-.225,.525,2.8,'solid');
    D.spr('rail-detour',q.s-310,D.lat(q.s-310,1,.8),{collide:false,landmark:true,flip:false});
    D.spr('rail-underpass',q.start-24,D.lat(q.start-24,1,.8),{collide:false,landmark:true,flip:false});
    return q;
  }
  function ramp(q,s){const d=Math.abs(s-q.s);return q.height*(1-smooth((d-28)/152));}
  function height(p,s,x){const q=p?.railCrossing;return q&&x<q.axis-.4&&s>q.start&&s<q.end?ramp(q,s):0;}
  function grade(p,s,x){return (height(p,s+3,x)-height(p,s-3,x))/6;}
  function update(q,time){
    const t=((time%q.period)+q.period)%q.period;q.t=t;
    // Three seconds of red lamps before either gate moves. The train cannot
    // enter the street until the entrance and exit gates have fully lowered.
    q.warnOn=t<13.4;q.gate=t<3?0:t<4.4?smooth((t-3)/1.4):t<12?1:t<13.4?1-smooth((t-12)/1.4):0;
    q.closed=t>=3.7&&t<12.8;q.on=t>=5&&t<12;
    q.x=q.on?-48+(t-5)*q.speed:-70;
    return q;
  }
  function blocks(q,s,len,reserve){const r=[];if(!q)return r;const h=len/2;
    if(s+h>q.divideStart&&s-h<q.divideEnd)r.push([q.axis-.44,q.axis+.44]);
    if((reserve||q.closed)&&Math.abs(s-(q.s-7))<h+1.2)r.push([-30,q.axis+.44]);
    return r;
  }
  function rows(q){if(!q)return[];const r=[q.divideStart,q.divideEnd,q.s-9,q.s-7,q.s-5];
    // A sparse 60m route sample can falsely interpolate through a continuous
    // median. At 8m the planner's .24 lateral slope cannot jump the expanded
    // wall, so its two sides remain separate until the actual merge.
    for(let s=q.divideStart;s<q.divideEnd;s+=8)r.push(s);return r;
  }
  function constrain(q,body,previous,halfLength,halfWidth){
    if(!q)return null;let contact=null;
    // The retaining wall has two faces. Keep the vehicle on the face it
    // approached, so a scrape never snaps a car between different elevations.
    if(body.s+halfLength>q.divideStart&&body.s-halfLength<q.divideEnd&&Math.abs(body.x-q.axis)<.44+halfWidth){
      const side=previous.x<q.axis?-1:1;body.x=q.axis+side*(.44+halfWidth+.025);body.vx=side*Math.max(0,side*(body.vx||0));contact='divider';
    }
    const stop=q.s-7-halfLength-.12;
    if(q.closed&&body.x-halfWidth<q.axis+.44&&previous.s<=stop+.08&&body.s>=stop){body.s=stop;body.v=0;body.vx=0;contact='gate';}
    // A late lateral impact cannot push a car from the underpass onto a train.
    if(q.on&&body.x<q.axis-.4&&Math.abs(body.s-q.s)<halfLength+1.8&&body.x+halfWidth>q.axis+q.x&&body.x-halfWidth<q.axis+q.x+q.len){body.s=Math.min(body.s,stop);body.v=0;body.vx=0;contact='train';}
    return contact;
  }
  function drawStrip(g,q,s0,s1,project,clip){
    if(!q||s1<q.start||s0>q.end)return;
    const a=Math.max(s0-.06,q.start),b=Math.min(s1+.06,q.end),left=s=>q.p.leftEdge(s)-q.axis,P=(s,x,y)=>project(s,x+q.axis,y);
    const poly=(v,c)=>{const p=v.map(v=>P(...v));if(p.some(p=>!p))return;g.fillStyle=c;g.beginPath();p.forEach((p,i)=>i?g.lineTo(Math.round(p.x),Math.round(p.y)):g.moveTo(Math.round(p.x),Math.round(p.y)));g.closePath();g.fill();};
    g.save();g.beginPath();g.rect(0,0,16384,clip);g.clip();
    // A real raised asphalt surface and its retaining wall, with a level
    // through-road to the right. The two ramps start/end at the original road.
    const ha=ramp(q,a),hb=ramp(q,b);
    poly([[a,left(a),ha],[b,left(b),hb],[b,left(b)-18,hb],[a,left(a)-18,ha]],'#6e9545');
    poly([[a,left(a)-18,ha],[b,left(b)-18,hb],[b,left(b)-29,0],[a,left(a)-29,0]],'#507739');
    poly([[a,left(a),ha],[b,left(b),hb],[b,-.44,hb],[a,-.44,ha]],'#56616e');
    for(let s=Math.floor(a/2)*2;s<b;s+=2){const u=Math.max(a,s),v=Math.min(b,s+2);if(v<=u)continue;const hu=ramp(q,u)+.012,hv=ramp(q,v)+.012;
      for(let x=Math.ceil(Math.max(left(u),left(v)));x<-.9;x+=.6){const n=Math.abs(Math.sin(s*12.7+x*73.4)*43758)%1,col=['#53606d','#5c6873','#596570','#63707b'][Math.floor(n*4)];poly([[u,x,hu],[v,x,hv],[v,x+.54,hv],[u,x+.54,hu]],col);}
      if(Math.floor(s/8)%2===0){const x=(left(u)-.44)/2;poly([[u,x-.065,hu+.025],[v,x-.065,hv+.025],[v,x+.065,hv+.025],[u,x+.065,hu+.025]],'#f2eddd');}
    }
    poly([[a,-.44,0],[b,-.44,0],[b,-.44,hb],[a,-.44,ha]],'#9a9384');
    for(let y=1;y<Math.min(ha,hb);y+=1.1)poly([[a,-.435,y],[b,-.435,y],[b,-.435,y+.035],[a,-.435,y+.035]],'#847e71');
    for(const x of [-.6])poly([[a,x-.07,ha+.02],[b,x-.07,hb+.02],[b,x+.07,hb+.02],[a,x+.07,ha+.02]],'#efe7c3');
    poly([[a,left(a)+.15,ha+.02],[b,left(b)+.15,hb+.02],[b,left(b)+.29,hb+.02],[a,left(a)+.29,ha+.02]],'#f2eddd');
    if(a>=q.divideStart&&b<=q.divideEnd){poly([[a,-.44,ha+.5],[b,-.44,hb+.5],[b,.44,hb+.5],[a,.44,ha+.5]],'#d4cbb6');poly([[a,.44,0],[b,.44,0],[b,.44,hb+.5],[a,.44,ha+.5]],'#aaa38e');
      for(let y=.75;y<Math.min(ha,hb);y+=.85)poly([[a,.445,y],[b,.445,y],[b,.445,y+.035],[a,.445,y+.035]],'#928b78');
      // Concrete panel joints, a darker drainage plinth and retroreflectors
      // make this a supported road structure rather than a featureless slab.
      poly([[a,.448,.08],[b,.448,.08],[b,.448,Math.min(.42,hb+.4)],[a,.448,Math.min(.42,ha+.4)]],'#747f79');
      for(let s=Math.ceil(a/6)*6;s<b;s+=6){const end=Math.min(b,s+.065),h0=ramp(q,s)+.48,h1=ramp(q,end)+.48;poly([[s,.45,.12],[end,.45,.12],[end,.45,h1],[s,.45,h0]],'#878678');
        if(h0>1.1){const v=Math.min(b,s+.28);poly([[s,.46,.84],[v,.46,.84],[v,.46,1.04],[s,.46,1.04]],'#f2c745');}
      }
    }
    // Yellow cross-hatching is confined to the level crossing, never rails
    // down the racing road. Both steel rails run ACROSS the asphalt.
    if(a<q.s+3&&b>q.s-3){const x0=left(a),h=q.height;
      poly([[Math.max(a,q.s-3),x0,h+.025],[Math.min(b,q.s+3),x0,h+.025],[Math.min(b,q.s+3),-.44,h+.025],[Math.max(a,q.s-3),-.44,h+.025]],'#a9a18c');
    }
    if(a<q.s+9&&b>q.s-2){const u=Math.max(a,q.s-2),v=Math.min(b,q.s+9);poly([[u,.44,.015],[v,.44,.015],[v,q.p.rightEdge(v)-q.axis,.015],[u,q.p.rightEdge(u)-q.axis,.015]],'rgba(12,30,55,.29)');}
    g.restore();
  }
  function drawJunction(g,q,project,clip,drawTrain){
    if(!q)return;const objects=[],s=q.s,h=q.height,right=q.p.rightEdge(s)+1.4-q.axis,left=q.p.leftEdge(s)-18-q.axis,worldProject=project;
    project=(s,x,y)=>worldProject(s,x+q.axis,y);
    const face=(points,col)=>objects.push({points,col});
    const box=(s0,s1,x0,x1,y0,y1,c)=>{face([[s0,x0,y1],[s1,x0,y1],[s1,x1,y1],[s0,x1,y1]],c);face([[s0,x0,y0],[s0,x1,y0],[s0,x1,y1],[s0,x0,y1]],'#7d807c');face([[s0,x1,y0],[s1,x1,y0],[s1,x1,y1],[s0,x1,y1]],'#666f71');};
    // Independent bridge piers outside the right traffic channel; minimum
    // under-deck clearance 4.6m, sufficient for every game vehicle.
    box(s-2.3,s+2.3,-.48,right,h-.48,h,'#c8c5b7');
    box(s-2.8,s+2.8,-.48,.44,0,h-.48,'#aba695');
    box(s-2.8,s+2.8,right-.75,right+.3,0,h-.48,'#b9b3a0');
    box(s-2.1,s+2.1,left,-.48,h-.3,h,'#8b8071');
    for(let x=left;x<right+10;x+=.8)box(s-1.28,s+1.28,x,x+.22,h,h+.09,'#524337');
    for(const ds of [-.72,.72])box(s+ds-.065,s+ds+.065,left,right+10,h+.09,h+.17,'#e0e7e8');
    // Raised rails continue into a wooded embankment at both ends.
    face([[s-2.5,right+.3,h-.1],[s+2.5,right+.3,h-.1],[s+2.5,right+18,h-.1],[s-2.5,right+18,h-.1]],'#849452');
    face([[s-2.5,right+.3,h-.1],[s-2.5,right+18,h-.1],[s-11,right+24,0],[s-11,right+.3,0]],'#657c47');
    const lamps=[];
    for(const ds of [-7,7])for(const x of [q.p.leftEdge(s)-q.axis-.15,-.65]){
      box(s+ds-.13,s+ds+.13,x-.12,x+.12,h,h+3,'#e4d7a2');
      box(s+ds-.16,s+ds+.16,x-.7,x+.7,h+2.5,h+3.15,'#252c35');
      face([[s+ds-.17,x-.55,h+3.75],[s+ds-.17,x-.4,h+3.88],[s+ds-.17,x+.55,h+3.25],[s+ds-.17,x+.4,h+3.12]],'#f8f0d4');
      face([[s+ds-.18,x-.55,h+3.25],[s+ds-.18,x-.4,h+3.12],[s+ds-.18,x+.55,h+3.75],[s+ds-.18,x+.4,h+3.88]],'#f8f0d4');
      lamps.push([s+ds,x-.36,h+2.8],[s+ds,x+.36,h+2.8]);
      const inside=x< -2?1:-1,L=(q.axis-q.p.leftEdge(s)-.8)/2,ang=(1-q.gate)*Math.PI*.5;
      const xa=x+inside*Math.cos(ang)*L,ya=h+1.05+Math.sin(ang)*L;
      face([[s+ds-.09,x,h+.95],[s+ds+.09,xa,ya-.1],[s+ds+.09,xa,ya+.1],[s+ds-.09,x,h+1.15]],'#f2ead2');
      for(let j=1;j<6;j+=2){const t=j/6,u=(j+1)/6;face([[s+ds-.1,x+(xa-x)*t,h+1+(ya-h-1)*t],[s+ds-.1,x+(xa-x)*u,h+1+(ya-h-1)*u],[s+ds-.1,x+(xa-x)*u,h+1.16+(ya-h-1)*u],[s+ds-.1,x+(xa-x)*t,h+1.16+(ya-h-1)*t]],'#d44833');}
    }
    g.save();g.beginPath();g.rect(0,0,16384,clip);g.clip();
    const mapped=objects.map(o=>({...o,p:o.points.map(v=>project(...v))})).filter(o=>o.p.every(Boolean));mapped.sort((a,b)=>b.p.reduce((n,p)=>n+p.cz,0)-a.p.reduce((n,p)=>n+p.cz,0));
    let trainDrawn=false;const train=()=>{if(q.on&&!trainDrawn){drawTrain(q,project(s,q.x,h+.17),project(s,q.x+q.len,h+.17));trainDrawn=true;}};
    for(const o of mapped){if(o.points.every(v=>v[0]<s-3))train();g.fillStyle=o.col;g.beginPath();o.p.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fill();}
    train();
    lamps.forEach((v,i)=>{const p=project(...v);if(!p)return;g.fillStyle=q.warnOn&&(Math.floor(q.t*3)%2===i%2)?'#ff392e':'#4b2724';g.fillRect(p.x-.16*p.k,p.y-.16*p.k,Math.max(1,.32*p.k),Math.max(1,.32*p.k));});
    g.restore();
  }
  global.FormosaRailCrossing={state,loadAssets,drawTrain,create,configure,registerSprites,ramp,height,grade,update,blocks,rows,constrain,drawStrip,drawJunction};
})(window);
