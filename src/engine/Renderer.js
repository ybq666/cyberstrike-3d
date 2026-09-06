import * as THREE from 'three';

export class EngineRenderer {
  constructor(container) {
    this.container = container;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050914);
    this.scene.fog = new THREE.FogExp2(0x050914, 0.015);

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
    this.renderer.toneMappingExposure = 1.15;

    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    this.setupLights();

    // 5. Sky & Environment Details
    this.setupEnvironment();

    // 6. Resize listener
    window.addEventListener('resize', () => this.onResize());
  }

  setupLights() {
    // Ambient light - subtle deep cyan
    const ambient = new THREE.AmbientLight(0x0a1e3f, 1.2);
    this.scene.add(ambient);

    // Hemisphere light - subtle neon blue/purple fill
    const hemiLight = new THREE.HemisphereLight(0x00f3ff, 0x1a0933, 0.6);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Main Directional Light (Moon / Cyber Satellite)
    const dirLight = new THREE.DirectionalLight(0x88ccff, 1.8);
    dirLight.position.set(35, 60, 25);
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

    // Central Core Pillar Light
    const coreLight = new THREE.PointLight(0x00f3ff, 3.5, 45, 1.2);
    coreLight.position.set(0, 8, 0);
    this.scene.add(coreLight);
  }

  setupEnvironment() {
    // Cyber Sky Dome with starry points
    const starCount = 800;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 220 + Math.random() * 50;

      starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = Math.abs(r * Math.cos(phi)) + 10; // keep above horizon
      starPositions[i + 2] = r * Math.sin(phi) * Math.sin(theta);
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x00f3ff,
      size: 1.6,
      transparent: true,
      opacity: 0.8
    });
    const stars = new THREE.Points(starGeo, starMat);
    this.scene.add(stars);

    // Distant Neon Grid Rings in Sky
    const ringGeo = new THREE.TorusGeometry(120, 0.4, 8, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2.3;
    ring1.position.set(0, 40, 0);
    this.scene.add(ring1);

    const ring2 = ring1.clone();
    ring2.scale.set(0.75, 0.75, 0.75);
    ring2.rotation.y = 0.5;
    this.scene.add(ring2);
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
