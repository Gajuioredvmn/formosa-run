// Material separation for the approved rear artwork. These masks select source
// pixels, not mesh vertices: a seat beside a moving hair tip stays on the body.
export function polygons(shape) {
  return shape?.polygons || (Array.isArray(shape) && shape.length ? [shape] : []);
}
export function contains(shape, x, y) {
  return polygons(shape).some(poly => {
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
      const a=poly[i],b=poly[j];
      if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  });
}

export function separateCrew(source,width,height,masks,parts) {
  const size=source.length,body=new Uint8ClampedArray(source),foreground=new Uint8ClampedArray(size);
  const crew=(masks.crew||[]).map(()=>new Uint8ClampedArray(size));
  const cloth=(parts||[]).map(()=>new Uint8ClampedArray(size));
  const labels=new Int16Array(width*height),counts={body:0,crew:crew.map(()=>0),cloth:cloth.map(()=>0),fixed:cloth.map(()=>0),foreground:0};
  const copy=(to,di,si=di)=>{for(let c=0;c<4;c++)to[di+c]=source[si+c];};
  const moving=(u,v)=>!(masks.foreground||[]).some(s=>contains(s,u,v))&&((masks.crew||[]).some(s=>contains(s,u,v))||(masks.cloth||[]).some(s=>contains(s,u,v)));
  const rigidRows=Array.from({length:height},()=>[width,-1]);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(source[(y*width+x)*4+3]<96||moving((x+.5)/width,(y+.5)/height))continue;
    rigidRows[y][0]=Math.min(rigidRows[y][0],x);rigidRows[y][1]=x;
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const index=y*width+x,i=index*4,u=(x+.5)/width,v=(y+.5)/height;
    if(source[i+3]<96)continue;
    if((masks.foreground||[]).some(shape=>contains(shape,u,v))){
      copy(foreground,i);labels[index]=-1;counts.foreground++;continue;
    }
    let owner=(masks.crew||[]).findIndex(shape=>contains(shape,u,v));
    const part=(masks.cloth||[]).findIndex(shape=>contains(shape,u,v));
    // A free scarf may extend outside its wearer's torso silhouette.
    if(owner<0&&part>=0){
      const p=parts[part];owner=p.role==='driver'?0:p.role==='passenger'?1:(p.root[0]<.5?0:1);
    }
    if(owner<0){counts.body++;continue;}
    // The same-height clear cockpit column restores only pixels vacated by
    // the person. Never smear colour across the car or leave a stationary
    // copy of the hair underneath the animated layer.
    const entry=masks.backing?.[owner]??.5;
    let column=typeof entry==='number'?entry:.5;
    if(Array.isArray(entry))for(const [row,sample] of entry)if(v>=row)column=sample;
    let bx=Math.max(0,Math.min(width-1,Math.floor(column*width)));
    if(moving((bx+.5)/width,v)){
      for(let distance=1;distance<width;distance++){
        const available=[bx-distance,bx+distance].find(px=>px>=0&&px<width&&!moving((px+.5)/width,v));
        if(available!==undefined){bx=available;break;}
      }
    }
    const exterior=x<rigidRows[y][0]||x>rigidRows[y][1]||(masks.clear||[]).some(s=>contains(s,u,v));
    // Small traced backplate repairs restore parts hidden in the original
    // flattened drawing, e.g. the mirror under Argento's scarf. They affect
    // only vacated crew pixels, never overwrite the original visible car.
    let underlay;
    for(const patch of masks.underlay||[])if(contains(patch.polygon,u,v))underlay=patch.color;
    const background=(y*width+bx)*4;
    for(let c=0;c<4;c++)body[i+c]=underlay?underlay[c]:exterior?0:source[background+c];
    const fixed=part>=0&&contains(masks.fixed?.[part],u,v);
    if(fixed){copy(crew[owner],i);labels[index]=1+owner;counts.crew[owner]++;counts.fixed[part]++;}
    else if(part>=0){copy(cloth[part],i);labels[index]=10+part;counts.cloth[part]++;}
    else{copy(crew[owner],i);labels[index]=1+owner;counts.crew[owner]++;}
  }
  return {body,crew,cloth,foreground,labels,counts};
}

export function restoreCrewBackplate(layers, source, width, height, patches, parts) {
  let restored=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=y*width+x,i=p*4,part=layers.labels[p]-10;
    if(part<0||!parts[part])continue;
    const material=parts[part],owner=material.role==='driver'?0:material.role==='passenger'?1:material.root[0]<.5?0:1;
    for(const patch of patches){
      if(patch.owner!==owner||(patch.part!==undefined&&patch.part!==part)||!contains(patch.polygon,(x+.5)/width,(y+.5)/height))continue;
      // Reconstructed trim stays rigid; reconstructed anatomy follows only
      // its seated owner. Transparent base pixels restore genuine air gaps.
      const target=patch.layer==='body'?layers.body:layers.crew[owner];
      for(let c=0;c<3;c++)target[i+c]=patch.erase?0:source[i+c];
      target[i+3]=patch.erase||source[i+3]<96?0:255;
      if(patch.layer!=='body'&&patch.replaceBody)layers.body.fill(0,i,i+4);
      restored++;
    }
  }
  layers.counts.restored=restored;
  return restored;
}

// Cache only triangles with visible material. Local head/cloth layers do not
// repeat the whole car mesh or scan transparent canvas space every frame.
export function materialMesh(source,width,height,columns=48,rows=40) {
  const vertices=[],triangles=[];
  for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++)vertices.push({u:x/columns,v:y/rows,p:[0,0]});
  const active=new Set();
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const left=Math.floor(x*width/columns),right=Math.min(width-1,Math.ceil((x+1)*width/columns));
    const top=Math.floor(y*height/rows),bottom=Math.min(height-1,Math.ceil((y+1)*height/rows));
    let visible=false;
    for(let py=top;py<=bottom&&!visible;py++)for(let px=left;px<=right;px++)if(source[(py*width+px)*4+3]>=96){visible=true;break;}
    if(!visible)continue;
    const a=vertices[y*(columns+1)+x],b=vertices[y*(columns+1)+x+1],c=vertices[(y+1)*(columns+1)+x],d=vertices[(y+1)*(columns+1)+x+1];
    triangles.push([a,b,c],[b,d,c]);for(const p of [a,b,c,d])active.add(p);
  }
  return {source,vertices:[...active],triangles};
}
