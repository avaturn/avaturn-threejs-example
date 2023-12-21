import * as THREE from "three";

import Stats from "three/addons/libs/stats.module.js";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// if using package manager: npm install @avaturn/sdk
import { AvaturnSDK } from "https://cdn.jsdelivr.net/npm/@avaturn/sdk/dist/index.js";

let scene, renderer, camera, stats, animationGroup;
let model, mixer, clock;
let currentAvatar;

let idleAction;

async function loadAvatar(url) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  model = gltf.scene;
  scene.add(model);

  // Set some other params
  model.traverse(function (object) {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      object.material.envMapIntensity = 0.3;
      // Turn off mipmaps to make textures look crispier (only use if texture resolution is 1k)
      if (object.material.map && !object.material.name.includes("hair")) {
        object.material.map.generateMipmaps = false;
      }
    }
  });

  animationGroup.add(model);

  return model;
}

function filterAnimation(animation) {
  animation.tracks = animation.tracks.filter((track) => {
    const name = track.name;
    return name.endsWith("Hips.position") || name.endsWith(".quaternion");
  });
  return animation;
}

async function init() {
  const container = document.getElementById("container");

  // Init renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // Init camera and controls
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );

  const controls = new OrbitControls(camera, renderer.domElement);

  camera.position.set(-2, 1, 3);
  controls.target.set(0, 1, 0);

  controls.update();

  clock = new THREE.Clock();
  animationGroup = new THREE.AnimationObjectGroup();
  mixer = new THREE.AnimationMixer(animationGroup);

  // Init lighting, ground plane, env map
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc0c0c0);
  scene.fog = new THREE.Fog(0xc0c0c0, 20, 50);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff);
  dirLight.position.set(3, 3, 5);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 2;
  dirLight.shadow.camera.bottom = -2;
  dirLight.shadow.camera.left = -2;
  dirLight.shadow.camera.right = 2;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 40;
  dirLight.shadow.bias = -0.001;
  dirLight.intensity = 3;
  scene.add(dirLight);

  new RGBELoader().load("public/brown_photostudio_01.hdr", (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
  });

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Load default avatar
  currentAvatar = await loadAvatar("public/default_model.glb");

  // Load default animation
  const loader = new GLTFLoader();
  loader.load("public/animation.glb", function (gltf) {
    const clip = filterAnimation(gltf.animations[0]);
    const action = mixer.clipAction(clip);
    idleAction = action;
    idleAction.play();
  });

  stats = new Stats();
  container.appendChild(stats.dom);

  window.addEventListener("resize", onWindowResize);

  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  // Render loop

  requestAnimationFrame(animate);

  // Get the time elapsed since the last frame, used for mixer update (if not in single step mode)

  let mixerUpdateDelta = clock.getDelta();

  // Update the animation mixer, the stats panel, and render this frame

  mixer.update(mixerUpdateDelta);

  stats.update();

  renderer.render(scene, camera);
}

function openIframe() {
  initAvaturn();
  document.querySelector("#avaturn-sdk-container").hidden = false;
  document.querySelector("#buttonOpen").disabled = true;
}
function closeIframe() {
  document.querySelector("#avaturn-sdk-container").hidden = true;
  document.querySelector("#buttonOpen").disabled = false;
}

function initAvaturn() {
  const container = document.getElementById("avaturn-sdk-container");

  // Replace it with your own subdomain
  const subdomain = "demo";
  const url = `https://${subdomain}.avaturn.dev`;

  // You can now use AvaturnSDK
  const sdk = new AvaturnSDK();
  sdk.init(container, { url }).then(() => {
    sdk.on("export", (data) => {
      loadAvatar(data.url).then((model) => {
        currentAvatar.visible = false;
        currentAvatar.removeFromParent();
        animationGroup.uncache(currentAvatar);
        animationGroup.remove(currentAvatar);

        currentAvatar = model;
      });
      closeIframe();
    });
  });
}

await init();

closeIframe();
document.querySelector("#buttonOpen").addEventListener("click", openIframe);
document.querySelector("#buttonClose").addEventListener("click", closeIframe);
