export function fbm2D(
  noise: (x: number, y: number) => number,
  x: number, z: number,
  freq: number, octaves: number, lacunarity: number, gain: number,
): number {
  let sum = 0;
  let amp = 1;
  let f = freq;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * f, z * f) * amp;
    f *= lacunarity;
    amp *= gain;
  }
  return sum;
}

export function fbm3D(
  noise: (x: number, y: number, z: number) => number,
  x: number, y: number, z: number,
  freq: number, octaves: number, lacunarity: number, gain: number,
): number {
  let sum = 0;
  let amp = 1;
  let f = freq;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * f, y * f, z * f) * amp;
    f *= lacunarity;
    amp *= gain;
  }
  return sum;
}

export function ridgeFbm2D(
  noise: (x: number, y: number) => number,
  x: number, z: number,
  freq: number, octaves: number,
): number {
  let sum = 0;
  let amp = 1;
  let f = freq;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise(x * f, z * f));
    sum += n * n * amp;
    f *= 2;
    amp *= 0.5;
  }
  return sum * 2 - 1;
}

export function ridgeFbm3D(
  noise: (x: number, y: number, z: number) => number,
  x: number, y: number, z: number,
  freq: number, octaves: number,
): number {
  let sum = 0;
  let amp = 1;
  let f = freq;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise(x * f, y * f, z * f));
    sum += n * n * amp;
    f *= 2;
    amp *= 0.5;
  }
  return sum * 2 - 1;
}
