window.createGardenScene = function createGardenScene(THREE, root, heightAt, reduced, seedPoint) {
  const green = new THREE.MeshStandardMaterial({ color: 0x718956, roughness: .88 });
  const petals = new THREE.MeshStandardMaterial({ color: 0xf0e8ce, roughness: .85, emissive: 0xc4af70, emissiveIntensity: .08 });
  const heart = new THREE.MeshStandardMaterial({ color: 0xcab369, roughness: .78, emissive: 0xb39248, emissiveIntensity: .16 });
  const mesh = (geometry, material, parent, x, y, z, scale) => {
    const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z);
    if (scale) object.scale.set(...scale);
    object.castShadow = object.receiveShadow = true; parent.add(object); return object;
  };
  const seed = new THREE.Group(); seed.position.set(seedPoint.x, heightAt(seedPoint.x, seedPoint.z) + .04, seedPoint.z); root.add(seed);
  const seedBody = mesh(new THREE.IcosahedronGeometry(.115, 1), heart, seed, 0, .19, 0, [.75, 1.3, .65]);
  seedBody.rotation.z = -.25;
  const wing = mesh(new THREE.SphereGeometry(.12, 10, 6), petals, seedBody, .075, .07, 0, [1.1, .38, .25]); wing.rotation.z = .6;
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xe6ce8a, transparent: true, opacity: .65, depthWrite: false, side: THREE.DoubleSide });
  const ring = mesh(new THREE.RingGeometry(.25, .275, 40), ringMaterial, seed, 0, .015, 0); ring.rotation.x = -Math.PI / 2;
  const flowers = [];
  const stemGeometry = new THREE.CylinderGeometry(.013,.022,.42,8);
  const leafGeometry = new THREE.SphereGeometry(.09,10,6);
  const petalGeometry = new THREE.SphereGeometry(.11,10,6);
  const heartGeometry = new THREE.SphereGeometry(.045,10,6);
  const budGeometry = new THREE.SphereGeometry(.049,10,6);
  // Flowers grow directly from the existing meadow, without a dirt disc or stone border.
  function makeFlower(index) {
    const plot = new THREE.Group(); root.add(plot); plot.scale.setScalar(.60);
    const stalk = new THREE.Group(); plot.add(stalk);
    mesh(stemGeometry,green,stalk,0,.235,0);
    for(const side of [-1,1]) {
      const leaf=mesh(leafGeometry,green,stalk,side*.08,.14+(side+1)*.04,0,[1.2,.25,.53]);leaf.rotation.z=side*.44;
    }
    const flower=new THREE.Group();flower.position.y=.45;stalk.add(flower);
    for(let i=0;i<6;i++) {
      const angle=i*Math.PI/3;
      const petal=mesh(petalGeometry,petals,flower,Math.cos(angle)*.085,0,Math.sin(angle)*.085,[1.1,.26,.63]);
      petal.rotation.y=-angle;petal.rotation.z=.13;
    }
    mesh(heartGeometry,heart,flower,0,.019,0,[1,.5,1]);
    const bud=mesh(budGeometry,green,stalk,0,.455,0,[.8,1.3,.8]);
    plot.rotation.y=index*1.7;
    return {plot,stalk,flower,bud};
  }
  return {
    update(state,time,night) {
      seed.visible=state.canCollect;
      if(seed.visible) {
        seedBody.position.y=.20+(reduced.matches?0:Math.sin(time*1.6)*.045);
        seedBody.rotation.y=reduced.matches?0:time*.22;
      }
      const planted=state.flowers||[];
      while(flowers.length<planted.length)flowers.push(makeFlower(flowers.length));
      flowers.forEach((visual,index)=>{
        const entry=planted[index];visual.plot.visible=Boolean(entry);if(!entry)return;
        visual.plot.position.set(entry.plot.x,heightAt(entry.plot.x,entry.plot.z)+.008,entry.plot.z);
        const progress=Math.max(0,Math.min(1,(Date.now()-entry.plantedAt)/(entry.bloomAt-entry.plantedAt)));
        visual.stalk.scale.setScalar(.35+progress*.65);
        visual.stalk.rotation.z=reduced.matches?0:Math.sin(time*.9+index)*.045;
        visual.flower.visible=entry.bloomed;visual.bud.visible=!entry.bloomed;
      });
      petals.emissiveIntensity=.08+night*.38;
    }
  };
};
