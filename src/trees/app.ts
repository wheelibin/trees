import {
  Vector3,
  Clock,
  MathUtils,
  Scene,
  WebGLRenderer,
  Color,
  PerspectiveCamera,
  Group,
  MeshLambertMaterial,
  Mesh,
  Box3,
  PlaneGeometry,
  SRGBColorSpace,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Euler,
  BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import Stats from "three/examples/jsm/libs/stats.module";
import GUI from "lil-gui";
import { createCylinder, createSphere } from "./shapes";
import { addDirectionalLight, addHemisphereLight } from "./lighting";

type Options = {
  branchShortenRatio: number;
  branchDensity: number;
  flyAround: boolean;
  hasLeaves: boolean;
  height: number;
  leafSize: number;
  maxBranchAngle: number;
  minBranchLength: number;
  seed: number;
  treeColour: number;
  leafColour: number;
  groundColour: number;
};

const loader = new GLTFLoader();

const clock = new Clock();
let tree: Group;
let renderer: WebGLRenderer;
let scene: Scene;
let camera: PerspectiveCamera;
let leafModel: Group;
let orbitControls: OrbitControls;
let transformControls: TransformControls;
let stats: Stats;
let groundMaterial: MeshLambertMaterial;
let leafInstancedMesh: InstancedMesh;
let leafInstanceIndex = 0;
let leafMergedGeometry: BufferGeometry;
let leafModelCenter: Vector3;
let leafModelSize: Vector3;
let leafMaterial: MeshLambertMaterial;
const MAX_LEAF_INSTANCES = 50_000;

const minBranchLengthRange = [2, 10];
const minBranchLengthRatioRange = [0.75, 0.9];

let options: Options = {
  branchDensity: 0.2,
  branchShortenRatio: 0.75,
  flyAround: true,
  hasLeaves: true,
  height: 20,
  leafSize: 25,
  maxBranchAngle: 95,
  minBranchLength: 3,
  seed: 8372, //MathUtils.randInt(0, 10000),
  treeColour: 0x382718,
  leafColour: 0x6b6a06,
  groundColour: 0x89895d,
};

const setupLeafInstancing = () => {
  leafModel.updateWorldMatrix(true, true);
  const geometries: BufferGeometry[] = [];
  leafModel.traverse((child) => {
    if (child instanceof Mesh) {
      const geo = child.geometry.clone();
      geo.applyMatrix4(child.matrixWorld);
      geometries.push(geo);
    }
  });
  leafMergedGeometry = mergeGeometries(geometries)!;

  const bbox = new Box3().setFromObject(leafModel);
  leafModelCenter = bbox.getCenter(new Vector3());
  leafModelSize = bbox.getSize(new Vector3());

  leafMaterial = new MeshLambertMaterial();
};

export const go = async () => {
  const gltfLeaf = await loader.loadAsync("assets/leaf/scene.gltf");
  leafModel = gltfLeaf.scene.clone();
  leafModel.castShadow = true;
  leafModel.receiveShadow = true;

  setupLeafInstancing();
  init();
  animate();
};

const init = () => {
  scene = new Scene();
  scene.background = new Color(0xcce0ff);

  // LIGHTS
  const hemisphereLightColour = new Color().setHSL(0.6, 1, 0.6);
  addHemisphereLight(hemisphereLightColour, scene);
  addDirectionalLight(scene);

  // GROUND
  const groundGeo = new PlaneGeometry(1000, 1000);
  groundMaterial = new MeshLambertMaterial({ color: options.groundColour });

  const ground = new Mesh(groundGeo, groundMaterial);
  ground.position.y = -40;
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // GUI
  createGUI();

  //RENDERER
  renderer = new WebGLRenderer({
    antialias: window.devicePixelRatio === 1,
    powerPreference: "high-performance",
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  stats = new (Stats as any)();
  document.body.appendChild(stats.dom);

  camera = new PerspectiveCamera(
    30,
    window.innerWidth / window.innerHeight,
    1,
    500
  );
  camera.position.set(0, 100, 200);

  orbitControls = new OrbitControls(camera, renderer.domElement);

  transformControls = new TransformControls(camera, renderer.domElement);
  scene.add(transformControls);
  transformControls.addEventListener("mouseDown", function () {
    orbitControls.enabled = false;
  });
  transformControls.addEventListener("mouseUp", function () {
    orbitControls.enabled = true;
  });

  window.addEventListener("keydown", function (event) {
    switch (event.key.toUpperCase()) {
      case "R":
        transformControls.setMode("rotate");
        break;
      case "V":
        transformControls.setMode("translate");
        break;

      default:
        break;
    }
  });

  createTree();
};

const createTree = () => {
  MathUtils.seededRandom(options.seed);
  scene.remove(tree);
  tree = new Group();

  leafInstanceIndex = 0;
  leafInstancedMesh = new InstancedMesh(leafMergedGeometry, leafMaterial, MAX_LEAF_INSTANCES);
  leafInstancedMesh.castShadow = true;
  leafInstancedMesh.receiveShadow = true;
  leafInstancedMesh.count = 0;
  tree.add(leafInstancedMesh);

  makeTree(options.height, new Vector3(0, 0, 0), 0, 0, options.height / 10);

  leafInstancedMesh.count = leafInstanceIndex;
  leafInstancedMesh.instanceMatrix.needsUpdate = true;
  if (leafInstancedMesh.instanceColor) leafInstancedMesh.instanceColor.needsUpdate = true;

  scene.add(tree);
  tree.position.set(0, -40, 0);
};

export const animate = () => {
  requestAnimationFrame(animate);

  clock.getElapsedTime();

  if (options.flyAround) {
    const radius = 200;
    camera.position.x =
      tree.position.x + radius * Math.cos(0.4 * clock.elapsedTime);
    camera.position.z =
      tree.position.z + radius * Math.sin(0.4 * clock.elapsedTime);
    camera.position.y =
      90 + (tree.position.y + 35 * Math.sin(0.2 * clock.elapsedTime));

    camera.lookAt(tree.position);
  }

  orbitControls.update();
  stats.update();
  renderer.render(scene, camera);
};

function makeTree(
  length: number,
  pos: Vector3,
  rz: number,
  ry: number,
  rBottom: number = length / 20
) {
  const rTop = rBottom * 0.66;

  //Create a group that will serve as the center of rotation
  const group = new Group();
  const branchDirection = new Vector3(0, 1, 0);
  group.position.set(pos.x, pos.y, pos.z);

  if (length < options.minBranchLength) {
    addLeaf(group);
    tree.add(group);
    return;
  }

  const branchColour = new Color()
    .setHex(options.treeColour)
    .offsetHSL(0, MathUtils.seededRandom() / 10, MathUtils.seededRandom() / 8);
  const branchSegment = createCylinder(rTop, rBottom, length, branchColour);
  group.add(branchSegment);
  tree.add(group);

  branchSegment.position.y += length / 2;

  // The rotation is done in two steps, a rotation around the Z axis followed by a rotation around the Y axis
  group.rotation.z = rz;
  branchDirection.applyAxisAngle(new Vector3(0, 0, 1), rz);

  group.rotation.y = ry;
  branchDirection.applyAxisAngle(new Vector3(0, 1, 0), ry);

  // Scale the direction vector to easily find the endpoint of the branch (which is also the start point of the next branches)
  branchDirection.multiplyScalar(length);

  const endOfBranchPos = pos.clone().add(branchDirection);

  const isLargerBranch = length > options.height / 3;
  const drawingTrunk = length === options.height;
  if (isLargerBranch) {
    // fill in the gaps between the larger branches with spheres
    if (!drawingTrunk) {
      const knot = createSphere(rTop * 1.5, branchColour);
      group.add(knot);
    }
  } else {
    if (!drawingTrunk) {
      // add leaves to the branch
      addLeaf(group);
      tree.add(group);
    }
  }

  const numberOfBranches = getNumberOfBranches();
  for (let i = 0; i < numberOfBranches; i++) {
    rz = MathUtils.degToRad(
      randomFloatFromInterval(-options.maxBranchAngle, options.maxBranchAngle)
    );
    ry = MathUtils.degToRad(
      randomFloatFromInterval(-options.maxBranchAngle, options.maxBranchAngle)
    );

    makeTree(
      length *
        MathUtils.mapLinear(
          options.minBranchLength,
          minBranchLengthRange[0],
          minBranchLengthRange[1],
          minBranchLengthRatioRange[0],
          minBranchLengthRatioRange[1]
        ),
      endOfBranchPos,
      rz,
      ry,
      rTop
    );
  }
}

function getNumberOfBranches() {
  const rnd = MathUtils.seededRandom();
  return rnd < 1 - options.branchDensity
    ? randomIntFromInterval(1, 2)
    : randomIntFromInterval(3, 4);
}

function addLeaf(group: Group) {
  const s = options.leafSize * MathUtils.seededRandom();
  const rx = MathUtils.degToRad(360 * MathUtils.seededRandom());
  const leafRz = MathUtils.degToRad(360 * MathUtils.seededRandom());

  const leafColour = new Color()
    .setHex(options.leafColour)
    .offsetHSL(
      MathUtils.seededRandom() / 10,
      MathUtils.seededRandom() / 10,
      MathUtils.seededRandom() / 8
    );

  if (!options.hasLeaves || leafInstanceIndex >= MAX_LEAF_INSTANCES) return;

  // Pivot offset (replicates the original centering + stem adjustment, scaled by s)
  const leafPos = new Vector3(
    s * (-leafModelCenter.x + leafModelSize.x * 0.0075),
    s * (-leafModelCenter.y + leafModelSize.y * 0.01),
    s * (-leafModelCenter.z - leafModelSize.z * 0.45)
  );

  const M_group = new Matrix4().compose(
    group.position,
    new Quaternion().setFromEuler(group.rotation),
    new Vector3(1, 1, 1)
  );
  const M_rotParent = new Matrix4().makeRotationFromEuler(new Euler(rx, 0, leafRz));
  const M_leaf = new Matrix4().compose(leafPos, new Quaternion(), new Vector3(s, s, s));

  leafInstancedMesh.setMatrixAt(leafInstanceIndex, M_group.multiply(M_rotParent).multiply(M_leaf));
  leafInstancedMesh.setColorAt(leafInstanceIndex, leafColour);
  leafInstanceIndex++;
}

function createGUI() {
  const gui = new GUI();
  var buttonHandlers = {
    newSeed: function () {
      options.seed = MathUtils.randInt(0, 10000);
      createTree();
    },
  };
  const newSeedButton = gui.add(buttonHandlers, "newSeed").name("Random Tree");
  if (newSeedButton.domElement.parentElement) {
    newSeedButton.domElement.parentElement.id = "new-seed-button";
  }

  const treeFolder = gui.addFolder("Tree");
  treeFolder.open();
  const leavesFolder = gui.addFolder("Leaves");
  leavesFolder.open();
  treeFolder
    .add(options, "seed")
    .name("Seed")
    .listen()
    .onFinishChange(createTree);
  treeFolder
    .add(options, "height", 10, 30, 5)
    .name("Height")
    .onFinishChange(createTree);
  treeFolder
    .add(
      options,
      "minBranchLength",
      minBranchLengthRange[0],
      minBranchLengthRange[1],
      1
    )
    .name("Min. Branch Length")
    .onFinishChange(createTree);
  treeFolder
    .add(options, "maxBranchAngle", 30, 180, 5)
    .name("Max. Angle")
    .onFinishChange(createTree);
  treeFolder
    .add(options, "branchDensity", 0.1, 0.5, 0.1)
    .name("Branch Density")
    .onFinishChange(createTree);
  treeFolder
    .addColor(options, "treeColour")
    .name("Colour")
    .onFinishChange(createTree);

  leavesFolder
    .add(options, "hasLeaves")
    .name("Show?")
    .onFinishChange(createTree);
  leavesFolder
    .add(options, "leafSize", 10, 40, 5)
    .name("Size")
    .onFinishChange(createTree);
  leavesFolder
    .addColor(options, "leafColour")
    .name("Colour")
    .onFinishChange(createTree);

  const worldFolder = gui.addFolder("World");
  worldFolder.add(options, "flyAround").name("Fly Around");
  worldFolder
    .addColor(options, "groundColour")
    .name("Ground Colour")
    .onFinishChange(() => {
      groundMaterial.color.setHex(options.groundColour);
    });
  worldFolder.open();
}

function randomIntFromInterval(min: number, max: number) {
  // min and max included
  return Math.floor(MathUtils.seededRandom() * (max - min + 1) + min);
}

function randomFloatFromInterval(min: number, max: number) {
  return MathUtils.seededRandom() * (max - min) + min;
}
