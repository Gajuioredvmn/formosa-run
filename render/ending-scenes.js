/* Destination cutscenes use depth-ordered pixel geometry. A paved arrival bay
 * is always separate from water, protected rock shelves and pedestrian steps.
 * Landmarks are explicitly assigned; no shared Kaohsiung skyline fallback. */
(function (scope) {
  'use strict';
  const panels = {
    city:['a',0,0], sandstone:['a',1,0], lake:['a',0,1], alpine:['a',1,1],
    gorge:['b',0,0], museum:['b',1,0], grasscape:['b',0,1], lighthouse:['b',1,1],
    sunset:['c',0,0], sailrock:['c',1,0], wetland:['c',0,1], harbor:['c',1,1],
    town:['d',0,0], hillside:['d',1,0], bridge:['d',0,1], rockpool:['d',1,1],
  };
  const images = new Map(), pending = new Map(), state = { assets:{} };
  const base = typeof document !== 'undefined' ? new URL('../assets/endings/', document.currentScript.src).href : '';
  // Fetch only the destination atlas once the result is known; the four ending
  // sheets do not add network/decode work to a player's initial race launch.
  function prepare(place) {
    const p=panels[place?.mood]; if(!p||typeof Image==='undefined')return Promise.resolve(false);
    const key=p[0]; if(pending.has(key))return pending.get(key);
    state.assets[key]='loading';
    const result=new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>{images.set(key,image);state.assets[key]='ready';resolve(true);};
      image.onerror=()=>{state.assets[key]='failed';resolve(false);};
      image.src=base+'destinations-'+key+'-v1.png';
    });
    pending.set(key,result);return result;
  }
  const palettes = {
    day: ['#167cdd','#8bcef0','#e3f1e8','#2a739b','#214d60'],
    golden: ['#327bc5','#eac397','#ffe5a2','#317c9c','#35465c'],
    sunset: ['#586db0','#e8a989','#ffdd8e','#527f98','#493b5b'],
    blue: ['#163b77','#658fc0','#ffdb95','#305d84','#242e4c'],
  };
  function draw(g, W, H, place, t, sprite) {
    const P=palettes[place.time]||palettes.day, mood=place.mood;
    g.save();g.scale(W/480,H/270);g.imageSmoothingEnabled=false;
    const r=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));};
    const poly=(a,c)=>{g.fillStyle=c;g.beginPath();g.moveTo(Math.round(a[0]),Math.round(a[1]));for(let i=2;i<a.length;i+=2)g.lineTo(Math.round(a[i]),Math.round(a[i+1]));g.closePath();g.fill();};
    const line=(x,y,xx,yy,c,w=1)=>{g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(Math.round(x),Math.round(y));g.lineTo(Math.round(xx),Math.round(yy));g.stroke();};
    const ellipse=(x,y,rx,ry,c)=>{g.fillStyle=c;g.beginPath();g.ellipse(Math.round(x),Math.round(y),rx,ry,0,0,Math.PI*2);g.fill();};
    const label=(txt,x,y,c='#f8e7bd',size=9)=>{g.fillStyle=c;g.font=`900 ${size}px "Noto Sans TC",sans-serif`;g.textAlign='left';g.textBaseline='top';g.fillText(txt,x,y);};
    const panel=panels[mood], painted=panel&&images.get(panel[0]);
    if(painted){
      // Use exact integer sheet quadrants. The unmodified source stays in the
      // repository; source-rect sampling never bakes UI, cars or crew into it.
      const halfW=Math.floor(painted.width/2),halfH=Math.floor(painted.height/2);
      const sx=panel[1]*halfW,sy=panel[2]*halfH,sw=panel[1]?painted.width-halfW:halfW,sh=panel[2]?painted.height-halfH:halfH;
      g.drawImage(painted,sx,sy,sw,sh,0,0,480,240);
      // Tiny changing highlights give water light a quiet life. Destination
      // masks keep the sparkles away from roads, roofs and mountain faces.
      const waterMasks={lake:[100,300,114,150],grasscape:[20,210,89,125],lighthouse:[10,220,117,146],sunset:[245,435,89,114],sailrock:[20,150,111,144],wetland:[20,220,126,157],harbor:[40,240,132,165],bridge:[60,360,152,172],rockpool:[315,470,77,99]};
      const mask=waterMasks[mood];if(mask){g.fillStyle=place.time==='sunset'?'#ffdd8f':'#dcf2ef';for(let i=0;i<12;i++){const a=Math.max(0,Math.sin(t*1.5+i*1.9))*.22;if(a<.13)continue;g.globalAlpha=a;g.fillRect(mask[0]+i*37%(mask[1]-mask[0]),mask[2]+i*13%(mask[3]-mask[2]),1+i%2,1);}g.globalAlpha=1;}
      r(9,8,278,28,'rgba(12,27,48,.88)');r(9,8,3,28,'#ffca68');label(place.county+' · '+place.name,18,12,'#f4edcf',10);label(place.title,18,25,'#b9d8dd',8);
      g.restore();return {art:true,atlas:panel[0],column:panel[1],row:panel[2]};
    }
    const ridge=(base,amp,col,phase)=>{const a=[-12,base];for(let x=-12;x<=500;x+=16){const y=base-amp*(.35+.45*Math.sin(x*.018+phase)+.2*Math.sin(x*.069+phase));a.push(x,y);}a.push(500,162,-12,162);poly(a,col);};
    const water=(top,col=P[3])=>{r(0,top,480,157-top,col);for(let i=0;i<66;i++){const x=(i*73+Math.floor(t*(2+i%3)))%480,y=top+3+(i*17)%(157-top);r(x,y,2+i%7,1,i%4===0?'#f8e6b3':'#70b9c6');}};
    const boat=(x,y,k=1)=>{poly([x-12*k,y,x+15*k,y,x+9*k,y+5*k,x-8*k,y+5*k],'#e7ddd0');r(x-5*k,y-7*k,12*k,7*k,'#f5ead2');r(x-3*k,y-5*k,8*k,3*k,'#284f6b');line(x+2*k,y-7*k,x+2*k,y-19*k,'#414a58');};
    const bird=(x,y)=>{line(x-3,y,x,y+2,'#263f5b');line(x,y+2,x+3,y,'#263f5b');};
    const tree=(x,y,h=35)=>{poly([x-2,y,x+3,y,x+1,y-h,x-1,y-h],'#58452f');for(let i=0;i<9;i++){const dx=(i*11%23)-11,dy=(i*7%17)-8;r(x+dx-5,y-h+dy,12,7,i%3===0?'#80a448':i%3===1?'#345b35':'#527c3a');}};
    const person=(x,y,c,k=1)=>{r(x-1*k,y-8*k,3*k,3*k,'#d8a477');r(x-2*k,y-5*k,5*k,5*k,c);r(x-2*k,y,2*k,4*k,'#293549');r(x+1*k,y,2*k,4*k,'#293549');};
    const fence=(y,col='#dbc99d')=>{r(0,y,480,2,col);r(0,y+6,480,2,'#5b6059');for(let x=3;x<480;x+=24){r(x,y-3,3,18,col);r(x+2,y-2,1,17,'#656863');}};
    const reeds=(x,y,n=10)=>{for(let i=0;i<n;i++){const dx=(i*11)%27,dy=(i*7)%9;line(x+dx,y,x+dx+Math.sin(t+i)*2,y-8-dy,i%2?'#7a9359':'#5b744c');}};
    const shop=(x,y,w,h,col,lantern=false)=>{
      // Recessed interior, exterior pillars, side face and projecting awning.
      poly([x+w,y+4,x+w+9,y-2,x+w+9,y+h-2,x+w,y+h+4],'#493d3b');r(x,y,w,h,col);r(x+4,y+20,w-8,h-20,'#342b32');
      r(x+6,y+23,w-12,h-28,'#765641');r(x+9,y+26,w-18,11,'#dbb976');r(x+12,y+28,w-24,7,'#f5d892');
      for(let yy=y+4;yy<y+17;yy+=6)for(let xx=x+5;xx<x+w-6;xx+=11){r(xx,yy,7,5,'#315265');r(xx+1,yy,1,5,'#edddac');}
      poly([x-3,y+18,x+w+4,y+18,x+w+8,y+24,x-6,y+24],lantern?'#67443d':'#327d78');r(x-6,y+24,w+14,3,'#d4c3a0');
      for(const dx of [0,w-4]){r(x+dx,y+27,4,h-27,'#dbccaa');r(x+dx+3,y+27,2,h-27,'#837e70');}
      if(lantern)for(let q=0;q<3;q++){const lx=x+6+q*(w-12)/2;line(lx,y+24,lx,y+30,'#443537');ellipse(lx,y+34,3,5,'#c95136');r(lx-1,y+31,2,5,'#ffbf65');}
    };
    // Banded sky and layered clouds retain crisp pixels at every depth.
    for(let y=0;y<113;y+=4){const k=y/113;g.fillStyle=P[0];g.fillRect(0,y,480,4);g.globalAlpha=k*.9;g.fillStyle=P[1];g.fillRect(0,y,480,4);g.globalAlpha=1;}
    if(mood==='sunset'||mood==='wetland'){ellipse(332,92,16,15,'#ffdf91');r(314,103,36,2,P[1]);}
    for(let c=0;c<5;c++){const x=(c*117+Math.floor(t*.35))%600-42,y=29+(c*19)%43;for(let j=0;j<5;j++){r(x+j*12,y-((j*7)%11),19,10,'#d1e0e8');r(x+j*12,y-((j*7)%11)-3,17,5,'#f5f3df');}}
    ridge(105,30,'#789bba',1);ridge(117,32,'#547f9a',2);ridge(127,26,'#396b7b',4);
    if(mood==='city'){
      for(let i=0;i<22;i++){const x=i*23,y=98-(i*17%42),hh=133-y;r(x,y,19,hh,i%2?'#668b9b':'#809daa');r(x+16,y,3,hh,'#466c82');for(let yy=y+5;yy<129;yy+=7)for(let xx=x+3;xx<x+15;xx+=5)r(xx,yy,2,3,(i+yy)%3?'#abc0bd':'#f3d592');}
      sprite('taipei101',352,137,112);r(0,134,480,25,'#4d5c6a');r(0,136,480,2,'#dbd1af');
      for(let x=4;x<480;x+=40){r(x,145,19,2,'#c6bc9f');tree(x+9,136,18);}
      shop(9,88,49,47,'#bca17e');shop(61,96,39,39,'#c7b393');label('信義散步',14,108,'#ffd38b',8);person(116,139,'#d9a05d');person(124,139,'#5db4aa');
    }else if(mood==='sandstone'){
      water(105);poly([0,141,27,129,58,134,101,118,140,128,175,123,218,135,255,129,303,140,480,142,480,165,0,165],'#c7a66e');
      for(let i=0;i<23;i++){const x=i*22,y=136+(i*13%16);ellipse(x,y,13,6,i%2?'#b8925d':'#dec08b');r(x-8,y+2,16,1,'#947a53');}
      sprite('queenhead',347,148,87);for(let i=0;i<5;i++)bird(56+i*74+Math.sin(t*.4+i)*5,71+i%3*9);
    }else if(mood==='lake'){
      water(112,'#397f94');ridge(120,15,'#427f78',3);water(126,'#4a9aa8');
      poly([198,133,285,133,350,155,150,155],'#916c45');for(let y=134;y<155;y+=3)r(150+(155-y)*2.2,y,200-(155-y)*5,1,'#d9b87b');
      for(let x=179;x<326;x+=23){r(x,136,2,15,'#684d39');r(x,136,13,1,'#edd9a2');}boat(95+Math.sin(t*.3)*4,136,1.2);boat(405,134,.7);sprite('shuishe',353,146,64);
    }else if(mood==='alpine'){
      poly([0,140,42,76,73,97,123,35,171,85,225,55,278,105,326,73,384,99,450,39,480,91,480,157,0,157],'#426379');
      poly([42,76,73,97,123,35,111,92,90,130,0,140],'#81959c');poly([326,73,384,99,450,39,420,108,361,139],'#6f8893');
      poly([0,147,96,108,188,125,292,108,378,140,480,123,480,166,0,166],'#6e804f');for(let i=0;i<70;i++){const x=i*19%480,y=132+i*13%28;r(x,y,2,2,i%3?'#a0aa69':'#4c6848');}sprite('wuling',360,159,65);
      for(let i=0;i<9;i++)r((i*67+t*2)%500-20,118+i%3*5,41,2,'rgba(228,240,241,.5)');
    }else if(mood==='gorge'){
      poly([0,0,79,0,123,48,107,99,156,152,0,165],'#557d81');poly([0,31,70,14,95,80,82,125,0,156],'#a0b6ac');
      poly([480,0,402,0,361,49,385,92,335,155,480,163],'#355964');poly([480,27,420,12,389,80,410,123,480,148],'#6d938e');
      for(let i=0;i<16;i++){line(4,i*9,90+i%4*8,i*9+13,'#708f8a');line(404+i%3*5,i*9,480,i*9-8,'#254b59');}
      poly([238,92,258,92,250,113,275,134,345,157,168,157,216,134,224,109],'#67c2cf');line(245,111,262,133,'#d9f4df',2);
      sprite('changchun',324,132,79);for(let j=0;j<8;j++)r(324+(j%3),130+j*3,2,3,'#d5f4eb');
    }else if(mood==='museum'){
      r(0,124,480,34,'#7da597');ellipse(246,142,138,14,'#477f93');sprite('lanyang',302,146,99);
      for(let i=0;i<12;i++)reeds(i*41,151+(i%2)*4,5);r(0,157,480,3,'#c6c7b0');person(195,142,'#c9875f',.7);person(205,142,'#ddd4a0',.7);
    }else if(mood==='grasscape'||mood==='lighthouse'||mood==='sunset'){
      water(106);poly([0,115,93,105,168,113,210,133,275,139,343,157,0,168],'#9e9e79');poly([0,109,92,101,166,108,215,130,278,136,326,150,0,156],'#71944e');
      for(let i=0;i<62;i++){const x=i*23%292,y=117+i*11%34;r(x,y,4,1,i%2?'#aac16d':'#4c773c');}
      if(mood==='lighthouse'){sprite('lighthouse',369,151,100);if(place.time==='blue'){g.globalAlpha=.13;poly([365,63,480,44+Math.sin(t*.5)*12,480,88+Math.sin(t*.5)*12],'#fff4b9');g.globalAlpha=1;}}
      if(mood==='sunset'){for(let j=0;j<20;j++)r(315-j,110+j*2,36+j*2,1,j%3?'#d0af7f':'#f5cf8e');sprite('flyrock',405,154,44);}
    }else if(mood==='sailrock'){
      water(113);poly([0,156,94,135,183,146,255,137,308,148,480,151,480,169,0,169],'#ead3a2');
      for(let i=0;i<27;i++)r(i*23%480,147+i*7%12,13,1,'#fff0c9');sprite('sailrock',354,143,83);sprite('palm#0',51,160,96);sprite('palm#2',90,153,70);
    }else if(mood==='wetland'){
      r(0,111,480,47,'#a9a994');for(let i=0;i<18;i++){const x=i*53%480,y=116+i*13%36;ellipse(x,y,25,4,i%2?'#8ca9a5':'#d5b48c');}
      for(let i=0;i<7;i++){const x=43+i*64,y=118,hh=27+i%3*4;r(x,y-hh,2,hh,'#dbe0d1');const a=t*.6+i;for(let j=0;j<3;j++){const aa=a+j*Math.PI*2/3;line(x+1,y-hh,x+Math.sin(aa)*11,y-hh+Math.cos(aa)*11,'#e9e5cc',2);}}
      poly([193,158,214,132,272,125,281,128,225,137,216,158],'#876b4c');for(let i=0;i<12;i++)line(195+i,157-i*1.5,215+i,157-i*1.5,'#c2a47b');reeds(11,150,12);reeds(427,153,10);
      for(let i=0;i<5;i++)bird(64+i*78+Math.sin(t+i)*3,93+i%2*4);
    }else if(mood==='harbor'){
      water(109);r(0,132,236,7,'#7c9291');boat(89,128,.6);boat(146,127,.75);boat(35,130,.5);
      for(let row=0;row<4;row++)for(let x=226+(row%2)*13;x<493;x+=28){for(let u=0;u<28;u++){const y=125+row*8+Math.round(Math.sin(u/28*Math.PI)*4);r(x+u,y,1,4,'#eeeadd');r(x+u,y+4,1,2,'#839ca3');}}
      for(let i=0;i<3;i++){const x=54+i*62+Math.sin(t+i)*4,y=60+i*9;poly([x,y-7,x+5,y,x,y+7,x-5,y],['#d35a53','#e8b957','#53a8ad'][i]);line(x,y+7,x-8,y+26,'#d4c4a5');}person(188,144,'#d8a16c');
    }else if(mood==='town'){
      r(0,127,480,31,'#bca988');poly([177,159,212,107,234,107,254,159],'#5a9689');for(let i=0;i<8;i++)line(193+i*6,150,223+i*2,116,'#afd2b7');
      shop(8,77,62,79,'#c7ae81');shop(74,86,49,69,'#bda17f');shop(127,97,42,59,'#d5be99');shop(281,90,58,66,'#a99473');shop(344,72,63,83,'#cfb791');shop(413,84,58,71,'#b49d7b');
      label('桂花巷',350,93,'#ffe1a1',11);label('客家粄條',15,99,'#fff1c9',9);r(178,140,77,7,'#ad9c7c');for(let i=0;i<6;i++)r(181+i*12,140,10,2,'#ddd1ae');person(264,149,'#9aa5b3');person(103,150,'#cf6e4f');tree(461,155,29);
    }else if(mood==='hillside'){
      water(108,'#365b7e');poly([0,151,109,105,168,118,217,84,313,111,397,78,480,115,480,164,0,164],'#345659');
      shop(5,78,64,77,'#826854',true);shop(73,90,56,65,'#9d7a5b',true);shop(135,104,41,51,'#af8c66',true);shop(281,91,51,64,'#8c725e',true);shop(337,66,64,89,'#9d805e',true);shop(405,81,66,75,'#735e51',true);
      for(let i=0;i<14;i++){const y=108+i*3.6,w=18+i*4;r(225-w/2,y,w,3,'#b4aaa0');r(225-w/2,y+2,w,1,'#595965');}label('九份茶坊',344,86,'#f4d89d',10);person(205,143,'#d48460',.7);person(251,150,'#82b4ad');
    }else if(mood==='bridge'){
      water(109);poly([311,122,337,96,352,102,365,72,382,91,398,86,420,116,452,125],'#627a72');poly([338,115,365,72,369,102,386,119],'#b2b093');
      // Exactly eight walk-only arches, with no roadway on the bridge.
      for(let i=0;i<8;i++){const x=92+i*29,y=132-i*1.3;g.strokeStyle='#eee2bd';g.lineWidth=4;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+14,y-21,x+28,y-1);g.stroke();line(x,y,x,y+10,'#bcc1aa',3);for(let q=0;q<5;q++){const u=q/4,yy=y-4*u*(1-u)*20;line(x+u*28,yy-7,x+u*28,yy,'#e3d9b9');}g.strokeStyle='#ab9e7c';g.lineWidth=1;g.beginPath();g.moveTo(x,y-7);g.quadraticCurveTo(x+14,y-28,x+28,y-8);g.stroke();}
      for(let i=0;i<35;i++)ellipse(i*19%480,149+i*7%9,5+i%4,3,i%2?'#858985':'#bbb6a1');
    }else if(mood==='rockpool'){
      water(105);poly([0,156,0,141,63,125,104,135,151,111,203,120,259,103,293,90,325,96,355,135,419,128,480,142,480,166],'#d0cdb6');poly([180,153,293,90,325,96,278,146],'#f1e6ca');
      for(let i=0;i<17;i++)line(i*31,155,40+i*25,126-i%3*6,'#a3a895');for(let i=0;i<13;i++){const x=17+i*36,y=141+i*7%14;ellipse(x,y,10+i%4,4,'#738e8f');ellipse(x-1,y-1,7+i%3,2,'#79bbca');r(x-3,y-2,4,1,'#e6efcf');}
    }
    // Arrival apron in front of the destination. Its rail/curb separates the
    // stopped vehicle from pedestrian-only or protected areas behind it.
    const town=mood==='city'||mood==='town'||mood==='hillside';
    r(0,158,480,48,town?'#716f72':'#716f65');r(0,158,480,3,'#d7c8a7');
    for(let i=0;i<150;i++){const x=i*73%480,y=164+i*29%41;r(x,y,2+(i%3),1,i%3?'#797c78':'#596168');}
    if(!town)fence(146,mood==='alpine'?'#c4c6b1':'#d7c8ab');
    line(31,201,65,166,'#d6d1bb',2);line(301,201,281,166,'#d6d1bb',2);line(65,166,281,166,'#d6d1bb',2);
    poly([0,177,21,160,65,160,137,201,104,206,0,206],'rgba(24,39,55,.3)');
    r(8,145,21,16,'#2a4756');r(10,147,17,12,'#527a79');label('P',15,147,'#fff0ba',10);
    // Title is compact enough to keep the landmark and the arriving crew clear.
    r(9,8,278,28,'rgba(12,27,48,.88)');r(9,8,3,28,'#ffca68');label(place.county+' · '+place.name,18,12,'#f4edcf',10);label(place.title,18,25,'#b9d8dd',8);
    g.restore();return {art:false,atlas:panel?.[0]||null};
  }
  scope.FormosaEndingScenes={draw,prepare,panels,state};
})(typeof window==='undefined'?globalThis:window);
