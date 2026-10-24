// Keep the arcade camera and controls in their original logical coordinates.
// Only raster density changes: no CSS blur and no change to driving scale.
(function (global) {
  'use strict';
  const scale = 2;
  function context(canvas, options) {
    const raw = canvas.getContext('2d', options), methods = new Map();
    const proxy = new Proxy(raw, {
      get(target, key) {
        if (key === 'setTransform') return (a=1,b=0,c=0,d=1,e=0,f=0) => {
          if (typeof a === 'object') { const m=a; raw.setTransform(m.a*scale,m.b*scale,m.c*scale,m.d*scale,m.e*scale,m.f*scale); }
          else raw.setTransform(a*scale,b*scale,c*scale,d*scale,e*scale,f*scale);
        };
        if (key === 'resetTransform') return () => raw.setTransform(scale,0,0,scale,0,0);
        const value = Reflect.get(target, key, target);
        if (typeof value !== 'function') return value;
        if (!methods.has(key)) methods.set(key,value.bind(target));
        return methods.get(key);
      },
      set(target,key,value) { Reflect.set(target,key,value,target); return true; }
    });
    return proxy;
  }
  global.FormosaDetailSurface = { scale, context };
})(window);
