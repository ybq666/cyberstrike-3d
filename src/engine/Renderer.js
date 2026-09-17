import * as THREE from 'three';

export class EngineRenderer {
  constructor(container) {
    this.container = container;

    // 1. Scene - Sweet Dreamy Pastel Cotton Candy Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffeef6);
    this.scene.fog = new THREE.FogExp2(0xffe4f0, 0.009);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, 1.7, 0);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    this.setupLights();

    // 5. Sky & Environment Details
    this.setupEnvironment();

    // 6. Resize listener
    window.addEventListener('resize', () => this.onResize());
  }

  setupLights() {
    // Ambient light - warm strawberry cream glow
    const ambient = new THREE.AmbientLight(0xffe2ee, 1.3);
    this.scene.add(ambient);

    // Hemisphere light - sky pink / ground warm custard cream
    const hemiLight = new THREE.HemisphereLight(0xffb8d6, 0xfff3e5, 0.85);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Main Directional Light (Warm Sweet Sun)
    const dirLight = new THREE.DirectionalLight(0xfffaea, 1.75);
    dirLight.position.set(35, 65, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 160;
    const d = 55;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Central Sweets Pillar Warm Strawberry Light
    const coreLight = new THREE.PointLight(0xff69b4, 3.2, 50, 1.2);
    coreLight.position.set(0, 8, 0);
    this.scene.add(coreLight);
  }

  setupEnvironment() {
    // 1. Dreamy Pastel Sky Dust & Twinkling Stars
    const starCount = 650;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const palette = [
      new THREE.Color(0xff85b3), // strawberry pink
      new THREE.Color(0xffd1dc), // baby pink
      new THREE.Color(0xfff0aa), // butter yellow
      new THREE.Color(0xb5e2fa), // sky soda
      new THREE.Color(0xd8bbff)  // lavender
    ];

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 200 + Math.random() * 50;

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 12;
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const color = palette[Math.floor(Math.random() * palette.length)];
      starColors[i * 3] = color.r;
      starColors[i * 3 + 1] = color.g;
      starColors[i * 3 + 2] = color.b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });
    const stars = new THREE.Points(starGeo, starMat);
    this.scene.add(stars);

    // 2. Floating Sweet Pastel Rainbow Arches in Sky
    const rainbowColors = [0xff70a6, 0xff9770, 0xffd670, 0xe9ff70, 0x70d6ff];
    rainbowColors.forEach((colorHex, idx) => {
      const archRadius = 135 - idx * 2.5;
      const archGeo = new THREE.TorusGeometry(archRadius, 0.45, 8, 48, Math.PI);
      const archMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.55
      });
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.rotation.x = Math.PI * 0.12;
      arch.rotation.y = Math.PI * 0.25;
      arch.position.set(0, 10 + idx * 0.8, -30);
      this.scene.add(arch);
    });

    // 3. Fluffy Candy Clouds
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85
    });

    const cloudConfigs = [
      { x: -70, y: 38, z: -80, scale: 1.4 },
      { x: 80, y: 42, z: -60, scale: 1.2 },
      { x: -50, y: 36, z: 80, scale: 1.5 },
      { x: 75, y: 40, z: 75, scale: 1.3 }
    ];

    cloudConfigs.forEach(cfg => {
      const cloudGroup = new THREE.Group();
      const puffOffsets = [
        [0, 0, 0, 4.2],
        [-3.2, -0.6, 0, 3.2],
        [3.4, -0.5, 0.2, 3.4],
        [-1.6, 1.8, -0.2, 3.0],
        [1.8, 1.6, 0.1, 3.1]
      ];

      puffOffsets.forEach(([px, py, pz, pr]) => {
        const puffGeo = new THREE.SphereGeometry(pr, 10, 10);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(px, py, pz);
        cloudGroup.add(puff);
      });

      cloudGroup.position.set(cfg.x, cfg.y, cfg.z);
      cloudGroup.scale.set(cfg.scale, cfg.scale * 0.7, cfg.scale);
      this.scene.add(cloudGroup);
    });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
