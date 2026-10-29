// Reconstructed anatomy beneath loose hair. Only pixels vacated by the
// matching person's free material may use this artwork; the original car,
// rigid accessories and visible heads are never replaced by generated art.
export const CREW_BACKPLATES = {
  blanco: {
    src:'../assets/pixel/crew-blanco-base-v2.png',
    patches:[
      {owner:1,part:0,layer:'body',erase:true,polygon:[[0,0],[1,0],[1,1],[0,1]]},
      {owner:1,part:0,layer:'body',polygon:[[.6,.32],[.85,.32],[.85,.4],[.6,.4]]},
      {owner:1,part:0,replaceBody:true,polygon:[[.62,.19],[.70,.19],[.75,.27],[.775,.35],[.62,.35]]},
    ],
  },
  bamboo: {
    src:'../assets/pixel/crew-bamboo-base-v2.png',crop:[78/1536,96/1024,1381/1536,916/1024],
    patches:[
      {owner:0,replaceBody:true,polygon:[[.30,.07],[.40,.07],[.43,.28],[.41,.33],[.27,.33],[.28,.20]]},
      {owner:1,part:1,replaceBody:true,polygon:[[.62,.12],[.70,.12],[.75,.26],[.78,.34],[.60,.34],[.60,.21]]},
    ],
  },
  oro: {
    src:'../assets/pixel/crew-oro-base-v2.png',
    patches:[
      {owner:1,part:0,layer:'body',polygon:[[0,0],[1,0],[1,1],[0,1]]},
      {owner:1,part:0,replaceBody:true,polygon:[[.6006546,.0751043],[.6546644,.0611961],[.6775777,.1098748],[.6792143,.193324],[.6890343,.2267037],[.7168575,.2378303],[.7315875,.2684283],[.7356792,.3045897],[.7283142,.3393602],[.7168575,.3393602],[.7103109,.3115438],[.6235679,.3045897],[.6006546,.2739916]]},
    ],
  },
};
