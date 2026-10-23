/** One scene render, then one depth-aware output pass. Distances are metres;
 * filter radii are CSS pixels, independent of the renderer's device pixel ratio. */
export class FormosaLens {
  constructor(THREE, renderer, camera, { mobile = false } = {}) {
    this.THREE = THREE; this.renderer = renderer; this.camera = camera; this.mobile = mobile;
    this.enabled = true; this.stats = { active: false, taps: 0, sceneRenders: 0, outputPasses: 0 };
    this._materials = new Map();
    this._toneMapNames = new Map([[THREE.LinearToneMapping, 'Linear'], [THREE.ReinhardToneMapping, 'Reinhard'],
      [THREE.CineonToneMapping, 'Cineon'], [THREE.ACESFilmicToneMapping, 'ACESFilmic'],
      [THREE.AgXToneMapping, 'AgX'], [THREE.NeutralToneMapping, 'Neutral'], [THREE.CustomToneMapping, 'Custom']]);
    const hdr = renderer.extensions.has('EXT_color_buffer_float');
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: true, stencilBuffer: false,
      samples: mobile ? 0 : Math.min(2, renderer.capabilities.maxSamples || 0),
    });
    this.target.texture.name = 'FormosaLens.linearScene';
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.target.texture.generateMipmaps = false;
    this.target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.target.depthTexture.name = 'FormosaLens.sceneDepth';
    this.target.depthTexture.minFilter = THREE.NearestFilter;
    this.target.depthTexture.magFilter = THREE.NearestFilter;
    this.uniforms = {
      tScene: { value: this.target.texture }, tDepth: { value: this.target.depthTexture },
      cssPixel: { value: new THREE.Vector2(1, 1) },
      cameraNear: { value: camera.near }, cameraFar: { value: camera.far },
      speedMps: { value: 0 }, dofStrength: { value: 1 }, motionStrength: { value: 1 },
    };
    this.material = new THREE.ShaderMaterial({
      name: 'FormosaLens.depthAndSpeed', uniforms: this.uniforms,
      defines: mobile ? { FIVE_TAPS: 1 } : {},
      depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: `varying vec2 lensUv;
        void main(){lensUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
      fragmentShader: `
        #include <packing>
        uniform sampler2D tScene;
        uniform sampler2D tDepth;
        uniform vec2 cssPixel;
        uniform float cameraNear, cameraFar, speedMps, dofStrength, motionStrength;
        varying vec2 lensUv;
        float metres(vec2 uv){
          return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,cameraNear,cameraFar);
        }
        void gather(inout vec4 sum,inout float weight,vec2 uv,float depth){
          vec2 bounded=clamp(uv,cssPixel*.5,vec2(1.0)-cssPixel*.5);
          float z=metres(bounded);
          // Reject samples across a depth edge: a sharp car must not bleed into its distant backdrop.
          float w=1.0-smoothstep(max(.35,depth*.025),max(1.1,depth*.09),abs(z-depth));
          sum+=texture2D(tScene,bounded)*w;weight+=w;
        }
        void main(){
          float z=metres(lensUv);
          float coc=max(1.0-smoothstep(.7,2.7,z),smoothstep(180.0,650.0,z));
          vec2 disk=cssPixel*(2.2*coc*dofStrength);
          vec2 ray=lensUv-vec2(.5,.46);
          float edge=smoothstep(.36,.66,length(ray*vec2(1.2,.78)));
          float motion=5.0*edge*smoothstep(8.0,70.0,abs(speedMps))*motionStrength;
          vec2 radial=normalize(ray/cssPixel+vec2(.00001))*cssPixel*motion;
          vec4 color=texture2D(tScene,lensUv);
          if(coc*dofStrength>.001 || motion>.001){
            vec4 sum=color*4.0;float weight=4.0;
            #ifdef FIVE_TAPS
              gather(sum,weight,lensUv+disk*vec2(1.,0.)+radial,z);
              gather(sum,weight,lensUv+disk*vec2(-1.,0.)-radial,z);
              gather(sum,weight,lensUv+disk*vec2(0.,1.)+radial*.3333,z);
              gather(sum,weight,lensUv+disk*vec2(0.,-1.)-radial*.3333,z);
            #else
              gather(sum,weight,lensUv+disk*vec2(1.,0.)-radial,z);
              gather(sum,weight,lensUv+disk*vec2(.7071,.7071)-radial*.7143,z);
              gather(sum,weight,lensUv+disk*vec2(0.,1.)-radial*.4286,z);
              gather(sum,weight,lensUv+disk*vec2(-.7071,.7071)-radial*.1429,z);
              gather(sum,weight,lensUv+disk*vec2(-1.,0.)+radial*.1429,z);
              gather(sum,weight,lensUv+disk*vec2(-.7071,-.7071)+radial*.4286,z);
              gather(sum,weight,lensUv+disk*vec2(0.,-1.)+radial*.7143,z);
              gather(sum,weight,lensUv+disk*vec2(.7071,-.7071)+radial,z);
            #endif
            color=sum/weight;
          }
          gl_FragColor=color;
          // Capture preserves each material's toneMapped setting, including authored cutouts.
          // The final transform is only linear-to-output color space, never a second tone map.
          #include <colorspace_fragment>
        }`,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.outputScene = new THREE.Scene(); this.outputScene.add(this.quad);
    this.outputCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._viewport = new THREE.Vector4(); this._scissor = new THREE.Vector4();
    this._size = new THREE.Vector2(); this._fiveTaps = mobile;
    renderer.getSize(this._size); this.resize(this._size.x, this._size.y);
  }
  resize(width, height) {
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    this.uniforms.cssPixel.value.set(1 / this.width, 1 / this.height);
    const ratio = this.renderer.getPixelRatio();
    this.target.setSize(Math.max(1, Math.round(this.width * ratio)), Math.max(1, Math.round(this.height * ratio)));
  }
  _prepareToneMapping(scene) {
    // Three suppresses material tone mapping for ordinary render targets. Preserve the
    // direct-render appearance with the same official chunk on the materials that use it;
    // painted sprites/backgrounds with toneMapped:false remain untouched.
    const T = this.THREE;
    const names = this._toneMapNames;
    scene.traverseVisible(object => {
      const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const material of list) {
        if (!material.toneMapped || this._materials.has(material)) continue;
        const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
        const originalKey = key.call(material);
        this._materials.set(material, { compile, key });
        material.onBeforeCompile = (shader, renderer) => {
          compile.call(material, shader, renderer);
          const name = names.get(renderer.toneMapping);
          if (renderer.getRenderTarget() !== this.target || !name) return;
          shader.fragmentShader = '#define TONE_MAPPING\n' + T.ShaderChunk.tonemapping_pars_fragment +
            '\nvec3 toneMapping(vec3 color){return ' + name + 'ToneMapping(color);}\n' + shader.fragmentShader;
        };
        material.customProgramCacheKey = () => originalKey + '|formosa-capture-tone-' + this.renderer.toneMapping;
        material.needsUpdate = true;
      }
    });
  }
  render(scene, camera = this.camera, { speed = 0, enabled = true, quality = 'high' } = {}) {
    const renderer = this.renderer;
    const active = this.enabled && enabled && quality !== 'low' && quality !== 'off';
    Object.assign(this.stats, { active, taps: 0, sceneRenders: 1, outputPasses: active ? 1 : 0 });
    if (!active) { renderer.render(scene, camera); return this.stats; }
    const fiveTaps = this.mobile || quality === 'medium';
    if (fiveTaps !== this._fiveTaps) {
      this.material.defines = fiveTaps ? { FIVE_TAPS: 1 } : {};
      this.material.needsUpdate = true; this._fiveTaps = fiveTaps;
    }
    this.stats.taps = fiveTaps ? 5 : 9;
    this.uniforms.speedMps.value = Number.isFinite(speed) ? speed : 0;
    this.uniforms.cameraNear.value = camera.near;
    this.uniforms.cameraFar.value = camera.far;
    this._prepareToneMapping(scene);
    const oldTarget = renderer.getRenderTarget(), oldScissorTest = renderer.getScissorTest();
    const oldAutoClear = renderer.autoClear, oldInfoReset = renderer.info.autoReset;
    renderer.getViewport(this._viewport); renderer.getScissor(this._scissor);
    renderer.info.autoReset = false; renderer.info.reset();
    try {
      renderer.setScissorTest(false); renderer.setRenderTarget(this.target);
      renderer.autoClear = true; renderer.render(scene, camera);
      renderer.setRenderTarget(oldTarget); renderer.setViewport(this._viewport);
      renderer.setScissor(this._scissor); renderer.setScissorTest(oldScissorTest);
      renderer.autoClear = false; renderer.render(this.outputScene, this.outputCamera);
    } finally {
      renderer.setRenderTarget(oldTarget); renderer.setViewport(this._viewport);
      renderer.setScissor(this._scissor); renderer.setScissorTest(oldScissorTest);
      renderer.autoClear = oldAutoClear; renderer.info.autoReset = oldInfoReset;
    }
    return this.stats;
  }
  dispose() {
    for (const [material, original] of this._materials) {
      material.onBeforeCompile = original.compile; material.customProgramCacheKey = original.key;
      material.needsUpdate = true;
    }
    this._materials.clear();
    this.target.dispose(); this.material.dispose(); this.quad.geometry.dispose();
  }
}
