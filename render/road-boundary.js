/* Visible racing-road limits, added after all landmark clearings. The same
 * records position each barrier and resolve car contact; water/fields are
 * scenery, never a second driveable carriageway. */
(function(global){
  'use strict';
  const wet=new Set(['water','river','riverbed','lake','fishpond','milkfish','mudflat','salt','shore','cliff','gorge','beach','bay','pebble']);
  const crops=new Set(['farm','paddy','orchard','tea','pineapple','daylily','cabbage','cane']);
  const rails=new Set(['rail_guard','rail_concrete','rail_balustrade','rail_railing','rail_parapet','rail_stonewall','rail_cutwall']);
  // Keep a constant curb offset across biomes: the rail must not suddenly
  // move several metres inward when a town gives way to rice fields.
  function style(type){if(type==='harbor')return{kind:'railing',off:.2,height:1};if(['city','town','plaza','industrial'].includes(type))return{kind:'railing',off:.2,height:1};if(crops.has(type)||type==='cut'||type==='slope')return{kind:'concrete',off:.2,height:.8};return{kind:'guard',off:.2,height:.8};}
  function edge(p,s,sg){return sg<0?p.leftEdge(s):p.rightEdge(s);}
  function sharedInner(p,s,sg){return p.innerFree&&sg===-p.side&&p.innerFree[Math.round(Math.max(0,Math.min(p.L,s))/2)]<.6;}
  const passageWidth=1.45;
  const dry=new Set(['city','town','plaza','harbor','industrial','grass','farm','paddy','orchard','tea','pineapple','daylily','cabbage','cane','hills','mountain','forest','highland']);
  function safePassage(p,s){
    if(!p.secs||s<35||s>p.L-45)return false;
    const sec=p.sec(s);
    if(!dry.has(sec.L)||!dry.has(sec.R)||sec.track||sec.bridge||sec.fork||sec.diverge||sec.parallelRail)return false;
    if(p.sec(s-3)!==sec||p.sec(s+3)!==sec)return false;
    if(p.railCrossing&&Math.abs(p.railCrossing.s-s)<180)return false;
    if(p.innerFree&&p.innerFree[Math.round(s/2)]<8)return false;
    if((p.gaps||[]).some(g=>s>g[0]-3&&s<g[1]+3))return false;
    return !(p.walls||[]).some(w=>w.h>1.4&&w.off<3.5&&w.s0<s+2&&w.s1>s-2);
  }
  function configurePassages(p){
    p.roadCrossings=[];
    function add(target,kind){
      for(let d=0;d<=100;d+=4)for(const dir of d?[1,-1]:[1]){
        const s=target+d*dir;
        if(!safePassage(p,s)||p.roadCrossings.some(q=>Math.abs(q.s-s)<5))continue;
        const q={s,width:passageWidth,kind};p.roadCrossings.push(q);return q;
      }return null;
    }
    for(const q of global.FormosaRoadEvents?.configure(p)||[]){
      if(!['cow','boar'].includes(q.kind))continue;
      q.crossings=[];
      for(let i=0;i<4;i++){const port=add(q.s+i*14,q.kind);if(port)q.crossings.push(port);}
    }
    for(const q of p.wildlifeZones||[])q.crossing=add(q.s,'bear');
    // Random urban encounters use prebuilt, dry, level-side access paths.
    // They must never originate in water, through a retaining wall or on a bridge.
    (p.secs||[]).forEach((sec,i)=>{
      if(!['city','town','plaza','harbor'].some(t=>sec.L===t||sec.R===t))return;
      const a=p.secStartS[i],b=p.secStartS[i+1]??p.L;
      for(let s=a+75;s<b-65;s+=150)add(s,'pedestrian');
    });
    p.roadCrossings.sort((a,b)=>a.s-b.s);
  }
  function crossingFor(p,target,min,max){return(p.roadCrossings||[]).filter(q=>q.kind==='pedestrian'&&q.s>=min&&q.s<=max).sort((a,b)=>Math.abs(a.s-target)-Math.abs(b.s-target))[0]||null;}
  function passageAt(p,s){return(p.roadCrossings||[]).find(q=>Math.abs(q.s-s)<q.width/2)||null;}
  function drawPassages(D,sprites){
    const p=D.p;
    // Cut genuine narrow openings in the rendered railing. The two solid end
    // posts remain closer than the smallest car dimension, so a car footprint
    // still overlaps a post even while its centre is aligned with the opening.
    for(const q of p.roadCrossings){
      const a=q.s-q.width/2,b=q.s+q.width/2,next=[];
      for(const w of p.walls){
        const rail=rails.has(sprites[w.tex]?.name);
        if(!rail||w.off<0||w.off>3.5||w.h>1.4||w.s1<=a||w.s0>=b){next.push(w);continue;}
        if(w.s0<a)next.push({...w,s1:a});
        if(w.s1>b)next.push({...w,s0:b,capStart:true});
      }p.walls=next;
      // A short paved approach makes the access legible without opening a
      // second driveable shoulder. Clear only its small near-curb footprint.
      if(p.sprites)p.sprites=p.sprites.filter(o=>Math.abs(o.s-q.s)>1.15||Math.abs(o.x-edge(p,o.s,o.x<0?-1:1))>3.4);
      if(p.colliders)p.colliders=p.colliders.filter(c=>{const x=(c.x0+c.x1)/2,sg=x<0?-1:1,off=(x-edge(p,q.s,sg))*sg;return !(c.s0<b&&c.s1>a&&off>=0&&off<3.4);});
      for(const sg of [-1,1]){
        D.wall(a,b,sg,.2,2.8,.025,'',{collide:false,col:0xc4b799,sideCol:0x9b937c});
        for(const s of [a-.09,b+.09])D.wall(s-.09,s+.09,sg,.1,.32,1.15,'',{collide:false,col:0xc3c3ae,sideCol:0x677578});
      }
    }
  }
  function configure(D,sprites){const p=D.p;
    configurePassages(p);
    // Replace short, sometimes non-solid curb rails with one consistent
    // course edge. Retaining walls and waterfront promenade rails remain.
    p.walls=p.walls.filter(w=>!(rails.has(sprites[w.tex]?.name)&&w.depth===0&&w.h<=1.4&&w.off>=0&&w.off<=1.25));
    const original=p.walls.slice(),index=new Map();p.roadBoundaries=[];
    for(const w of original){const name=sprites[w.tex]?.name;if(!rails.has(name)||w.h<.6||w.off<0||w.off>9)continue;for(let s=Math.floor(w.s0/16);s<=Math.floor(w.s1/16);s++){const key=w.sg+':'+s;if(!index.has(key))index.set(key,[]);index.get(key).push(w);}}
    for(let s0=0;s0<p.L;s0+=4){const s1=Math.min(p.L,s0+4),s=(s0+s1)/2,sec=p.sec(s);
      for(const sg of [-1,1]){
        if(sharedInner(p,s,sg))continue;
        const terrain=sg<0?sec.L:sec.R,def=style(terrain),rise=global.FormosaRailCrossing?.height(p,s,sg*4)||0;
        const old=(index.get(sg+':'+Math.floor(s/16))||[]).filter(w=>w.s0<=s0+.15&&w.s1>=s1-.15&&Math.abs(w.off-def.off)<.03&&Math.abs((w.y||0)-rise)<.2).sort((a,b)=>a.off-b.off)[0];
        const off=old?old.off:def.off,height=old?old.h:def.height;
        const boundary={s0,s1,sg,off,height,terrain,kind:old?sprites[old.tex].name.slice(5):def.kind,reused:!!old};p.roadBoundaries.push(boundary);
        if(!old)D.wall(s0,s1,sg,off,0,height,'rail_'+def.kind,{collide:false,y:rise,col:0xb3b8b5,sideCol:0x7c8585});
      }
    }
    p.roadBoundaryRows=new Map();for(const q of p.roadBoundaries){const i=Math.floor(q.s0/4);let row=p.roadBoundaryRows.get(i);if(!row){row=[];p.roadBoundaryRows.set(i,row);}row.push(q);}
    drawPassages(D,sprites);
  }
  function at(p,s,sg){return p.roadBoundaryRows?.get(Math.floor(Math.max(0,Math.min(p.L-.001,s))/4))?.find(q=>q.sg===sg)||null;}
  function limit(p,s,q,halfWidth){return edge(p,s,q.sg)+q.sg*(q.off-.15-halfWidth);}
  function constrain(p,body,previous,halfWidth){if(!p.roadBoundaryRows)return null;let contact=null;
    for(const sg of [-1,1]){const q=at(p,body.s,sg);if(!q)continue;const stop=limit(p,body.s,q,halfWidth),penetration=(body.x-stop)*sg;
      if(penetration<=0)continue;
      // A moving narrow shoulder is tested at the end of the swept step too.
      // Thus a high-speed frame cannot pass a short collider or enter the
      // outside of a bend between the old and new longitudinal sample.
      const beforeX=body.x,beforeVx=body.vx||0;body.x=stop;body.vx=sg<0?Math.max(body.vx||0,0):Math.min(body.vx||0,0);
      contact={boundary:q,normalX:-sg,beforeVx,afterVx:body.vx,penetration,correction:Math.abs(beforeX-body.x),previousS:previous.s};
    }return contact;
  }
  global.FormosaRoadBoundary={wet,crops,style,edge,sharedInner,configure,at,limit,constrain,passageWidth,safePassage,crossingFor,passageAt};
})(window);
