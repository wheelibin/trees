import {
  Color,
  DirectionalLight,
  DirectionalLightHelper,
  HemisphereLight,
  HemisphereLightHelper,
  Scene,
} from "three";

export const addHemisphereLight = (
  color: Color,
  scene: Scene,
  showHelper = false
) => {
  const light = new HemisphereLight(0xffffff, 0xffffff, 0.3);
  light.color = color;
  light.groundColor.setHSL(0.095, 1, 0.75);
  light.position.set(0, 50, 0);
  scene.add(light);

  if (showHelper) {
    const helper = new HemisphereLightHelper(light, 10);
    scene.add(helper);
  }
};

export const addDirectionalLight = (scene: Scene, showHelper = false) => {
  const light = new DirectionalLight(0xffffff, 1);
  light.color.setHSL(0.1, 1, 0.95);
  light.position.set(-1, 1.75, 1);
  light.position.multiplyScalar(30);
  scene.add(light);

  light.castShadow = true;

  light.shadow.mapSize.width = 2048;
  light.shadow.mapSize.height = 2048;

  const d = 40;

  light.shadow.camera.left = -d;
  light.shadow.camera.right = d;
  light.shadow.camera.top = d;
  light.shadow.camera.bottom = -d;

  if (showHelper) {
    const helper = new DirectionalLightHelper(light, 10);
    scene.add(helper);
  }
};
