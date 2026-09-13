import { Matrix4, Quaternion, Vector3 } from 'three';

/** Reproduce build_d10.py face bases, then Blender Z-up → glTF Y-up. */
export function d10FaceBasis(digit: number) {
  const numbers = [0, 7, 4, 1, 6, 8, 3, 9, 2, 5];
  const index = numbers.indexOf(digit);
  if (index < 0) throw new Error('D10 digit must be 0–9');
  const h = 1.35 * (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
  const pole = new Vector3(0, 0, index < 5 ? 1.35 : -1.35);
  const k = index < 5 ? index * 2 : (index - 5) * 2 + 1;
  const ring = (i: number) => new Vector3(1.1 * Math.cos(i * Math.PI / 5), 1.1 * Math.sin(i * Math.PI / 5), i % 2 === 0 ? h : -h);
  const points = [pole, ring(k), ring((k + 1) % 10), ring((k + 2) % 10)];
  const center = points.reduce((sum, p) => sum.add(p), new Vector3()).multiplyScalar(.25);
  const normal = points[1].clone().sub(pole).cross(points[2].clone().sub(pole)).normalize();
  if (normal.dot(center) < 0) normal.negate();
  const up = pole.clone().sub(center).normalize();
  const convert = (v: Vector3) => new Vector3(v.x, v.z, -v.y);
  return { normal: convert(normal), up: convert(up) };
}

/** Selected numeral faces the camera, upright; no arbitrary terminal rotation. */
export function d10Landing(digit: number): Quaternion {
  const { normal, up } = d10FaceBasis(digit);
  const right = up.clone().cross(normal).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, normal)).invert();
}
