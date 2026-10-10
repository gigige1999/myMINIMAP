window.buildMapLandmarks = function buildMapLandmarks(THREE, rootGroup, heightAt, random) {
  const range = (a, b) => a + random() * (b - a);
  const pick = values => values[Math.floor(random() * values.length)];
  const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .96, flatShading: true, ...options });
  const stone = [0xa7ad93, 0xb7ba9d, 0xc6c5ab, 0x9ca58c, 0xb2b49c].map(material);
  const cliff = [0xb6b49a, 0xc9c4a9, 0xa7ac8a, 0xc0bba1].map(material);
  const leaves = [0x8fa877, 0x9eb481, 0x748e64, 0xb5bf89, 0x879e6d].map(material);
  const mossMaterial = material(0x839864);
  const wood = material(0x858773);
  // A little self-light keeps the layered foliage readable over the soft
  // terrain shadows, especially while the scene is blending into night.
  const canopyMaterial = material(0x789669, {
    emissive: 0x263d28,
    emissiveIntensity: .16,
    roughness: .88
  });
  const bronze = material(0x66776c);
  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
  const foliageGeometry = new THREE.IcosahedronGeometry(1, 1);
  const treeFoliageGeometry = new THREE.IcosahedronGeometry(1, 2);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  const trees = [];
  const obstacles = [];
  const lanterns = [];
  const glowMaterials = [];
  const mossPatches = [];
  const shrubPatches = [];
  const ivyLeaves = [];
  const detailMatrix = new THREE.Object3D();
  const addMesh = (geometry, mat, parent, x, y, z, sx = 1, sy = sx, sz = sx) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const block = (parent, x, y, z, width, height, depth, mat = pick(stone)) =>
    addMesh(cubeGeometry, mat, parent, x, y, z, width, height, depth);
  const cylinder = (parent, x, y, z, radius, height, mat = pick(stone)) =>
    addMesh(cylinderGeometry, mat, parent, x, y, z, radius, height, radius);
  const rock = (x, z, scale = .22, mat = pick(stone)) => {
    if (scale >= .18) obstacles.push({ x, z, radius: scale * .7 });
    const mesh = addMesh(rockGeometry, mat, rootGroup, x, heightAt(x, z) + scale * .25, z,
      scale * range(.8, 1.3), scale * range(.4, .75), scale * range(.65, 1.1));
    mesh.rotation.set(range(-.2, .2), range(0, 6), range(-.15, .15));
    return mesh;
  };
  const moss = (x, y, z, size, depth = size) => mossPatches.push({ x, y, z, size, depth });
  const riverX = z => -1.5 + 1.25 * Math.sin(z * .55) + .20 * Math.sin(z * 1.3);

  function branch(parent, from, to, radius, mat = wood) {
    const delta = to.clone().sub(from);
    const mesh = new THREE.Mesh(cylinderGeometry, mat);
    mesh.scale.set(radius, delta.length(), radius);
    mesh.position.copy(from).add(to).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
  }

  function tree(x, z, size = 1, slender = false) {
    obstacles.push({ x, z, radius: .12 * size });
    const trunk = new THREE.Group();
    trunk.position.set(x, heightAt(x, z), z);
    trunk.scale.setScalar(size);
    trunk.rotation.y = random() * Math.PI * 2;
    rootGroup.add(trunk);
    branch(trunk, new THREE.Vector3(0, 0, 0), new THREE.Vector3(.04, 1.06, 0), slender ? .035 : .052);
    branch(trunk, new THREE.Vector3(.02, .42, 0), new THREE.Vector3(-.34, .93, .09), .024);
    branch(trunk, new THREE.Vector3(.03, .59, 0), new THREE.Vector3(.34, 1.04, -.11), .022);
    branch(trunk, new THREE.Vector3(.02, .57, 0), new THREE.Vector3(.06, .96, .32), .021);
    const crown = new THREE.Group();
    crown.position.y = .72;
    trunk.add(crown);
    // Spherical low-poly foliage clusters keep the crown volumetric from the
    // map's angled camera while leaving small gaps for the branches to show.
    const points = slender ? [[-.16, .04, .05, .22], [.15, .24, -.05, .24], [-.05, .50, 0, .27], [.02, .78, .02, .18]] :
      [[-.33, .14, .08, .30], [.31, .34, -.09, .31], [0, .62, .02, .34], [.04, .23, .30, .28], [-.07, .40, -.29, .28]];
    const canopy = new THREE.Group();
    points.forEach(([px, py, pz, radius], index) => {
      for (let lobe = 0; lobe < 4; lobe++) {
        const angle = lobe * Math.PI * 2 / 3 + index * 1.3;
        const offset = lobe === 3 ? 0 : radius * .49;
        const lobeMesh = new THREE.Mesh(treeFoliageGeometry, canopyMaterial);
        const verticalOffset = lobe === 3 ? .09 : Math.sin(angle) * radius * .18;
        lobeMesh.position.set(px + Math.cos(angle) * offset, py + verticalOffset + range(-.025, .025), pz + Math.sin(angle) * offset);
        lobeMesh.scale.set(radius * range(.72, .90), radius * range(.68, .90), radius * range(.72, .90));
        lobeMesh.rotation.set(range(-.18, .18), range(0, 6), range(-.17, .17));
        lobeMesh.castShadow = lobeMesh.receiveShadow = true;
        canopy.add(lobeMesh);
      }
    });
    crown.add(canopy);
    trees.push({ group: crown, phase: random() * Math.PI * 2 });
    shrubPatches.push({ x: x + .14, z: z + .16, radius: .31 * size, count: 5 });
  }

  function lantern(x, z, height = .48) {
    obstacles.push({ x, z, radius: .16 });
    const group = new THREE.Group();
    group.position.set(x, heightAt(x, z), z);
    rootGroup.add(group);
    block(group, 0, .045, 0, .24, .09, .24, stone[1]);
    block(group, 0, height * .36, 0, .14, height * .63, .14, stone[2]);
    block(group, 0, height * .72, 0, .23, .045, .23, bronze);
    const glass = new THREE.MeshStandardMaterial({ color: 0xddca83, emissive: 0xffbf57, emissiveIntensity: .035, roughness: .36, transparent: true, opacity: .82 });
    block(group, 0, height * .72 + .11, 0, .142, .18, .142, glass);
    for (const dx of [-1, 1]) for (const dz of [-1, 1])
      block(group, dx * .079, height * .72 + .11, dz * .079, .02, .2, .02, bronze);
    block(group, 0, height * .72 + .22, 0, .235, .045, .235, bronze);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(.19, .12, 4), stone[1]);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = height * .72 + .3;
    roof.castShadow = true;
    group.add(roof);
    glowMaterials.push(glass);
    lanterns.push(group);
  }

  function ivy(x, y, z, length, side = 1) {
    for (let i = 0; i < 15; i++) {
      const t = i / 14;
      ivyLeaves.push({ x: x + Math.sin(t * 9) * .035 + side * t * .07, y: y - length * t, z: z + Math.sin(t * 4) * .03, size: range(.035, .062) });
    }
  }

  // Each column follows the hillside; continuous capitals carry the surviving lintel.
  const shrineX = 2.72, shrineZ = -2.15;
  function column(x, z, height, complete = true) {
    obstacles.push({ x, z, radius: .24 });
    const y = heightAt(x, z);
    block(rootGroup, x, y + .045, z, .42, .09, .42);
    block(rootGroup, x, y + .13, z, .32, .08, .32, stone[2]);
    cylinder(rootGroup, x, y + .21, z, .145, .10, stone[1]);
    const shaftHeight = height - .37;
    for (let i = 0; i < 3; i++) {
      cylinder(rootGroup, x + (complete ? 0 : i * .008), y + .26 + shaftHeight * (i + .5) / 3, z,
        .113 - i * .005, shaftHeight / 3 - .013, stone[(i + 1) % stone.length]);
    }
    // Shallow ribs read as weathered fluting without adding a separate mesh per groove.
    if (height > .75) {
      const flutes = new THREE.InstancedMesh(cylinderGeometry, stone[2], 10);
      for (let flute = 0; flute < 10; flute++) {
        const angle = flute * Math.PI * 2 / 10;
        detailMatrix.position.set(x + Math.cos(angle) * .107, y + .26 + shaftHeight * .5, z + Math.sin(angle) * .107);
        detailMatrix.scale.set(.013, Math.max(.12, shaftHeight - .08), .013);
        detailMatrix.rotation.set(0, 0, 0);
        detailMatrix.updateMatrix();
        flutes.setMatrixAt(flute, detailMatrix.matrix);
      }
      flutes.castShadow = true;
      rootGroup.add(flutes);
    }
    if (complete) {
      cylinder(rootGroup, x, y + height - .105, z, .14, .065, stone[2]);
      cylinder(rootGroup, x, y + height - .15, z, .125, .025, stone[1]);
      block(rootGroup, x, y + height - .04, z, .36, .08, .33, stone[2]);
      moss(x + .05, y + height + .009, z - .015, .14, .13);
    } else {
      const broken = addMesh(rockGeometry, stone[1], rootGroup, x, y + height - .10, z, .12, .12, .12);
      broken.rotation.z = .15;
    }
    moss(x - .09, y + .095, z + .10, .12, .11);
  }
  const colA = [shrineX - .70, shrineZ - .55], colB = [shrineX + .12, shrineZ - .55];
  const lintelTop = Math.max(heightAt(...colA), heightAt(...colB)) + 1.40;
  column(...colA, lintelTop - heightAt(...colA));
  column(...colB, lintelTop - heightAt(...colB));
  block(rootGroup, shrineX - .29, lintelTop + .085, shrineZ - .55, 1.23, .17, .30, stone[2]);
  block(rootGroup, shrineX - .29, lintelTop + .18, shrineZ - .55, 1.28, .04, .33, stone[1]);
  moss(shrineX - .60, lintelTop + .22, shrineZ - .51, .23, .12);
  ivy(shrineX - .71, lintelTop + .22, shrineZ - .36, .79);
  column(shrineX + .84, shrineZ - .20, 1.12, false);
  column(shrineX - .69, shrineZ + .49, .85, false);
  column(shrineX + .16, shrineZ + .58, 1.44);
  column(shrineX + .84, shrineZ + .66, .49, false);
  for (let i = 0; i < 3; i++) {
    const x = shrineX + .66 + i * .16, z = shrineZ + 1.05 + i * .18;
    const fallen = cylinder(rootGroup, x, heightAt(x, z) + .11, z, .11, .31);
    fallen.rotation.set(Math.PI / 2, .35, 0);
  }
  const mosaicTiles = [];
  for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) {
    if (random() < .16) continue;
    const x = shrineX - .57 + col * .22, z = shrineZ - .47 + row * .22;
    mosaicTiles.push({ x, z, color: (row + col) % 3 === 0 ? 0x91a598 : 0xc4c7aa });
  }
  const mosaicMaterial = material(0xc4c7aa);
  const mosaic = new THREE.InstancedMesh(cubeGeometry, mosaicMaterial, mosaicTiles.length);
  mosaicTiles.forEach((tile, index) => {
    detailMatrix.position.set(tile.x, heightAt(tile.x, tile.z) + .025, tile.z);
    detailMatrix.scale.set(.204, .036, .202);
    detailMatrix.rotation.set(0, range(-.045, .045), 0);
    detailMatrix.updateMatrix();
    mosaic.setMatrixAt(index, detailMatrix.matrix);
  });
  mosaic.receiveShadow = true;
  rootGroup.add(mosaic);
  for (let step = 0; step < 4; step++) {
    const z = shrineZ + 1.04 + step * .21;
    block(rootGroup, shrineX - .12, heightAt(shrineX - .12, z) + .04, z, .67 + step * .045, .09, .25, stone[step % stone.length]);
  }
  for (let i = 0; i < 7; i++) {
    const x = shrineX + 1.0 + range(-.2, .31), z = shrineZ + .70 + range(-.4, .68);
    rock(x, z, range(.065, .14));
  }
  const basinX = shrineX - .02, basinZ = shrineZ + .08, basinY = heightAt(basinX, basinZ);
  obstacles.push({ x: basinX, z: basinZ, radius: .29 });
  cylinder(rootGroup, basinX, basinY + .06, basinZ, .22, .12, stone[2]);
  const basinRim = new THREE.Mesh(new THREE.TorusGeometry(.24, .06, 5, 12), stone[2]);
  basinRim.rotation.x = Math.PI / 2;
  basinRim.position.set(basinX, basinY + .16, basinZ);
  rootGroup.add(basinRim);
  cylinder(rootGroup, basinX, basinY + .136, basinZ, .205, .012,
    new THREE.MeshStandardMaterial({ color: 0x99bdb1, roughness: .2, metalness: .05, emissive: 0x4e756d, emissiveIntensity: .08 }));
  tree(4.34, -2.72, 1.20);
  tree(4.76, -1.42, .89);
  rock(3.72, -.85, .20);
  rock(1.39, -2.10, .22);
  lantern(1.87, -1.05, .53);
  lantern(3.24, -1.05, .46);
  shrubPatches.push({ x: 3.6, z: -3.1, radius: .46, count: 9 }, { x: 3.76, z: -1.06, radius: .32, count: 7 });

  // A small pointed arch is assembled from actual wedge-shaped voussoirs.
  const arch = new THREE.Group();
  arch.position.set(-2.95, heightAt(-2.95, 2.56), 2.56);
  arch.rotation.y = -.30;
  for (const side of [-1, 1]) obstacles.push({ x: -2.95 + side * .37 * Math.cos(-.30), z: 2.56 - side * .37 * Math.sin(-.30), radius: .18 });
  obstacles.push({ x: -3.72, z: 2.38, radius: .46 });
  rootGroup.add(arch);
  for (const side of [-1, 1]) {
    block(arch, side * .37, .035, 0, .30, .07, .39, stone[2]);
    for (let i = 0; i < 3; i++) block(arch, side * .37, .17 + .20 * i, 0, .20, .185, .28);
    block(arch, side * .37, .68, 0, .26, .07, .32, stone[2]);
    const archPoint = (t, outer) => {
      const width = outer ? .49 : .27;
      return new THREE.Vector2(side * width * (1 - t * t), .71 + (outer ? .69 : .49) * t);
    };
    for (let i = 0; i < 6; i++) {
      const start = i / 6 + .008, end = (i + 1) / 6 - .008;
      const points = [archPoint(start, false), archPoint(end, false), archPoint(end, true), archPoint(start, true)];
      const shape = new THREE.Shape(points);
      const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
        depth: .28, bevelEnabled: true, bevelSize: .009, bevelThickness: .009, bevelSegments: 1, steps: 1
      }), pick(stone));
      wedge.position.z = -.14;
      wedge.castShadow = wedge.receiveShadow = true;
      arch.add(wedge);
    }
  }
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 3 - row; i++) {
      const brick = block(arch, -.59 - i * .24 + row * .035, .105 + row * .19, .015, .23, .175, .25);
      brick.rotation.z = range(-.02, .02);
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = -3.78 - i * .19, z = 2.18 - i * .05;
    const y = heightAt(x, z);
    const brick = block(rootGroup, x, y + .10, z, .23, .19, .22, stone[(i + 1) % stone.length]);
    brick.rotation.y = -.15;
    if (i < 3) block(rootGroup, x + .02, y + .26, z, .22, .14, .21, stone[i % stone.length]);
    moss(x, y + (i < 3 ? .34 : .205), z, .10, .09);
  }
  ivy(-3.35, heightAt(-2.95, 2.56) + 1.05, 2.61, .76, -1);
  for (let i = 0; i < 8; i++) rock(-3.9 + range(-.45, 1.5), 2.75 + range(-.3, .65), range(.09, .17));
  moss(-3.44, heightAt(-3.44, 2.65) + .08, 2.65, .30, .18);
  tree(-4.82, 2.56, 1.16);
  tree(-4.20, 3.52, .80);
  tree(-1.41, 3.77, .87);
  tree(-5.1, .77, 1.15);
  lantern(-2.33, 2.73, .45);
  shrubPatches.push({ x: -3.9, z: 3.18, radius: .41, count: 8 }, { x: -2.91, z: 3.67, radius: .29, count: 6 });

  // Broad, offset strata make the canyon read as exposed limestone riverbanks.
  for (const [z, side, height, width] of [[-3.52, -1, 1.25, .83], [-2.68, -1, 1.53, 1.05],
    [-1.70, -1, 1.07, .87], [-3.09, 1, 1.21, .78], [-2.11, 1, .92, .64]]) {
    const x = riverX(z) + side * (1.02 + width * .25);
    obstacles.push({ x: x + side * .1, z, radius: width * .6 });
    const baseY = heightAt(x, z) - .04;
    for (let layer = 0; layer < 4; layer++) {
      const layerWidth = width * (1 - layer * .11);
      const mass = addMesh(new THREE.CylinderGeometry(layerWidth * .49, layerWidth * .57, height / 4, 6),
        cliff[layer % cliff.length], rootGroup, x + side * layer * .07, baseY + height * (layer + .5) / 4, z,
        1, 1, .94);
      mass.rotation.y = .3 + layer * .07;
    }
    moss(x + side * .19, baseY + height + .014, z, width * .35, width * .34);
    rock(x + side * .43, z + .40, .23, cliff[1]);
  }
  tree(-4.51, -3.55, .73, true);
  tree(-4.71, -1.80, .98);
  tree(-.69, -3.61, .79, true);
  shrubPatches.push({ x: -4.25, z: -2.34, radius: .34, count: 8 }, { x: -.85, z: -3.85, radius: .30, count: 6 });

  const ringCenter = [3.69, 2.53];
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7 + .13;
    const x = ringCenter[0] + Math.cos(angle) * .75;
    const z = ringCenter[1] + Math.sin(angle) * .62;
    const height = i === 2 ? .31 : range(.57, 1.01);
    obstacles.push({ x, z, radius: .22 });
    const standing = addMesh(rockGeometry, stone[i % stone.length], rootGroup, x, heightAt(x, z) + height * .45, z,
      range(.16, .22), height * .66, .19);
    standing.rotation.z = range(-.12, .12);
    moss(x - .05, heightAt(x, z) + .09, z + .05, .15, .17);
  }
  tree(4.90, 2.54, 1.10, true);
  tree(4.38, 3.72, .86, true);
  tree(3.15, 3.91, 1.14, true);
  tree(5.22, 1.35, .94, true);
  tree(2.35, 3.37, .73, true);
  lantern(2.68, 2.49, .39);
  shrubPatches.push({ x: 4.27, z: 2.06, radius: .31, count: 8 }, { x: 3.36, z: 3.49, radius: .39, count: 9 });

  const shrubs = new THREE.Group();
  shrubPatches.forEach(patch => {
    for (let i = 0; i < patch.count; i++) {
      const angle = range(0, Math.PI * 2), offset = Math.sqrt(random()) * patch.radius;
      const x = patch.x + Math.cos(angle) * offset, z = patch.z + Math.sin(angle) * offset;
      const size = range(.085, .15);
      const shrub = new THREE.Mesh(foliageGeometry, canopyMaterial);
      shrub.position.set(x, heightAt(x, z) + size * .39, z);
      shrub.scale.set(size * 1.3, size * .62, size);
      shrub.rotation.set(0, range(0, 6), range(-.12, .12));
      shrub.castShadow = shrub.receiveShadow = true;
      shrubs.add(shrub);
    }
  });
  rootGroup.add(shrubs);
  const ivyInstances = new THREE.InstancedMesh(foliageGeometry, mossMaterial, ivyLeaves.length);
  ivyLeaves.forEach((leaf, index) => {
    detailMatrix.position.set(leaf.x, leaf.y, leaf.z);
    detailMatrix.scale.set(leaf.size, leaf.size * .55, leaf.size * .48);
    detailMatrix.rotation.set(.3, range(-.5, .5), index % 2 ? .65 : -.65);
    detailMatrix.updateMatrix();
    ivyInstances.setMatrixAt(index, detailMatrix.matrix);
  });
  ivyInstances.castShadow = true;
  rootGroup.add(ivyInstances);

  const dummy = new THREE.Object3D();
  const mossInstances = new THREE.InstancedMesh(foliageGeometry, mossMaterial, mossPatches.length);
  mossPatches.forEach((patch, index) => {
    dummy.position.set(patch.x, patch.y, patch.z);
    dummy.scale.set(patch.size, .036, patch.depth);
    dummy.rotation.set(0, random() * Math.PI, 0);
    dummy.updateMatrix();
    mossInstances.setMatrixAt(index, dummy.matrix);
  });
  mossInstances.receiveShadow = true;
  rootGroup.add(mossInstances);
  return { trees, lanterns, glowMaterials, foliageMaterial: canopyMaterial, obstacles };
};
