/** Зоны карты: 4 угла (X, Y, Z) образуют квадрат/четырёхугольник на плоскости XZ. */

export type Vec3 = { x: number; y: number; z: number };
export type ZoneDef = { name: string; corners: Vec3[] };

export type ZoneHit =
  | { inside: true; name: string; distance: 0 }
  | { inside: false; name: null; nearest: string; distance: number };

export const MAP_ZONES: ZoneDef[] = [
  {
    name: 'Деребас',
    corners: [
      { x: 4590.75, y: 76.15, z: 1791.410034 },
      { x: 4588.950195, y: 76.227898, z: 1838.920044 },
      { x: 4664.22998, y: 76.213203, z: 1837.359985 },
      { x: 4661.990234, y: 76.245399, z: 1790.22998 },
    ],
  },
  {
    name: 'Болото',
    corners: [
      { x: 1000.76001, y: 129.483994, z: 763.356018 },
      { x: 1006.650024, y: 122.425003, z: 2836.570068 },
      { x: 3217.021729, y: 103.75071, z: 2707.801758 },
      { x: 3313.800049, y: 115.669998, z: 616.635986 },
    ],
  },
  {
    name: 'База долга',
    corners: [
      { x: 1620.552368, y: 42.591862, z: 4023.596191 },
      { x: 1616.97998, y: 42.549999, z: 4142.540039 },
      { x: 1735.02002, y: 42.549999, z: 4136.209961 },
      { x: 1733.959961, y: 42.549999, z: 4032.040039 },
    ],
  },
  {
    name: 'Агро',
    corners: [
      { x: 1422.869995, y: 87.532501, z: 3608.540039 },
      { x: 3798.139893, y: 80.540398, z: 3509.370117 },
      { x: 3695.196533, y: 58.283188, z: 5110.123047 },
      { x: 1325.119995, y: 97.091499, z: 5216.72998 },
    ],
  },
  {
    name: 'База НИГ БЛИК',
    corners: [
      { x: 2413.488037, y: 37.741856, z: 6174.008789 },
      { x: 2491.789551, y: 37.759998, z: 6172.30957 },
      { x: 2491.024902, y: 37.759998, z: 6252.079102 },
      { x: 2412.899414, y: 37.633015, z: 6252.579102 },
    ],
  },
  {
    name: 'Янтарь',
    corners: [
      { x: 2123.917969, y: 95.989861, z: 7025.148926 },
      { x: 2199.227539, y: 38.264069, z: 5984.147949 },
      { x: 2998.096924, y: 99.927872, z: 5985.639648 },
      { x: 3111.799316, y: 156.682785, z: 7001.560059 },
    ],
  },
  {
    name: 'Мертвый город',
    corners: [
      { x: 2398.920654, y: 138.167328, z: 7881.553711 },
      { x: 3398.921143, y: 144.244385, z: 7876.276855 },
      { x: 3397.600098, y: 157.54277, z: 8717.769531 },
      { x: 2398.921387, y: 117.982872, z: 8690.042969 },
    ],
  },
  {
    name: 'Лиманск',
    corners: [
      { x: 1131.643188, y: 100.954445, z: 11761.150391 },
      { x: 1196.943115, y: 164.405914, z: 10393.62207 },
      { x: 2605.578125, y: 123.316849, z: 10332.108398 },
      { x: 2616.771484, y: 150.000107, z: 11701.610352 },
    ],
  },
  {
    name: 'Рыжий лес',
    corners: [
      { x: 2715.269531, y: 92.841942, z: 9873.224609 },
      { x: 2713.630127, y: 134.125275, z: 11148.527344 },
      { x: 4187.963867, y: 139.93428, z: 11130.521484 },
      { x: 4127.150391, y: 100.195717, z: 9865.303711 },
    ],
  },
  {
    name: 'Станция Янов',
    corners: [
      { x: 3513.702393, y: 110.040001, z: 12914.374023 },
      { x: 3603.091309, y: 110.041679, z: 12910.836914 },
      { x: 3601.183105, y: 111.281075, z: 12767.938477 },
      { x: 3513.709717, y: 110.040001, z: 12762.224609 },
    ],
  },
  {
    name: 'Юпитер завод',
    corners: [
      { x: 3755.868164, y: 141.615494, z: 11914.375 },
      { x: 4332.087891, y: 149.877151, z: 11913.025391 },
      { x: 4340.262695, y: 146.058411, z: 12382.401367 },
      { x: 3757.232666, y: 139.21405, z: 12374.416016 },
    ],
  },
  {
    name: 'Янов',
    corners: [
      { x: 2837.32666, y: 171.279358, z: 13483.513672 },
      { x: 4397.48877, y: 123.691795, z: 13488.449219 },
      { x: 4466.387207, y: 142.397003, z: 11748.668945 },
      { x: 2446.019531, y: 127.185364, z: 11768.37793 },
    ],
  },
  {
    name: 'Выжигатель',
    corners: [
      { x: 5661.84082, y: 134.854111, z: 11381.686523 },
      { x: 5626.610352, y: 128.125366, z: 11027.476563 },
      { x: 5411.994141, y: 132.349487, z: 11041.825195 },
      { x: 5421.88916, y: 134.027878, z: 11366.527344 },
    ],
  },
  {
    name: 'Припять',
    corners: [
      { x: 7039.641602, y: 166.742203, z: 11701.776367 },
      { x: 6528.945801, y: 122.986435, z: 13528.478516 },
      { x: 4780.793945, y: 127.967819, z: 13260.011719 },
      { x: 5193.271484, y: 137.141281, z: 11813.000977 },
    ],
  },
  {
    name: 'Топи',
    corners: [
      { x: 9196.664063, y: 168.437943, z: 10481.671875 },
      { x: 7614.23584, y: 124.193565, z: 10310.673828 },
      { x: 9374.324219, y: 138.49733, z: 8718.017578 },
      { x: 8159.345215, y: 119.724968, z: 8672.896484 },
    ],
  },
  {
    name: 'Армейские склады',
    corners: [
      { x: 5336.417969, y: 148.9702, z: 7882.629395 },
      { x: 5326.251953, y: 148.185486, z: 8541.132813 },
      { x: 6083.145508, y: 149.338943, z: 8539.698242 },
      { x: 6074.521973, y: 164.937744, z: 7886.315918 },
    ],
  },
  {
    name: 'Мусорный полигон',
    corners: [
      { x: 6100.5625, y: 102.455498, z: 9108.24707 },
      { x: 6052.405273, y: 92.395981, z: 9602.667969 },
      { x: 6700.74707, y: 126.169754, z: 9571.498047 },
      { x: 6695.930664, y: 121.792999, z: 9051.464844 },
    ],
  },
  {
    name: 'Росток',
    corners: [
      { x: 4258.114258, y: 139.831512, z: 6251.652832 },
      { x: 4247.453613, y: 133.861694, z: 7095.328125 },
      { x: 5152.043457, y: 148.520721, z: 7072.494141 },
      { x: 5235.801758, y: 158.337769, z: 6209.029297 },
    ],
  },
  {
    name: 'Свалка',
    corners: [
      { x: 4541.908203, y: 158.769348, z: 3857.712402 },
      { x: 5855.214355, y: 150.681549, z: 3837.629395 },
      { x: 5767.782715, y: 160.020218, z: 5289.632813 },
      { x: 4681.856445, y: 142.198975, z: 5351.478516 },
    ],
  },
  {
    name: 'База свободы',
    corners: [
      { x: 7662.788086, y: 116.220001, z: 5005.952148 },
      { x: 7668.911133, y: 116.220001, z: 4852.773438 },
      { x: 7849.052246, y: 117.500511, z: 4830.710449 },
      { x: 7868.645508, y: 111.144249, z: 5010.866699 },
    ],
  },
  {
    name: 'Институт',
    corners: [
      { x: 8046.396973, y: 116.684334, z: 4242.579102 },
      { x: 8047.266113, y: 116.743034, z: 4430.837402 },
      { x: 8231.228516, y: 112.614059, z: 4419.969727 },
      { x: 8250.189453, y: 115.00267, z: 4240.748047 },
    ],
  },
  {
    name: 'База Охоты',
    corners: [
      { x: 6785.737305, y: 91.25621, z: 2840.321045 },
      { x: 6790.378418, y: 93.023705, z: 2974.969482 },
      { x: 6928.466797, y: 95.402107, z: 2971.051025 },
      { x: 6932.523926, y: 91.259003, z: 2833.575439 },
    ],
  },
];

/** Упорядочить углы по углу вокруг центра (чтобы полигон не был «бантиком»). */
export function orderedRing(corners: Vec3[]): Array<{ x: number; z: number }> {
  const pts = corners.map((c) => ({ x: c.x, z: c.z }));
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
  return [...pts].sort((a, b) => Math.atan2(a.z - cz, a.x - cx) - Math.atan2(b.z - cz, b.x - cx));
}

export function pointInPolygon(px: number, pz: number, ring: Array<{ x: number; z: number }>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const zi = ring[i].z;
    const xj = ring[j].x;
    const zj = ring[j].z;
    const hit = zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi + 0) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function distPointToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const ab2 = abx * abx + abz * abz;
  if (ab2 <= 1e-9) return Math.hypot(apx, apz);
  let t = (apx * abx + apz * abz) / ab2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), pz - (az + t * abz));
}

export function distanceToZone(px: number, pz: number, zone: ZoneDef): number {
  const ring = orderedRing(zone.corners);
  if (pointInPolygon(px, pz, ring)) return 0;
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    best = Math.min(best, distPointToSegment(px, pz, a.x, a.z, b.x, b.z));
  }
  return best;
}

export function resolveZone(x: number, z: number, zones: ZoneDef[] = MAP_ZONES): ZoneHit {
  let nearestName = zones[0]?.name ?? '';
  let nearestDist = Infinity;
  for (const zone of zones) {
    const ring = orderedRing(zone.corners);
    if (pointInPolygon(x, z, ring)) {
      return { inside: true, name: zone.name, distance: 0 };
    }
    const d = distanceToZone(x, z, zone);
    if (d < nearestDist) {
      nearestDist = d;
      nearestName = zone.name;
    }
  }
  return { inside: false, name: null, nearest: nearestName, distance: nearestDist };
}

/** Достаёт X/Y/Z из строки вида `8525.95, 133.57, 7248.58` или `pos=<...>`. */
export function parsePos(raw: string): Vec3 | null {
  const m = raw.match(
    /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
  );
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]), z: Number(m[3]) };
}

export function formatCoords(p: Vec3): string {
  const r = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
  return `${r(p.x)}, ${r(p.y)}, ${r(p.z)}`;
}

export function describeTeleportPos(raw: string, zones: ZoneDef[] = MAP_ZONES): {
  coords: string;
  zoneLabel: string;
  zoneName: string | null;
  nearest: string | null;
  nearestMeters: number | null;
} | null {
  const pos = parsePos(raw);
  if (!pos) return null;
  const hit = resolveZone(pos.x, pos.z, zones);
  const coords = formatCoords(pos);
  if (hit.inside) {
    return {
      coords,
      zoneLabel: hit.name,
      zoneName: hit.name,
      nearest: null,
      nearestMeters: null,
    };
  }
  const meters = Math.round(hit.distance);
  return {
    coords,
    zoneLabel: `точка не зарегистрирована · рядом ${hit.nearest} (~${meters} м)`,
    zoneName: null,
    nearest: hit.nearest,
    nearestMeters: meters,
  };
}
