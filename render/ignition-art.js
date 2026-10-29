// The starting grid keeps its real car and camera. Only the selected cast's
// existing portraits and a compact instrument card are added for the ignition.
// Never sample the live frame back into itself: source pixels and the game's
// 2x logical drawing transform are different coordinate systems.
(function (root) {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
  const mix=(a,b,t)=>a+(b-a)*t;
  function layout(width,height) {
    const margin=10,cardW=Math.min(82,Math.floor((width-180)/2)),cardH=111;
    return {width,height,margin,cardW,cardH,cardY:height-cardH-13,
      left:margin,right:width-margin-cardW,
      instrument:{x:Math.round(width/2-90),y:57,w:180,h:58}};
  }
  function phase(ign) {
    if(ign.caught)return {id:'ready',label:'引擎就緒',color:0x9df28d,step:3};
    if(ign.crank)return {id:'crank',label:'啟動中',color:0xffdc72,step:2};
    if(ign.acc)return {id:'power',label:'電源檢查',color:0x83d5ff,step:1};
    return {id:'key',label:'準備啟動',color:0xe6eaf5,step:0};
  }
  function vibration(ign,reduced=false) {
    if(reduced||!ign.on)return {x:0,y:0};
    const fade=1-clamp(ign.drop||0,0,1),t=ign.t||0;
    if(ign.crank)return {x:Math.sin(t*83)*.35*fade,y:Math.sin(t*109)*.2*fade};
    const age=Math.max(0,t-2.2),catching=ign.caught?Math.exp(-age*13)*Math.sin(age*32):0;
    return {x:0,y:-catching*.65*fade};
  }
  function draw(g,{width,height,ign,spec,crew=[],art,rpm=0,redline=7500,engine='',label}) {
    if(!ign.on)return null;
    const L=layout(width,height),P=phase(ign),alpha=1-clamp(ign.drop||0,0,1);
    const reveal=smooth((ign.t||0)/.28),portraits=[];
    const text=(s,x,y,size=8,color=0xeaf3ff,align='left',max=Infinity)=>label(s,x,y,size,color,align,max);
    const box=(x,y,w,h)=>{
      g.fillStyle='rgba(5,13,31,.93)';g.fillRect(x,y,w,h);
      g.fillStyle='#435773';g.fillRect(x,y,w,1);g.fillRect(x,y,1,h);
      g.fillStyle='#0b1124';g.fillRect(x+w-2,y,2,h);g.fillRect(x,y+h-2,w,2);
      g.fillStyle='#edc56a';g.fillRect(x,y,12,2);g.fillRect(x+w-12,y+h-2,12,2);
    };
    g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=alpha;
    // A narrow nameplate leaves the skyline and the actual starting grid visible.
    const titleW=Math.min(width-28,240),titleX=Math.round((width-titleW)/2);
    box(titleX,10,titleW,34);
    text(spec.name||spec.id,width/2,13,12,0xffdf7e,'center',titleW-18);
    text(engine||spec.en||spec.id,width/2,30,7,0xc5d7e9,'center',titleW-16);
    for(let i=0;i<Math.min(2,crew.length);i++) {
      const member=crew[i],x=(i?L.right:L.left)+(i?1:-1)*(1-reveal)*(L.cardW+L.margin),y=L.cardY;
      g.save();g.globalAlpha*=reveal;box(x,y,L.cardW,L.cardH);
      const role=i?(member.dog?'旅伴':'副駕駛'):'駕駛';
      text(role,x+6,y+5,9,0xffdf7e,'left',L.cardW-12);
      g.save();g.beginPath();g.rect(x+4,y+24,L.cardW-8,L.cardH-46);g.clip();
      const ready=!!art?.drawPortrait(g,{spec,index:i,x:x+4,y:y+24,width:L.cardW-8,height:L.cardH-46});
      g.restore();
      text(member.name||'',x+L.cardW/2,y+L.cardH-18,10,0xf4f5fa,'center',L.cardW-10);
      portraits.push({index:i,name:member.name,role,ready,x,y,w:L.cardW,h:L.cardH});g.restore();
    }
    const I=L.instrument;box(I.x,I.y,I.w,I.h);
    // The key and instruments describe the existing timed sound sequence; no
    // substitute block-drawn hands, people or cockpit replace the selected art.
    g.save();g.translate(I.x+25,I.y+25);g.rotate((ign.keyA||0)*.55);
    const insert=mix(10,0,clamp(ign.hand||0,0,1));
    g.fillStyle='#0a1020';g.fillRect(-13,insert-9,26,18);
    g.fillStyle=ign.acc?'#d9e4ef':'#748497';g.fillRect(-11,insert-7,12,14);
    g.fillStyle='#34445b';g.fillRect(-8,insert-4,6,8);
    g.fillStyle='#e7c36b';g.fillRect(1,insert-2,15,4);g.fillRect(10,insert+2,3,4);g.fillRect(15,insert+1,3,3);g.restore();
    text(P.label,I.x+52,I.y+6,10,P.color,'left',I.w-60);
    text('RPM '+String(Math.round(rpm/100)*100).padStart(4,'0'),I.x+53,I.y+24,7,0xd3dfed,'left',I.w-60);
    const level=clamp(rpm/Math.max(1,redline),0,1),bars=18;
    for(let n=0;n<bars;n++){
      const lit=n/bars<level;
      g.fillStyle=lit?(n>14?'#ff5b63':n>11?'#ffcf65':'#7bc9ec'):'#253448';
      g.fillRect(I.x+53+n*6,I.y+36,4,8);
    }
    for(let n=0;n<4;n++){
      g.fillStyle=n<=P.step?(P.step===3?'#9df28d':'#ffdc72'):'#253448';
      g.fillRect(I.x+14+n*8,I.y+48,5,3);
    }
    g.restore();
    return {carId:spec.id,phase:P.id,alpha,portraits,instrument:I,logicalWidth:width,logicalHeight:height,source:'selected-race-car-and-existing-crew-atlas',frameCopies:0};
  }
  const api={layout,phase,vibration,draw};
  root.FormosaIgnitionArt=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
