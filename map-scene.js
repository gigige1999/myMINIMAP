window.createMapScene = function createMapScene(THREE, OrbitControls, canvas, chapters) {
  const section = document.getElementById('map');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 700px)');
  const scene = new THREE.Scene();
  const root = new THREE.Group(); scene.add(root);
  const camera = new THREE.OrthographicCamera(-10, 10, 8, -8, .1, 90);
  const home = new THREE.Vector3(8.5, mobile.matches ? 18 : 14.8, 17);
  camera.position.copy(home);
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile.matches ? 1.5 : 1.8));
  renderer.setClearColor(0xdce5d4, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.09;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, .55, 0);
  controls.enableDamping = !reduced.matches;
  controls.dampingFactor = .075;
  controls.enablePan = false;
  controls.rotateSpeed = .40;
  controls.zoomSpeed = .55;
  controls.minPolarAngle = .48;
  controls.maxPolarAngle = 1.08;
  controls.minZoom = .78;
  controls.maxZoom = 1.8;
  controls.update();
  const sun = new THREE.DirectionalLight(0xffedcc, 2.75);
  sun.position.set(-7, 14, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera,{left:-11,right:11,top:11,bottom:-11,near:.1,far:40});
  sun.shadow.bias = -.00035; sun.shadow.normalBias = .04; sun.shadow.radius = 4;
  const hemisphere = new THREE.HemisphereLight(0xeaf0df, 0x738967, 2.15);
  scene.add(sun, hemisphere);
  const fill = new THREE.DirectionalLight(0xcbdeda,.55); fill.position.set(5,5,-6); scene.add(fill);
  let nightMode = false, nightBlend = 0, nightTransition = null;
  const nightStars = new THREE.Group();
  if (!mobile.matches) {
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 58; i++) starPositions.push((i * 37 % 100 - 50) * .28, 3.8 + (i * 17 % 50) * .045, (i * 23 % 50 - 25) * .22);
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xf4dfaa, size: .06, transparent: true, opacity: .82, sizeAttenuation: true });
    nightStars.add(new THREE.Points(starGeometry, starMaterial));
  }
  const moon = new THREE.Mesh(new THREE.SphereGeometry(.54, 20, 14), new THREE.MeshBasicMaterial({ color: 0xf1e3b6, transparent: true, opacity: .9 }));
  moon.position.set(-5.8, 4.25, -2.5); nightStars.add(moon);
  nightStars.visible = false; scene.add(nightStars);
  let seed = 5221;
  const random = () => { seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
  const range = (a,b) => a+(b-a)*random();
  const mat = (color, options={}) => new THREE.MeshStandardMaterial({color,roughness:.96,...options});
  const hill = (x,z,cx,cz,h,sx,sz) => h*Math.exp(-((x-cx)**2/sx+(z-cz)**2/sz));
  const riverX = z => -1.5+1.25*Math.sin(z*.55)+.20*Math.sin(z*1.3);
  function heightAt(x,z) {
    let h = .24 + .06*Math.sin(x*1.4+z*.6) + .05*Math.cos(z*1.6-x*.7);
    h += hill(x,z,-3.2,2.5,1.25,5.8,3.1) + hill(x,z,-5.1,.3,.55,2.5,3.0);
    h += hill(x,z,2.9,-2.0,1.68,4.8,4.1) + hill(x,z,5.5,-1.6,.52,1.8,2.3);
    h += hill(x,z,3.9,2.5,.87,4.0,3.5) + hill(x,z,5.0,3.2,.55,1.9,1.6);
    h += hill(x,z,-4.35,-2.6,.55,2.6,2.0);
    const distance = Math.abs(x-riverX(z));
    return THREE.MathUtils.lerp(.075,h,THREE.MathUtils.smoothstep(distance,.24,.78));
  }
  const boundary = a => 1+.06*Math.sin(a*3+.4)+.045*Math.cos(a*7)+.018*Math.sin(a*11);
  const inside = (x,z,margin=1) => Math.hypot(x/7.0,z/4.9) < boundary(Math.atan2(z/4.9,x/7.0))*margin;
  const vertices=[],colors=[],indices=[];
  const rings=46, segments=144;
  const grassLow=new THREE.Color(0x9fb77b),grassHigh=new THREE.Color(0x90ab71),riverBank=new THREE.Color(0xc5c19a);
  for(let r=0;r<=rings;r++) for(let s=0;s<=segments;s++) {
    const a=s/segments*Math.PI*2, radius=r/rings*boundary(a);
    const x=Math.cos(a)*radius*7, z=Math.sin(a)*radius*4.9, y=heightAt(x,z);
    vertices.push(x,y,z);
    const color=grassLow.clone().lerp(grassHigh,Math.min(1,y/2));
    const bank=1-THREE.MathUtils.smoothstep(Math.abs(x-riverX(z)),.28,.60);
    const meadowTint = .5 + .5 * Math.sin(x * 1.7 + Math.cos(z * 2.1)) * Math.cos(z * .9);
    color.lerp(new THREE.Color(0xbbc68a), meadowTint * .18);
    color.lerp(riverBank,bank*.67); color.multiplyScalar(range(.985,1.015));
    colors.push(color.r,color.g,color.b);
    if(r<rings && s<segments) {
      const v=r*(segments+1)+s;
      indices.push(v,v+segments+1,v+1,v+1,v+segments+1,v+segments+2);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const terrain=new THREE.Mesh(geometry,mat(0xf3f1e6,{vertexColors:true,side:THREE.DoubleSide}));
  terrain.receiveShadow=true; root.add(terrain);

  const sideVertices=[],sideColors=[],sideIndices=[];
  for(let r=0;r<5;r++) for(let s=0;s<=segments;s++) {
    const a=s/segments*Math.PI*2, b=boundary(a), f=[1,1.003,.983,.952,.89][r];
    const x=Math.cos(a)*b*7*f,z=Math.sin(a)*b*4.9*f;
    const y=r===0?heightAt(x,z):[0,-.12,-.29,-.47,-.64][r]+.035*Math.sin(a*9+r*.4);
    sideVertices.push(x,y,z);
    const c=new THREE.Color([0xa8b18d,0xb3b69a,0x9ca889,0xa4ac94,0x8d9d80][r]).multiplyScalar(range(.97,1.03));
    sideColors.push(c.r,c.g,c.b);
    if(r<4&&s<segments){const v=r*(segments+1)+s;sideIndices.push(v,v+1,v+segments+1,v+1,v+segments+2,v+segments+1);}
  }
  const sides=new THREE.BufferGeometry();
  sides.setAttribute('position',new THREE.Float32BufferAttribute(sideVertices,3));
  sides.setAttribute('color',new THREE.Float32BufferAttribute(sideColors,3));
  sides.setIndex(sideIndices); sides.computeVertexNormals();
  const cliffEdge=new THREE.Mesh(sides,mat(0xf3f1e6,{vertexColors:true,flatShading:true,side:THREE.DoubleSide}));
  cliffEdge.castShadow=cliffEdge.receiveShadow=true;root.add(cliffEdge);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(45,45),new THREE.ShadowMaterial({color:0x657653,opacity:.12}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=-.72;shadow.receiveShadow=true;scene.add(shadow);

  const waterVertices=[],waterUV=[],waterIndices=[];
  for(let i=0;i<=140;i++) {
    const z=-4.35+i/140*9.0,x=riverX(z),w=.24+.045*Math.sin(z*2.3);
    waterVertices.push(x-w,.117,z,x+w,.117,z);
    waterUV.push(0,i/140,1,i/140);
    if(i<140){const v=i*2;waterIndices.push(v,v+2,v+1,v+1,v+2,v+3);}
  }
  const waterGeometry=new THREE.BufferGeometry();
  waterGeometry.setAttribute('position',new THREE.Float32BufferAttribute(waterVertices,3));
  waterGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(waterUV,2));
  waterGeometry.setIndex(waterIndices);waterGeometry.computeVertexNormals();
  const waterMaterial=new THREE.ShaderMaterial({
    uniforms:{time:{value:0},night:{value:0},waterColor:{value:new THREE.Color(0x78afa0)}},side:THREE.DoubleSide,
    vertexShader:'varying vec2 place;void main(){place=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform float time;uniform float night;uniform vec3 waterColor;varying vec2 place;
      void main(){float wave=sin(place.y*170.0+place.x*3.0-time*.8);
      float ripple=pow(max(0.0,wave),22.0)*(.55+.45*sin(place.x*13.0+place.y*65.0));
      float edge=smoothstep(.33,.5,abs(place.x-.5));
      vec3 reflection=mix(vec3(.73,.84,.73),vec3(.40,.64,.63),night);
      gl_FragColor=vec4(mix(waterColor,reflection,ripple*.25+edge*.15),1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  });
  root.add(new THREE.Mesh(waterGeometry,waterMaterial));
  const pebbleGeometry=new THREE.IcosahedronGeometry(1,0);
  const pebbles=new THREE.InstancedMesh(pebbleGeometry,mat(0xaaa98e),110);
  const dummy=new THREE.Object3D();
  for(let i=0;i<110;i++) {
    const z=range(-4.25,4.45),x=riverX(z)+(i%2?1:-1)*range(.35,.58);
    dummy.position.set(x,heightAt(x,z)+.035,z);dummy.rotation.set(0,range(0,6),range(-.2,.2));
    dummy.scale.set(range(.05,.13),range(.04,.09),range(.06,.15));dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);
  }
  pebbles.castShadow=true;root.add(pebbles);

  const reedPositions=[], reedColors=[];
  for(let cluster=0;cluster<58;cluster++){
    const z=range(-4.0,4.15),x=riverX(z)+(cluster%2?1:-1)*range(.45,.67);
    for(let blade=0;blade<5;blade++){
      const px=x+range(-.065,.065),pz=z+range(-.085,.085),y=heightAt(px,pz);
      const h=range(.13,.29),lean=range(-.065,.065),w=.018;
      reedPositions.push(px-w,y,pz,px+w,y,pz,px+lean,y+h,pz+.025);
      const c=new THREE.Color(blade%2?0x7c996c:0x9aa879);
      for(let vertex=0;vertex<3;vertex++)reedColors.push(c.r,c.g,c.b);
    }
  }
  const reedGeometry=new THREE.BufferGeometry();
  reedGeometry.setAttribute('position',new THREE.Float32BufferAttribute(reedPositions,3));
  reedGeometry.setAttribute('color',new THREE.Float32BufferAttribute(reedColors,3));
  reedGeometry.computeVertexNormals();
  root.add(new THREE.Mesh(reedGeometry,mat(0xffffff,{vertexColors:true,side:THREE.DoubleSide})));

  const pathPoints=[[-3.7,2.9],[-2.35,2.2],[-1.25,1.3],[-1.05,.2],[.35,-.4],[1.35,-1.1],[2.6,-1.8]];
  const pathCurve=new THREE.CatmullRomCurve3(pathPoints.map(p=>new THREE.Vector3(p[0],0,p[1])));
  const trailVertices=[],trailIndices=[],trailColors=[];
  for(let i=0;i<=100;i++){
    const p=pathCurve.getPoint(i/100),tangent=pathCurve.getTangent(i/100),halfWidth=.17+.025*Math.sin(i*.4);
    for(const side of [-1,1]){
      const x=p.x+side*tangent.z*halfWidth,z=p.z-side*tangent.x*halfWidth;
      trailVertices.push(x,heightAt(x,z)+.007,z);
      const c=new THREE.Color(0xb7b795).multiplyScalar(.98+.025*Math.sin(i*.24));
      trailColors.push(c.r,c.g,c.b);
    }
    if(i<100&&Math.abs(p.x-riverX(p.z))>.59){const v=i*2;trailIndices.push(v,v+2,v+1,v+1,v+2,v+3);}
  }
  const trailGeometry=new THREE.BufferGeometry();
  trailGeometry.setAttribute('position',new THREE.Float32BufferAttribute(trailVertices,3));
  trailGeometry.setAttribute('color',new THREE.Float32BufferAttribute(trailColors,3));
  trailGeometry.setIndex(trailIndices);trailGeometry.computeVertexNormals();
  const trail=new THREE.Mesh(trailGeometry,mat(0xffffff,{vertexColors:true,side:THREE.DoubleSide}));
  trail.receiveShadow=true;root.add(trail);
  const flagstones=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,.036,6),mat(0xc5c3a4),43);
  for(let i=0;i<43;i++){
    const p=pathCurve.getPoint(i/42);const distance=Math.abs(p.x-riverX(p.z));
    dummy.position.set(p.x,heightAt(p.x,p.z)+.045,p.z);
    dummy.rotation.set(0,range(-.5,.5),0);dummy.scale.set(.15,distance<.6?0:1,.12);dummy.updateMatrix();flagstones.setMatrixAt(i,dummy.matrix);
  }
  flagstones.receiveShadow=true;root.add(flagstones);
  const bridgeShape=new THREE.Shape();
  bridgeShape.moveTo(-.95,0);bridgeShape.lineTo(-.95,.5);bridgeShape.lineTo(.95,.5);bridgeShape.lineTo(.95,0);
  bridgeShape.lineTo(.60,0);bridgeShape.bezierCurveTo(.53,.43,-.53,.43,-.60,0);bridgeShape.closePath();
  const bridge=new THREE.Group();bridge.position.set(riverX(.10),.1,.10);bridge.rotation.y=-.15;
  const bridgeMat=mat(0xb1b69c);
  const arch=new THREE.Mesh(new THREE.ExtrudeGeometry(bridgeShape,{depth:.44,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1,curveSegments:14}),bridgeMat);
  arch.position.z=-.22;arch.castShadow=arch.receiveShadow=true;bridge.add(arch);
  for(const side of [-1,1])for(let i=0;i<6;i++){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.26,.14,.1),bridgeMat);
    rail.position.set(-.8+i*.32,.59,side*.28);rail.castShadow=true;bridge.add(rail);
  }
  const bridgeTileMaterial=mat(0xc8c7a9);
  for(let i=0;i<9;i++){
    const tile=new THREE.Mesh(new THREE.BoxGeometry(.185,.028,.49),bridgeTileMaterial);
    tile.position.set(-.82+i*.205,.519,0);tile.receiveShadow=true;bridge.add(tile);
  }
  root.add(bridge);

  const landmarks=window.buildMapLandmarks(THREE,root,heightAt,random);
  const lanternLights = (landmarks.lanterns || []).map(lantern => {
    const light = new THREE.PointLight(0xffd398, 0, 2.5, 1.4);
    light.position.copy(lantern.position); light.position.y += .4;
    root.add(light);
    return light;
  });
  const grassPositions=[];
  for(let i=0;i<(mobile.matches?330:720);i++){
    const x=range(-6.7,6.7),z=range(-4.5,4.5);
    if(!inside(x,z,.92)||Math.abs(x-riverX(z))<.72)continue;
    const y=heightAt(x,z)+.02,h=range(.05,.15),w=.012;
    grassPositions.push(x-w,y,z,x+w,y,z,x+range(-.035,.035),y+h,z+.018);
  }
  const grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute(grassPositions,3));grassGeo.computeVertexNormals();
  root.add(new THREE.Mesh(grassGeo,mat(0x718e56,{side:THREE.DoubleSide})));
  const flowers=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.027,0),mat(0xf0dfb2),110);
  for(let i=0;i<110;i++){
    const x=range(-4.8,-1.8),z=range(1.6,3.8);dummy.position.set(x,heightAt(x,z)+range(.07,.15),z);
    dummy.scale.setScalar(range(.7,1.25));dummy.rotation.set(0,0,0);dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);
    flowers.setColorAt(i,new THREE.Color(i%5===0?0xb6a6ae:0xf3e2b3));
  }
  root.add(flowers);

  const fogMaterial=new THREE.ShaderMaterial({
    uniforms:{time:{value:0},opacity:{value:.28},fogColor:{value:new THREE.Color(0xe3edd6)}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:'varying vec2 place;void main(){place=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform float time;uniform float opacity;uniform vec3 fogColor;varying vec2 place;
      float noise(vec2 p){return sin(p.x*5.3+sin(p.y*4.2))*sin(p.y*3.4+sin(p.x*3.1))*.5+.5;}
      void main(){vec2 q=place*2.0-1.0;float edge=1.0-smoothstep(.15,1.0,length(q));
      float clouds=.5*noise(place*3.0+vec2(time*.018,0.0))+.5*noise(place*7.0-vec2(time*.01,0.0));
      gl_FragColor=vec4(fogColor,edge*clouds*opacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  });
  const mist=new THREE.Group();
  for(let i=0;i<4;i++){
    const veil=new THREE.Mesh(new THREE.PlaneGeometry(4.4,3.4),fogMaterial);
    veil.rotation.x=-Math.PI/2;veil.position.set(3.9+i*.12,1.2+i*.40,2.45);mist.add(veil);
  }
  root.add(mist);

  const regions=chapters.map(chapter=>{
    const [x,z]=chapter.position,y=heightAt(x,z);
    const beacon=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),mat(0xe6cf8c,{emissive:0xb58b45,emissiveIntensity:.3}));
    beacon.position.set(x,y+.1,z);root.add(beacon);
    return {...chapter,label:document.querySelector(`.region-label[data-chapter="${chapter.id}"]`),line:document.querySelector(`.region-thread[data-chapter="${chapter.id}"]`),
      point:new THREE.Vector3(x,y+.35,z),anchor:new THREE.Vector3(x,y+chapter.labelHeight,z),beacon,width:140,height:38};
  });
  let width=1,height=1,active=section.classList.contains('active'),frame=0,lastFrame=0,needsRender=true,hovered=null;
  const restoration = window.createMapRestoration(THREE, { root, heightAt, reduced, riverX });
  const explorer = window.createMapExplorer(THREE, { root, camera, canvas, section, heightAt, inside, riverX,
    obstacles: [...landmarks.obstacles,restoration.footprint,restoration.restorationFootprint], bridge: { x: bridge.position.x, z: bridge.position.z, rotation: bridge.rotation.y, height: .633 },
    reduced, mobile, invalidate: () => { needsRender = true; } });
  let journalOpen = false, campOpen = false, tentSession = null;
  const camp = window.createCampScene(THREE, OrbitControls, { reduced });
  const campButton=document.getElementById('campEnter');
  const repairButton=document.getElementById('canyonRestore');
  const tentAnchor=new THREE.Vector3(restoration.tentPoint.x,heightAt(restoration.tentPoint.x,restoration.tentPoint.z)+.1,restoration.tentPoint.z);
  function enterCamp(){camp.setNight(nightMode);camp.open();}
  campButton.addEventListener('click',enterCamp);
  const garden = window.createGardenGame(THREE, { root, heightAt, explorer, reduced, section,
    invalidate: () => { needsRender = true; } });
  const tentPlacement = window.createTentPlacement({ heightAt, inside, riverX,
    navigation: explorer.navigation, initial: restoration.tentPoint,
    obstacles: [...landmarks.obstacles,restoration.restorationFootprint],
    bridge: { x: bridge.position.x, z: bridge.position.z, rotation: bridge.rotation.y },
    getTraveler: () => explorer.snapshot(), getFlowers: () => garden.snapshot().flowers,
    onCommit(point) { explorer.clearRoute(); garden.clearGuidance(); restoration.moveTent(point); needsRender=true; }
  });
  tentPlacement.restore();
  function moveLandRing(mesh,point) {
    const positions=mesh.geometry.getAttribute('position'),radii=mesh.userData.radii;
    for(let index=0;index<=48;index++)for(let edge=0;edge<2;edge++) {
      const angle=index/48*Math.PI*2,radius=radii[edge];
      const x=point.x+Math.cos(angle)*radius,z=point.z+Math.sin(angle)*radius;
      positions.setXYZ(index*2+edge,x,heightAt(x,z)+.026,z);
    }
    positions.needsUpdate=true;mesh.geometry.computeBoundingSphere();
  }
  function createLandRing(point,inner,outer,material) {
    const geometry=new THREE.BufferGeometry(),indices=[];
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(49*6),3));
    for(let index=0;index<48;index++){const at=index*2;indices.push(at,at+1,at+2,at+1,at+3,at+2);}
    geometry.setIndex(indices);
    const mesh=new THREE.Mesh(geometry,material);mesh.userData.radii=[inner,outer];moveLandRing(mesh,point);
    return mesh;
  }
  const tentHalo=createLandRing(tentPlacement.position,.75,.79,new THREE.MeshBasicMaterial({color:0x829f69,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));
  tentHalo.visible=false;root.add(tentHalo);
  const tentHints=new THREE.Group();tentHints.visible=false;root.add(tentHints);
  const hintMaterial=new THREE.MeshBasicMaterial({color:0xf1e5b7,transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false});
  function clearTentHints() {
    tentHints.children.forEach(mesh=>mesh.geometry.dispose());tentHints.clear();tentHints.visible=false;
    canvas.dataset.tentHints='[]';canvas.dataset.tentSnapped='false';
  }
  function showTentHints() {
    if(tentSession.hints)return;
    tentSession.hints=tentPlacement.hints(mobile.matches?5:6);
    tentSession.hints.forEach(point=>tentHints.add(createLandRing(point,mobile.matches?.34:.30,mobile.matches?.39:.325,hintMaterial)));
    tentHints.visible=true;canvas.dataset.tentHints=JSON.stringify(tentSession.hints);needsRender=true;
  }
  canvas.dataset.tentPosition=JSON.stringify(tentPlacement.position);
  campButton.title='点击进入营地；按住地图上的帐篷拖动搬家';
  const labelExclusions=Array.from(section.querySelectorAll('#gardenQuest,.map-header,#mapNight,#journalOpen,.traveler-dock,.map-tools,.map-status'));
  function placeLabel(x,y,w,h,blocked,minY=92) {
    const clampX=value=>THREE.MathUtils.clamp(value,8,Math.max(8,width-w-8));
    const clampY=value=>THREE.MathUtils.clamp(value,minY,Math.max(minY,height-h-82));
    const candidates=[{x,y}],gap=8;
    for(const box of blocked) {
      const xs=[box.x-w-gap,box.x+box.w+gap],ys=[box.y-h-gap,box.y+box.h+gap];
      for(const bx of xs)candidates.push({x:bx,y});
      for(const by of ys)candidates.push({x,y:by});
      for(const bx of xs)for(const by of ys)candidates.push({x:bx,y:by});
    }
    let best={x:clampX(x),y:clampY(y)},bestScore=Infinity;
    for(const candidate of candidates) {
      const cx=clampX(candidate.x),cy=clampY(candidate.y);
      let score=(cx-x)**2+(cy-y)**2;
      for(const box of blocked) {
        const overlapX=Math.min(cx+w+gap,box.x+box.w)-Math.max(cx-gap,box.x);
        const overlapY=Math.min(cy+h+gap,box.y+box.h)-Math.max(cy-gap,box.y);
        if(overlapX>0&&overlapY>0)score+=1e8+overlapX*overlapY*10000;
      }
      if(score<bestScore){best={x:cx,y:cy};bestScore=score;}
    }
    return best;
  }
  function labelLayout(){
    const canvasBounds=canvas.getBoundingClientRect();
    const occupied=labelExclusions.filter(element=>!element.hidden).map(element=>{
      const rect=element.getBoundingClientRect();
      return {x:rect.left-canvasBounds.left,y:rect.top-canvasBounds.top,w:rect.width,h:rect.height};
    }).filter(box=>box.w>0&&box.h>0);
    const placements=regions.map(region=>{
      const anchor=region.anchor.clone().project(camera),point=region.point.clone().project(camera);
      const w=region.width,h=region.height;
      return {region,w,h,x:THREE.MathUtils.clamp((anchor.x+1)*width/2-w/2,12,width-w-12),
        y:THREE.MathUtils.clamp((1-anchor.y)*height/2-h,96,height-h-90),px:(point.x+1)*width/2,py:(1-point.y)*height/2};
    });
    // Labels follow the projected landmarks; resolve collisions in screen space.
    for(let pass=0;pass<8;pass++)for(let a=0;a<placements.length;a++)for(let b=a+1;b<placements.length;b++){
      const p=placements[a],q=placements[b];
      if(p.x<q.x+q.w+7&&p.x+p.w+7>q.x&&p.y<q.y+q.h+10&&p.y+p.h+10>q.y){
        const sign=(p.y+p.h/2<=q.y+q.h/2)?-1:1;
        p.y=THREE.MathUtils.clamp(p.y+sign*7,92,height-p.h-82);
        q.y=THREE.MathUtils.clamp(q.y-sign*7,92,height-q.h-82);
      }
    }
    for(const p of placements){
      const reserveH=p.h+(p.region.id==='canyon'&&!repairButton.hidden?repairButton.offsetHeight+6:0);
      Object.assign(p,placeLabel(p.x,p.y,p.w,reserveH,occupied));
      occupied.push({x:p.x,y:p.y,w:p.w,h:reserveH});
      p.region.label.style.transform=`translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0)`;
      const dx=p.x+p.w/2-p.px,dy=p.y+p.h-p.py;
      p.region.line.style.width=`${Math.hypot(dx,dy)}px`;
      p.region.line.style.transform=`translate(${p.px}px,${p.py}px) rotate(${Math.atan2(dy,dx)}rad)`;
      if(p.region.id==='canyon'){
        const repairX=Math.max(8,p.x+p.w/2-repairButton.offsetWidth/2),repairY=p.y+p.h+6;
        repairButton.style.transform=`translate(${repairX}px,${repairY}px)`;
        if(!repairButton.hidden)occupied.push({x:repairX,y:repairY,w:repairButton.offsetWidth,h:repairButton.offsetHeight});
      }
    }
    tentAnchor.copy(restoration.tent.position);tentAnchor.y+=.1;
    const tentScreen=tentAnchor.clone().project(camera);
    const campX=THREE.MathUtils.clamp((tentScreen.x+1)*width/2-campButton.offsetWidth/2,8,width-campButton.offsetWidth-8);
    const campY=THREE.MathUtils.clamp((1-tentScreen.y)*height/2+12,130,height-100);
    const campPlacement=placeLabel(campX,campY,campButton.offsetWidth,campButton.offsetHeight,occupied,110);
    campButton.style.transform=`translate(${campPlacement.x}px,${campPlacement.y}px)`;
  }
  function fit(){
    width=canvas.clientWidth;height=canvas.clientHeight;if(!width||!height)return;
    renderer.setSize(width,height,false);
    const aspect=width/height,span=Math.max(11.9,16.3/aspect);
    camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    regions.forEach(region=>{region.width=region.label.offsetWidth;region.height=region.label.offsetHeight;});
    labelLayout();needsRender=true;
  }
  const observer=new ResizeObserver(fit);observer.observe(canvas);fit();
  document.fonts?.ready.then(fit);
  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
  function groundAt(event){
    const rect=canvas.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(mouse,camera);
    return raycaster.intersectObject(terrain,false)[0]?.point || null;
  }
  function setHover(region){
    hovered=region?.id||null;
    regions.forEach(r=>r.label.classList.toggle('is-hovered',r.id===hovered));
    canvas.style.cursor=region?'pointer':'grab';needsRender=true;
  }
  let down=null,dragged=false,multiTouch=false;
  const pointers=new Set();
  function pauseForTent(value) {
    explorer.setActive(active&&!document.hidden&&!journalOpen&&!campOpen&&!value);
    garden.setActive(active&&!document.hidden&&!journalOpen&&!campOpen&&!value);
    controls.enabled=active&&!journalOpen&&!campOpen&&!value&&!multiTouch;
    document.dispatchEvent(new CustomEvent('journey:tent-drag',{detail:{active:value}}));
    needsRender=true;
  }
  function cancelTent(message) {
    if(!tentSession)return;
    tentSession=null;restoration.moveTent(tentPlacement.position);tentHalo.visible=false;clearTentHints();
    canvas.dataset.tentDragging='false';canvas.style.cursor='grab';
    pauseForTent(false);
    if(message)explorer.say(message);
  }
  function previewTent(event) {
    showTentHints();
    const point=groundAt(event);
    if(point) {
      point.x+=tentSession.offset.x;point.z+=tentSession.offset.z;
      const landing=tentPlacement.snap(point,tentSession.hints);
      tentSession.point=landing;
      canvas.dataset.tentSnapped=String(Math.hypot(point.x-landing.x,point.z-landing.z)>.001);
      restoration.previewTent(landing);
      tentSession.result=tentPlacement.preview(landing);
    } else {tentSession.point=null;canvas.dataset.tentSnapped='false';tentSession.result={valid:false,reason:'把帐篷放在岛上的草地上吧。'};}
    tentHalo.visible=true;
    moveLandRing(tentHalo,restoration.tent.position);
    tentHalo.material.color.setHex(tentSession.result.valid?0x829f69:0xb77461);
    canvas.dataset.tentPlacement=tentSession.result.valid?'valid':'invalid';
    canvas.style.cursor=tentSession.result.valid?'grabbing':'not-allowed';needsRender=true;
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!active||journalOpen||campOpen||event.button!==0)return;
    pointers.add(event.pointerId);
    if(pointers.size>1){multiTouch=true;dragged=true;down=null;if(tentSession){cancelTent();controls.enabled=false;event.preventDefault();}return;}
    down={id:event.pointerId,x:event.clientX,y:event.clientY};dragged=false;
    const point=groundAt(event);
    if(raycaster.intersectObject(restoration.tent,true).length) {
      const original=tentPlacement.position;
      tentSession={id:event.pointerId,point:original,result:null,offset:{x:original.x-(point?.x??original.x),z:original.z-(point?.z??original.z)}};
      pauseForTent(true);canvas.setPointerCapture(event.pointerId);event.preventDefault();
    }
  },true);
  canvas.addEventListener('pointermove',event=>{
    if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)dragged=true;
    if(tentSession?.id===event.pointerId){if(dragged){canvas.dataset.tentDragging='true';previewTent(event);}event.preventDefault();return;}
    if(!down)canvas.style.cursor=groundAt(event)?'pointer':'grab';
  },true);
  canvas.addEventListener('pointerup',event=>{
    if(tentSession?.id===event.pointerId){
      const shouldEnter=!dragged&&!multiTouch;
      if(dragged&&!multiTouch){
        previewTent(event);
        const result=tentPlacement.place(tentSession.point);
        explorer.say(result.reason);canvas.dataset.tentPosition=JSON.stringify(tentPlacement.position);
      }
      cancelTent();
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      if(shouldEnter)enterCamp();
      event.preventDefault();
    } else if(active&&!journalOpen&&!campOpen&&down?.id===event.pointerId&&!dragged&&!multiTouch&&event.button===0){
      const ground=groundAt(event);
      if(ground){canvas.focus({preventScroll:true});garden.clearGuidance();explorer.moveTo(ground);needsRender=true;}
    }
    pointers.delete(event.pointerId);down=null;
    if(pointers.size===0){multiTouch=false;controls.enabled=active&&!journalOpen&&!campOpen;}
  },true);
  canvas.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);down=null;dragged=true;cancelTent();if(pointers.size===0){multiTouch=false;controls.enabled=active&&!journalOpen&&!campOpen;}},true);
  canvas.addEventListener('lostpointercapture',()=>{if(tentSession){cancelTent();down=null;dragged=true;pointers.clear();multiTouch=false;}});
  window.addEventListener('blur',()=>{cancelTent();down=null;dragged=true;pointers.clear();multiTouch=false;});
  canvas.addEventListener('pointerleave',()=>{if(!tentSession)setHover(null);});
  for(const region of regions){
    region.label.addEventListener('pointerenter',()=>setHover(region));
    region.label.addEventListener('pointerleave',()=>setHover(null));
    region.label.addEventListener('focus',()=>setHover(region));
    region.label.addEventListener('blur',()=>setHover(null));
  }
  controls.addEventListener('change',()=>{needsRender=true;});
  controls.addEventListener('start',()=>{setHover(null);});
  document.addEventListener('journey:visited',()=>{fit();needsRender=true;});
  const inspect=new URLSearchParams(location.search).has('inspectMap');let lastCheck=0;
  function pixelCheck(time){
    if(!inspect||time-lastCheck<900)return;
    const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,p=new Uint8Array(w*h*4);
    gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);
    let painted=0,checksum=0,left=w,right=0,top=h,bottom=0;
    for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=3){const i=(y*w+x)*4;if(p[i+3]<220)continue;painted++;checksum=(checksum+p[i]*3+p[i+1]*5+p[i+2]*7)>>>0;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,h-y);bottom=Math.max(bottom,h-y);}
    canvas.dataset.pixelCheck=JSON.stringify({width:w,height:h,painted,checksum,bounds:[left,top,right,bottom],zoom:camera.zoom,night:nightMode,nightBlend,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});lastCheck=time;
  }
  function animate(time){
    frame=0;if(!active||document.hidden||journalOpen||campOpen)return;
    if(!tentSession)controls.update();
    if(time-lastFrame>30&&(!reduced.matches||needsRender||explorer.needsAnimation)){
      const t=reduced.matches?0:time/1000;
      const dt=Math.min(.06,Math.max(0,(time-lastFrame)/1000));
      updateNightTransition(time);
      explorer.update(dt, t, nightBlend);
      garden.update(dt, t, nightBlend);
      restoration.update(t, nightBlend, garden.snapshot().canyonRestored);
      waterMaterial.uniforms.time.value=t;fogMaterial.uniforms.time.value=t;
      const fogTarget=(window.journeyVisited?.has('unknown')?.12:.28)+nightBlend*.12;
      fogMaterial.uniforms.opacity.value=reduced.matches?fogTarget:fogMaterial.uniforms.opacity.value+(fogTarget-fogMaterial.uniforms.opacity.value)*.05;
      for(const tree of landmarks.trees||[])tree.group.rotation.z=Math.sin(t*.65+tree.phase)*.018;
      for(const region of regions){
        const strength=(region.id===hovered?1.25:window.journeyVisited?.has(region.id)?.7:.15)+nightBlend*.7;
        region.beacon.material.emissiveIntensity=reduced.matches?strength:region.beacon.material.emissiveIntensity+(strength-region.beacon.material.emissiveIntensity)*.15;
      }
      camera.updateMatrixWorld();labelLayout();renderer.render(scene,camera);pixelCheck(time);
      section.dataset.sceneReady='true';canvas.dataset.sceneReady='true';needsRender=false;lastFrame=time;
    }
    frame=requestAnimationFrame(animate);
  }
  function resume(){
    active=section.classList.contains('active');needsRender=true;
    if(!active||document.hidden||journalOpen||campOpen)cancelTent();
    explorer.setActive(active&&!document.hidden&&!journalOpen&&!campOpen&&!tentSession);
    garden.setActive(active&&!document.hidden&&!journalOpen&&!campOpen&&!tentSession);
    controls.enabled=active&&!journalOpen&&!campOpen&&!tentSession;
    lastFrame=performance.now();
    if(!active){down=null;dragged=false;multiTouch=false;pointers.clear();}
    if(active&&!document.hidden&&!journalOpen&&!campOpen&&!frame){fit();frame=requestAnimationFrame(animate);}
    else if((!active||document.hidden||journalOpen||campOpen)&&frame){cancelAnimationFrame(frame);frame=0;}
  }
  new MutationObserver(resume).observe(section,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',resume);
  document.addEventListener('journey:journal',event=>{journalOpen=event.detail.open;down=null;pointers.clear();resume();});
  document.addEventListener('journey:camp',event=>{campOpen=event.detail.open;down=null;pointers.clear();resume();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&tentSession){cancelTent('帐篷留在了原处。');down=null;dragged=true;pointers.clear();event.preventDefault();return;}
    if(active&&!journalOpen&&!campOpen&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(event.code))garden.clearGuidance();
  });
  reduced.addEventListener('change',()=>{controls.enableDamping=!reduced.matches;applyNight(nightMode,true);resume();});
  const lightingColors = {
    sun: [0xffedcc,0xb9d5dc], sky:[0xeaf0df,0x8faea6], ground:[0x738967,0x4c6758],
    fill:[0xcbdeda,0x90b4af], water:[0x78afa0,0x365b59], fog:[0xe3edd6,0x738f87],
    foliage:[0x789669,0x3d5946]
  };
  Object.keys(lightingColors).forEach(key=>{lightingColors[key]=lightingColors[key].map(color=>new THREE.Color(color));});
  function renderLighting() {
    const blend = nightBlend;
    sun.intensity = THREE.MathUtils.lerp(2.2, 1.08, blend);
    hemisphere.intensity = THREE.MathUtils.lerp(1.55, 1.35, blend);
    fill.intensity = THREE.MathUtils.lerp(.42, .24, blend);
    sun.color.lerpColors(...lightingColors.sun,blend);
    hemisphere.color.lerpColors(...lightingColors.sky,blend);
    hemisphere.groundColor.lerpColors(...lightingColors.ground,blend);
    fill.color.lerpColors(...lightingColors.fill,blend);
    waterMaterial.uniforms.waterColor.value.lerpColors(...lightingColors.water,blend);
    fogMaterial.uniforms.fogColor.value.lerpColors(...lightingColors.fog,blend);
    waterMaterial.uniforms.night.value=blend;
    renderer.toneMappingExposure=THREE.MathUtils.lerp(1.04,.98,blend);
    shadow.material.opacity=THREE.MathUtils.lerp(.12,.24,blend);
    const foliageMaterial = landmarks.foliageMaterial;
    if (foliageMaterial) {
      foliageMaterial.color.lerpColors(...lightingColors.foliage, blend);
      foliageMaterial.emissiveIntensity = THREE.MathUtils.lerp(.22, .08, blend);
    }
    (landmarks.glowMaterials||[]).forEach(material=>{material.emissiveIntensity=THREE.MathUtils.lerp(.035,2.6,blend);});
    lanternLights.forEach(light=>{light.intensity=blend*1.55;});
    canvas.dataset.nightBlend=blend.toFixed(3);
  }
  function applyNight(value, immediate = false) {
    nightMode = Boolean(value);
    section.dataset.night = String(nightMode);
    const target = nightMode ? 1 : 0;
    if (immediate || reduced.matches) {
      nightTransition = null; nightBlend = target;
      renderLighting();
    } else {
      nightTransition = {from:nightBlend,to:target,start:performance.now()};
    }
    nightStars.visible = nightMode;
    needsRender = true;
    document.dispatchEvent(new CustomEvent('journey:map-theme',{detail:{night:nightMode}}));
  }
  function updateNightTransition(time) {
    if (!nightTransition) return;
    const progress=THREE.MathUtils.clamp((time-nightTransition.start)/1000,0,1);
    nightBlend=THREE.MathUtils.lerp(nightTransition.from,nightTransition.to,1-Math.pow(1-progress,3));
    renderLighting();
    if(progress===1)nightTransition=null;
  }
  const savedNight = (() => { try { return localStorage.getItem('quiet-lands-night') === 'true'; } catch { return false; } })();
  applyNight(savedNight, true);
  resume();
  return {
    reset(){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();camera.position.copy(home);camera.zoom=1;controls.target.set(0,.55,0);camera.updateProjectionMatrix();controls.update();controls.enableDamping=damping;needsRender=true;},
    zoom(factor){camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();controls.update();needsRender=true;},
    setNight(value){
      applyNight(value);
      try { localStorage.setItem('quiet-lands-night', String(Boolean(value))); } catch { /* Night mode still works without storage. */ }
    },
    isNight(){ return nightMode; },
    travelerState(){ return explorer.snapshot(); }
  };
};
