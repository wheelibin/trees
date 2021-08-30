import {
  CylinderGeometry,
  MeshLambertMaterial,
  Mesh,
  SphereGeometry,
  ColorRepresentation,
} from "three";

export const createCylinder = (
  rTop: number,
  rBottom: number,
  h: number,
  col: ColorRepresentation
) => {
  const geometry = new CylinderGeometry(rTop, rBottom, h, 6, 1);
  const material = new MeshLambertMaterial({ color: col });
  const cylinder = new Mesh(geometry, material);
  cylinder.receiveShadow = true;
  cylinder.castShadow = true;
  return cylinder;
};

export const createSphere = (
  r: number,
  col: ColorRepresentation,
  opacity = 1
) => {
  const geometry = new SphereGeometry(r, 16, 16);
  const material = new MeshLambertMaterial({
    color: col,
    transparent: true,
    opacity,
  });
  const sphere = new Mesh(geometry, material);
  sphere.receiveShadow = true;
  sphere.castShadow = true;
  return sphere;
};
