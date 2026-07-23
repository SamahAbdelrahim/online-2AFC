import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const activeViewers = new Set();
const modelCache = new Map();
const modelLoadPromises = new Map();

const SUPPORTED_FORMATS = new Set(["gltf", "glb", "stl", "obj", "fbx", "dae", "ply", "3mf"]);
const FIT_TARGET_SIZE = 2.4;
const FIT_CAMERA_FACTOR = 1.05;

function resolveModelUrl(url) {
  return new URL(url, window.location.href).href;
}

function getModelFormat(url) {
  const pathname = String(url || "").split("?")[0].split("#")[0].toLowerCase();
  const ext = pathname.includes(".") ? pathname.slice(pathname.lastIndexOf(".") + 1) : "";
  if (ext === "gltf" || ext === "glb") return "gltf";
  if (SUPPORTED_FORMATS.has(ext)) return ext;
  return null;
}

function getTextureResourcePath(modelUrl) {
  const resolved = new URL(modelUrl, window.location.href);
  return new URL("textures/", resolved).href;
}

function createLoadingManager(modelUrl) {
  const manager = new THREE.LoadingManager();
  const textureBase = getTextureResourcePath(modelUrl);
  manager.setURLModifier((assetUrl) => {
    if (/^https?:\/\//i.test(assetUrl) || assetUrl.startsWith("data:") || assetUrl.startsWith("blob:")) {
      return assetUrl;
    }
    const basename = assetUrl.split(/[\\/]/).pop();
    return new URL(basename, textureBase).href;
  });
  manager.onError = (url) => {
    console.warn("[model-viewer] Optional asset failed to load:", url);
  };
  return manager;
}

function computeObjectBounds(object) {
  const box = new THREE.Box3();
  object.updateMatrixWorld(true);
  box.setFromObject(object);

  if (!Number.isFinite(box.min.x) || box.isEmpty()) {
    object.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      child.geometry.computeBoundingBox();
      if (!child.geometry.boundingBox) return;
      const meshBox = child.geometry.boundingBox.clone();
      meshBox.applyMatrix4(child.matrixWorld);
      box.union(meshBox);
    });
  }

  return box;
}

function prepareLoadedObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = false;
    child.receiveShadow = false;
    child.frustumCulled = false;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      material.side = THREE.DoubleSide;
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      if (material.emissiveMap) material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      if (material.color && material.emissive) {
        material.emissive.copy(material.color).multiplyScalar(0.08);
      }
      material.needsUpdate = true;
    }
  });
  return object;
}

function createUntexturedMesh(geometry) {
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0xb8c2d1,
      metalness: 0.15,
      roughness: 0.55,
      flatShading: false,
      side: THREE.DoubleSide
    })
  );
}

function fitObjectToView(object, camera, controls, targetSize = FIT_TARGET_SIZE) {
  object.updateMatrixWorld(true);

  const box = computeObjectBounds(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  if (!Number.isFinite(size.x) || (size.x === 0 && size.y === 0 && size.z === 0)) {
    throw new Error("Model has no visible geometry.");
  }

  object.position.sub(center);
  object.updateMatrixWorld(true);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  object.scale.setScalar(targetSize / maxDim);
  object.updateMatrixWorld(true);

  const fittedBox = computeObjectBounds(object);
  const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
  object.position.sub(fittedCenter);
  object.updateMatrixWorld(true);

  const fittedSize = fittedBox.getSize(new THREE.Vector3());
  const fittedMax = Math.max(fittedSize.x, fittedSize.y, fittedSize.z, targetSize);
  const cameraDistance = Math.max(fittedMax * FIT_CAMERA_FACTOR, 2.5);

  camera.near = Math.max(cameraDistance / 200, 0.01);
  camera.far = Math.max(cameraDistance * 20, 200);
  camera.position.set(0, 0, cameraDistance);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  if (controls) {
    controls.target.set(0, 0, 0);
    controls.minDistance = Math.max(cameraDistance * 0.25, 0.8);
    controls.maxDistance = Math.max(cameraDistance * 2.5, 6);
    controls.update();
  }
}

function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 500);
  camera.position.set(0, 0, 10);

  const ambient = new THREE.AmbientLight(0xffffff, 1.1);
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(2.5, 4, 3.5);
  const fill = new THREE.DirectionalLight(0xdce7ff, 0.75);
  fill.position.set(-3, 1.5, -2);
  const rim = new THREE.DirectionalLight(0xffffff, 0.45);
  rim.position.set(0, -2, -4);
  scene.add(ambient, key, fill, rim);

  return { renderer, scene, camera };
}

function setStageMessage(canvas, message, isError = false) {
  const stage = canvas.closest(".sb-model-stage");
  if (!stage) return;
  let el = stage.querySelector(".sb-model-status");
  if (!el) {
    el = document.createElement("div");
    el.className = "sb-model-status";
    stage.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle("sb-model-status--error", isError);
  el.classList.toggle("sb-model-status--loading", !isError);
}

function clearStageMessage(canvas) {
  const stage = canvas.closest(".sb-model-stage");
  const status = stage?.querySelector(".sb-model-status");
  if (!status) return;
  status.classList.add("is-hiding");
  window.setTimeout(() => {
    status.remove();
  }, 150);
}

function markStageReady(canvas) {
  canvas.closest(".sb-model-stage")?.classList.add("sb-model-ready");
}

async function loadObjModel(resolvedUrl, manager) {
  const objLoader = new OBJLoader(manager);
  objLoader.setResourcePath(getTextureResourcePath(resolvedUrl));
  const mtlUrl = resolvedUrl.replace(/\.obj(?=($|\?))/i, ".mtl");

  try {
    const mtlLoader = new MTLLoader(manager);
    mtlLoader.setResourcePath(getTextureResourcePath(resolvedUrl));
    const materials = await mtlLoader.loadAsync(mtlUrl);
    materials.preload();
    objLoader.setMaterials(materials);
  } catch (_err) {
    // Fall back to untextured OBJ when no MTL is available.
  }

  return prepareLoadedObject(await objLoader.loadAsync(resolvedUrl));
}

async function parseModel(url) {
  const format = getModelFormat(url);
  const resolvedUrl = resolveModelUrl(url);
  if (!format) {
    throw new Error(`Unsupported 3D model format for URL: ${url}`);
  }

  const manager = createLoadingManager(resolvedUrl);

  switch (format) {
    case "gltf": {
      const loader = new GLTFLoader(manager);
      const gltf = await loader.loadAsync(resolvedUrl);
      return prepareLoadedObject(gltf.scene);
    }
    case "obj":
      return loadObjModel(resolvedUrl, manager);
    case "fbx": {
      const loader = new FBXLoader(manager);
      loader.setResourcePath(getTextureResourcePath(resolvedUrl));
      return prepareLoadedObject(await loader.loadAsync(resolvedUrl));
    }
    case "dae": {
      const loader = new ColladaLoader(manager);
      const collada = await loader.loadAsync(resolvedUrl);
      return prepareLoadedObject(collada.scene);
    }
    case "ply": {
      const loader = new PLYLoader(manager);
      const geometry = await loader.loadAsync(resolvedUrl);
      return createUntexturedMesh(geometry);
    }
    case "3mf": {
      const loader = new ThreeMFLoader(manager);
      return prepareLoadedObject(await loader.loadAsync(resolvedUrl));
    }
    case "stl": {
      const loader = new STLLoader(manager);
      const geometry = await loader.loadAsync(resolvedUrl);
      return createUntexturedMesh(geometry);
    }
    default:
      throw new Error(`Unsupported 3D model format: ${format}`);
  }
}

export async function ensureModelLoaded(url) {
  const key = resolveModelUrl(url);
  if (modelCache.has(key)) {
    return modelCache.get(key);
  }
  if (modelLoadPromises.has(key)) {
    return modelLoadPromises.get(key);
  }

  const promise = parseModel(url)
    .then((root) => {
      modelCache.set(key, root);
      modelLoadPromises.delete(key);
      return root;
    })
    .catch((err) => {
      modelLoadPromises.delete(key);
      throw err;
    });

  modelLoadPromises.set(key, promise);
  return promise;
}

export function preloadModels(urls) {
  const unique = [...new Set(urls.map((url) => resolveModelUrl(url)))];
  return Promise.all(unique.map((url) => ensureModelLoaded(url)));
}

function cloneModel(root) {
  return root.clone(true);
}

export async function createModelViewer(canvas, { url, source, label = "", onInteract = null }) {
  const resolvedUrl = resolveModelUrl(url);
  const cached = modelCache.has(resolvedUrl);
  if (!cached) {
    setStageMessage(canvas, "Loading model…");
  }

  const { renderer, scene, camera } = createScene(canvas);
  let root;
  try {
    const template = await ensureModelLoaded(url);
    root = cloneModel(template);
    markStageReady(canvas);
    clearStageMessage(canvas);
  } catch (err) {
    setStageMessage(canvas, "Could not load model.", true);
    renderer.dispose();
    throw err;
  }

  scene.add(root);

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 5.5;
  controls.target.set(0, 0, 0);

  let dragging = false;
  let moved = false;
  let hasInteracted = false;
  const markInteracted = () => {
    if (hasInteracted) return;
    hasInteracted = true;
    onInteract?.(canvas);
  };

  controls.addEventListener("start", () => {
    dragging = true;
    moved = false;
  });
  controls.addEventListener("change", () => {
    if (dragging) moved = true;
  });
  controls.addEventListener("end", () => {
    if (moved) markInteracted();
    dragging = false;
  });

  const resize = () => {
    const stage = canvas.parentElement;
    const width = Math.max(stage?.clientWidth || canvas.clientWidth || 236, 120);
    const height = Math.max(stage?.clientHeight || canvas.clientHeight || 236, 120);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    fitObjectToView(root, camera, controls);
  };

  fitObjectToView(root, camera, controls);
  controls.update();

  let frameId = null;
  const renderLoop = () => {
    controls.update();
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(renderLoop);
  };

  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  resize();
  renderLoop();
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  resize();

  const viewer = {
    canvas,
    label,
    url,
    source,
    controls,
    resize,
    dispose() {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      controls.dispose();
      clearStageMessage(canvas);
      root.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose?.();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose?.());
          } else {
            child.material?.dispose?.();
          }
        }
      });
      renderer.dispose();
      activeViewers.delete(viewer);
    }
  };

  activeViewers.add(viewer);
  return viewer;
}

export function disposeAllModelViewers() {
  for (const viewer of [...activeViewers]) {
    viewer.dispose();
  }
}

export function resizeAllModelViewers() {
  for (const viewer of activeViewers) {
    viewer.resize();
  }
}
