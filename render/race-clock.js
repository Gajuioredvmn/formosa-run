/* Arcade time budgets use the actual route length; vehicle handling is independent. */
(function(global){
  'use strict';
  const INITIAL_TIME=80;
  function budget(piece){
    if(piece.id==='s1')return INITIAL_TIME;
    const start=piece.checkS||0,end=piece.goalS||piece.L;
    const distance=Math.max(0,end-start)+(piece.goalS?0:100);
    const sections=piece.secs||[],length=sections.reduce((n,s)=>n+(s.len||0),0)||1;
    const bends=sections.reduce((n,s)=>n+(s.len||0)*Math.min(1,Math.abs(s.k||0)/.006),0)/length;
    const climb=sections.reduce((n,s)=>n+Math.max(0,s.dy||0),0);
    // Roughly 178 km/h physical average at WORLD_K=1.5, with a small
    // allowance for a checkpoint approach or a winding mountain section.
    return Math.max(50,Math.min(84,Math.round(distance/74+4+bends*3+Math.min(6,climb/30))));
  }
  function apply(pieces){for(const p of pieces)p.def.time=budget(p);return pieces.map(p=>({id:p.id,time:p.def.time}));}
  global.FormosaRaceClock={INITIAL_TIME,budget,apply};
})(typeof window!=='undefined'?window:globalThis);
