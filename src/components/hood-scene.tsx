'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { Dims, FamilyTraits, DuctPick } from '@/lib/calc';
import {
  buildLayout,
  BUILD,
  supplyType2Chamfer,
  islandSupplyType2Chamfer,
  islandSupplyType1Seam,
  type Layout,
} from '@/lib/geometry';

export type ViewMode = 'solid' | 'xray' | 'explode';

const MM = 0.001;
const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ */
/* Окружение: процедурная карта отражений вместо HDR с внешнего CDN.    */
/* ------------------------------------------------------------------ */

function StudioEnvironment() {
  const { scene } = useThree();

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    /* Тёплый «цех» под палитру сайта — металл читается бронзово, не холодно-серо */
    const sky = ctx.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#f3ebe3');
    sky.addColorStop(0.42, '#c4a890');
    sky.addColorStop(0.52, '#3d322c');
    sky.addColorStop(1, '#1a1612');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 256);

    // световые панели цеха — дают металлу продольные блики
    ctx.fillStyle = '#fff6ea';
    ctx.globalAlpha = 0.9;
    ctx.fillRect(40, 26, 190, 26);
    ctx.fillRect(300, 40, 150, 18);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(60, 96, 380, 10);
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => {
    const previous = scene.environment;
    scene.environment = texture;
    return () => {
      scene.environment = previous;
      texture.dispose();
    };
  }, [scene, texture]);

  return null;
}

/* ------------------------------------------------------------------ */
/* Материалы                                                           */
/* ------------------------------------------------------------------ */

function useMaterials(mode: ViewMode, material: '430' | '304') {
  return useMemo(() => {
    const xray = mode === 'xray';
    const steel = new THREE.MeshStandardMaterial({
      color: material === '304' ? '#B9AFA3' : '#A89888',
      metalness: 0.86,
      roughness: material === '304' ? 0.22 : 0.32,
      side: THREE.DoubleSide,
      transparent: xray,
      opacity: xray ? 0.18 : 1,
      depthWrite: !xray,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: '#3A322C',
      metalness: 0.7,
      roughness: 0.5,
      transparent: xray,
      opacity: xray ? 0.25 : 1,
      depthWrite: !xray,
    });
    const filter = new THREE.MeshStandardMaterial({
      color: '#A89A8C',
      metalness: 0.78,
      roughness: 0.48,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const water = new THREE.MeshStandardMaterial({
      color: '#58B4DC',
      metalness: 0.1,
      roughness: 0.15,
      transparent: true,
      opacity: 0.75,
      emissive: '#1d6a8c',
      emissiveIntensity: 0.35,
    });
    const lamp = new THREE.MeshStandardMaterial({
      color: '#FFF4E2',
      emissive: '#FFD9A8',
      emissiveIntensity: 1.4,
      roughness: 0.4,
    });
    const ghost = mode !== 'solid';
    const corpus = new THREE.MeshStandardMaterial({
      color: material === '304' ? '#B9AFA3' : '#A89888',
      metalness: 0.86,
      roughness: material === '304' ? 0.22 : 0.32,
      side: THREE.DoubleSide,
      transparent: ghost,
      opacity: xray ? 0.16 : ghost ? 0.32 : 1,
      depthWrite: !ghost,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    return { steel, dark, filter, water, lamp, corpus };
  }, [mode, material]);
}

/* ------------------------------------------------------------------ */
/* Узлы изделия                                                        */
/* ------------------------------------------------------------------ */

/**
 * Корпус: торцы по W вертикальные.
 * ТИП 1 — короткий низ / длинный верх; ТИП 2 — наоборот; ТИП 3 — прямоугольник.
 * ЗПВП — отдельно сварной двухкамерный корпус.
 */
function makeFrustumShell(
  bw: number,
  bd: number,
  bottomZ: number,
  tw: number,
  td: number,
  topZ: number,
) {
  const y0 = -0.5;
  const y1 = 0.5;
  const corners = [
    [-bw / 2, y0, bottomZ - bd / 2],
    [bw / 2, y0, bottomZ - bd / 2],
    [bw / 2, y0, bottomZ + bd / 2],
    [-bw / 2, y0, bottomZ + bd / 2],
    [-tw / 2, y1, topZ - td / 2],
    [tw / 2, y1, topZ - td / 2],
    [tw / 2, y1, topZ + td / 2],
    [-tw / 2, y1, topZ + td / 2],
  ];
  const faces = [
    [0, 1, 5, 0, 5, 4],
    [1, 2, 6, 1, 6, 5],
    [2, 3, 7, 2, 7, 6],
    [3, 0, 4, 3, 4, 7],
  ];
  const positions: number[] = [];
  const indices: number[] = [];
  let vert = 0;
  for (const face of faces) {
    for (let i = 0; i < 6; i++) {
      const c = corners[face[i]];
      positions.push(c[0], c[1], c[2]);
      indices.push(vert++);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Добавить грань из двух треугольников (a-b-c, a-c-d). */
function pushQuad(
  positions: number[],
  indices: number[],
  a: number[],
  b: number[],
  c: number[],
  d: number[],
) {
  const base = positions.length / 3;
  for (const p of [a, b, c, a, c, d]) {
    positions.push(p[0], p[1], p[2]);
  }
  for (let i = 0; i < 6; i++) indices.push(base + i);
}

/**
 * Корпус ЗПВП по схеме:
 * ТИП 1 — скос низа, фронт вертикальный 90°;
 * ТИП 2 — низ прямой (углы 90°); фронт: длинный скос // фильтру + короткая вертикаль снизу;
 * ТИП 3 — прямоугольный короб.
 * У всех — наклонный сварной шов между вытяжкой и притоком.
 */
function makeWeldedSupplyShell(layout: Layout) {
  const W = layout.dims.w * MM;
  const D = layout.dims.d * MM;
  const H = layout.dims.h * MM;
  const plenum = layout.supplyPlenum!.depth * MM;
  const yR = layout.supplyPlenum!.frontRise * MM;
  const profile = layout.profile;
  const rect = profile === 'rect';
  const type2 = profile === 'trapezoid';
  const hw = W / 2;
  const zB = -D / 2;
  const zF = D / 2;
  const zP = zF - plenum;
  const yAt = (z: number) => (D < 1e-9 ? 0 : yR * ((z - zB) / (zF - zB)));
  const yFront = rect ? 0 : yR;
  const yP = rect ? 0 : yAt(zP);

  /*
   * ТИП 2 (зелёный профиль): низ горизонтальный, зад/низ/фронт-низ — 90°.
   * Сверху длинный скос параллелен плоскости фильтра; внизу — короткая вертикаль.
   */
  const ch = type2
    ? supplyType2Chamfer(layout.dims.h, layout.dims.d, layout.supplyPlenum!.depth)
    : null;
  const chamfer = ch ? ch.chamferZ * MM : 0;
  const ySplit = ch ? ch.vertDy * MM : H;
  const zTopF = zF - chamfer;

  /*
   * Шов (синяя линия): // скосу, от низа до подкрышечного зазора.
   * Не доводить до y=H — иначе тёмная полоса на крышке между патрубками.
   */
  const ySeamTop = H - 8 * MM;
  const slope = type2 ? (zTopF - zF) / Math.max(H - ySplit, 0.02) : 0;
  const seamGap = type2 ? Math.min(plenum * 0.72, 0.1) : 0;
  let zSeamTop = type2 ? zTopF - seamGap : 0;
  let zSeamBot = type2 ? zSeamTop - slope * ySeamTop : 0;
  if (type2 && zSeamBot > zF - 10 * MM) {
    zSeamBot = zF - 10 * MM;
    zSeamTop = zSeamBot + slope * ySeamTop;
  }

  /* ТИП 1/3: шов у перегородки, тоже не до крышки */
  let ySeam0 = yP;
  let zSeamBot1 = zP;
  let zSeamTop1 = zP;
  if (!type2) {
    const seamDz = Math.min(plenum * 0.45, 0.1);
    zSeamBot1 = zP + seamDz * 0.45;
    zSeamTop1 = zP - seamDz * 0.55;
  }

  const pos: number[] = [];
  const idx: number[] = [];

  pushQuad(pos, idx, [-hw, 0, zB], [hw, 0, zB], [hw, H, zB], [-hw, H, zB]);

  if (type2) {
    /* Длинный скос; короткая вертикаль снизу */
    pushQuad(pos, idx, [hw, ySplit, zF], [-hw, ySplit, zF], [-hw, H, zTopF], [hw, H, zTopF]);
    pushQuad(pos, idx, [hw, ySplit, zF], [-hw, ySplit, zF], [-hw, 0, zF], [hw, 0, zF]);
    {
      const p = [[hw, 0, zB], [hw, 0, zF], [hw, ySplit, zF], [hw, H, zTopF], [hw, H, zB]];
      const base = pos.length / 3;
      for (const v of [p[0], p[1], p[2], p[0], p[2], p[3], p[0], p[3], p[4]]) {
        pos.push(v[0], v[1], v[2]);
      }
      for (let i = 0; i < 9; i++) idx.push(base + i);
    }
    {
      const p = [[-hw, 0, zB], [-hw, H, zB], [-hw, H, zTopF], [-hw, ySplit, zF], [-hw, 0, zF]];
      const base = pos.length / 3;
      for (const v of [p[0], p[1], p[2], p[0], p[2], p[3], p[0], p[3], p[4]]) {
        pos.push(v[0], v[1], v[2]);
      }
      for (let i = 0; i < 9; i++) idx.push(base + i);
    }
    pushQuad(pos, idx, [-hw, H, zB], [hw, H, zB], [hw, H, zTopF], [-hw, H, zTopF]);

    /* Одна плоскость: // скосу, от y=0 до под крышкой */
    pushQuad(
      pos,
      idx,
      [-hw, 0, zSeamBot],
      [hw, 0, zSeamBot],
      [hw, ySeamTop, zSeamTop],
      [-hw, ySeamTop, zSeamTop],
    );
  } else if (rect) {
    pushQuad(pos, idx, [hw, 0, zF], [-hw, 0, zF], [-hw, H, zF], [hw, H, zF]);
    pushQuad(pos, idx, [hw, 0, zB], [hw, 0, zF], [hw, H, zF], [hw, H, zB]);
    pushQuad(pos, idx, [-hw, 0, zB], [-hw, H, zB], [-hw, H, zF], [-hw, 0, zF]);
    pushQuad(pos, idx, [-hw, H, zB], [hw, H, zB], [hw, H, zF], [-hw, H, zF]);
    pushQuad(
      pos,
      idx,
      [-hw, ySeam0, zSeamBot1],
      [hw, ySeam0, zSeamBot1],
      [hw, ySeamTop, zSeamTop1],
      [-hw, ySeamTop, zSeamTop1],
    );
  } else {
    pushQuad(pos, idx, [hw, yFront, zF], [-hw, yFront, zF], [-hw, H, zF], [hw, H, zF]);
    {
      const p = [[hw, 0, zB], [hw, yR, zF], [hw, H, zF], [hw, H, zB]];
      const base = pos.length / 3;
      for (const v of [p[0], p[1], p[2], p[0], p[2], p[3]]) pos.push(v[0], v[1], v[2]);
      for (let i = 0; i < 6; i++) idx.push(base + i);
    }
    {
      const p = [[-hw, 0, zB], [-hw, H, zB], [-hw, H, zF], [-hw, yR, zF]];
      const base = pos.length / 3;
      for (const v of [p[0], p[1], p[2], p[0], p[2], p[3]]) pos.push(v[0], v[1], v[2]);
      for (let i = 0; i < 6; i++) idx.push(base + i);
    }
    pushQuad(pos, idx, [-hw, H, zB], [hw, H, zB], [hw, H, zF], [-hw, H, zF]);
    pushQuad(
      pos,
      idx,
      [-hw, ySeam0, zSeamBot1],
      [hw, ySeam0, zSeamBot1],
      [hw, ySeamTop, zSeamTop1],
      [-hw, ySeamTop, zSeamTop1],
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Корпус ЗПВО по схемам: симметрия по Z, приток с двух сторон, вытяжка в центре.
 * ТИП 1 — скос низа (крутой под коробом, пологий мост); ТИП 2 — скос верха; ТИП 3 — прямоугольник.
 */
function makeIslandSupplyShell(layout: Layout) {
  const W = layout.dims.w * MM;
  const D = layout.dims.d * MM;
  const H = layout.dims.h * MM;
  const plenum = layout.supplyPlenum!.depth * MM;
  const profile = layout.profile;
  const rect = profile === 'rect';
  const type2 = profile === 'trapezoid';
  const hw = W / 2;
  const zF = D / 2;
  const zB = -D / 2;
  const zPF = zF - plenum;
  const zPB = zB + plenum;

  const ch = type2
    ? islandSupplyType2Chamfer(layout.dims.h, layout.dims.d, layout.supplyPlenum!.depth)
    : null;
  const chamfer = ch ? ch.chamferZ * MM : 0;
  const ySplit = ch ? ch.vertDy * MM : H;
  const zTopF = zF - chamfer;
  const zTopB = zB + chamfer;

  const pos: number[] = [];
  const idx: number[] = [];

  if (type2) {
    /*
     * ТИП 2: перегородка // обшивке на всём контуре (узкая полость).
     * Низ почти у внешней стенки → «красная» сторона маленькая; скос тот же α.
     */
    const yV = ySplit;
    const dIn = plenum;
    const zPartBotF = zF - dIn;
    const zPartBotB = zB + dIn;
    const zPartTopF = zTopF - dIn;
    const zPartTopB = zTopB + dIn;

    pushQuad(pos, idx, [hw, yV, zF], [-hw, yV, zF], [-hw, 0, zF], [hw, 0, zF]);
    pushQuad(pos, idx, [hw, yV, zF], [-hw, yV, zF], [-hw, H, zTopF], [hw, H, zTopF]);
    pushQuad(pos, idx, [-hw, yV, zB], [hw, yV, zB], [hw, 0, zB], [-hw, 0, zB]);
    pushQuad(pos, idx, [-hw, yV, zB], [hw, yV, zB], [hw, H, zTopB], [-hw, H, zTopB]);
    pushQuad(pos, idx, [-hw, H, zTopB], [hw, H, zTopB], [hw, H, zTopF], [-hw, H, zTopF]);

    /* Перегородка: та же вертикаль + тот же скос, смещение dIn внутрь */
    pushQuad(pos, idx, [-hw, 0, zPartBotF], [hw, 0, zPartBotF], [hw, yV, zPartBotF], [-hw, yV, zPartBotF]);
    pushQuad(pos, idx, [hw, 0, zPartBotB], [-hw, 0, zPartBotB], [-hw, yV, zPartBotB], [hw, yV, zPartBotB]);
    pushQuad(pos, idx, [-hw, yV, zPartBotF], [hw, yV, zPartBotF], [hw, H, zPartTopF], [-hw, H, zPartTopF]);
    pushQuad(pos, idx, [hw, yV, zPartBotB], [-hw, yV, zPartBotB], [-hw, H, zPartTopB], [hw, H, zPartTopB]);

    /* Полка крыши над притоком: шов → ребро */
    if (dIn > 1e-6 && zTopF > zPartTopF + 1e-6) {
      pushQuad(pos, idx, [-hw, H, zPartTopF], [hw, H, zPartTopF], [hw, H, zTopF], [-hw, H, zTopF]);
      pushQuad(pos, idx, [hw, H, zPartTopB], [-hw, H, zPartTopB], [-hw, H, zTopB], [hw, H, zTopB]);
    }

    const addSide = (x: number, flip: boolean) => {
      const p0 = [x, 0, zB];
      const p1 = [x, 0, zF];
      const p2 = [x, yV, zF];
      const p3 = [x, H, zTopF];
      const p4 = [x, H, zTopB];
      const p5 = [x, yV, zB];
      const tris = flip
        ? [
            [p0, p2, p1], [p0, p5, p2],
            [p2, p4, p3], [p2, p5, p4],
          ]
        : [
            [p0, p1, p2], [p0, p2, p5],
            [p2, p3, p4], [p2, p4, p5],
          ];
      for (const t of tris) {
        const base = pos.length / 3;
        for (const v of t) pos.push(v[0], v[1], v[2]);
        idx.push(base, base + 1, base + 2);
      }
    };
    addSide(hw, false);
    addSide(-hw, true);
  } else if (rect) {
    /*
     * ТИП 3: прямоугольный короб; перегородки до крыши (сварной шов).
     * Полки крыши над притоком — без наложения на центральную плоскость.
     */
    pushQuad(pos, idx, [-hw, 0, zB], [hw, 0, zB], [hw, H, zB], [-hw, H, zB]);
    pushQuad(pos, idx, [hw, 0, zF], [-hw, 0, zF], [-hw, H, zF], [hw, H, zF]);
    pushQuad(pos, idx, [hw, 0, zB], [hw, 0, zF], [hw, H, zF], [hw, H, zB]);
    pushQuad(pos, idx, [-hw, 0, zB], [-hw, H, zB], [-hw, H, zF], [-hw, 0, zF]);
    /* Крыша: только вытяжная зона между швами (полки — отдельно) */
    pushQuad(pos, idx, [-hw, H, zPB], [hw, H, zPB], [hw, H, zPF], [-hw, H, zPF]);
    /* Перегородки 0→H */
    pushQuad(pos, idx, [-hw, 0, zPF], [hw, 0, zPF], [hw, H, zPF], [-hw, H, zPF]);
    pushQuad(pos, idx, [hw, 0, zPB], [-hw, 0, zPB], [-hw, H, zPB], [hw, H, zPB]);
    /* Полки над притоком */
    if (plenum > 1e-6) {
      pushQuad(pos, idx, [-hw, H, zPF], [hw, H, zPF], [hw, H, zF], [-hw, H, zF]);
      pushQuad(pos, idx, [hw, H, zPB], [-hw, H, zPB], [-hw, H, zB], [hw, H, zB]);
    }
  } else {
    /*
     * ТИП 1: короб без сплошного скоса по W (жаровики видны снизу);
     * боковины-монодетали ×2 — полный торец по контуру рис-2.
     */
    const seam = islandSupplyType1Seam(
      layout.dims.h,
      layout.dims.d,
      layout.supplyPlenum!.depth,
    );
    const yA = seam.ySeam * MM;
    const zAF = seam.zSeam * MM;
    const zAB = -seam.zSeam * MM;
    const yBot = seam.yB * MM;
    const zBotF = seam.zBot * MM;
    const zBotB = -seam.zBot * MM;

    /* Короб */
    pushQuad(pos, idx, [-hw, H, zB], [hw, H, zB], [hw, H, zF], [-hw, H, zF]);
    pushQuad(pos, idx, [hw, yA, zF], [-hw, yA, zF], [-hw, H, zF], [hw, H, zF]);
    pushQuad(pos, idx, [-hw, yA, zB], [hw, yA, zB], [hw, H, zB], [-hw, H, zB]);
    pushQuad(pos, idx, [-hw, yA, zAF], [hw, yA, zAF], [hw, H, zAF], [-hw, H, zAF]);
    pushQuad(pos, idx, [hw, yA, zAB], [-hw, yA, zAB], [-hw, H, zAB], [hw, H, zAB]);

    /* Боковины-монодетали ×2: полный торец (верх + крылья + низ), без скоса внутри по W */
    const addSide = (x: number, flip: boolean) => {
      const p1 = [x, yBot, zBotF];
      const p2 = [x, yA, zAF];
      const p3 = [x, yA, zF];
      const p4 = [x, H, zF];
      const p5 = [x, H, zB];
      const p6 = [x, yA, zB];
      const p7 = [x, yA, zAB];
      const p8 = [x, yBot, zBotB];
      const tris = flip
        ? [
            [p3, p6, p5], [p3, p5, p4],
            [p1, p3, p2],
            [p6, p8, p7],
            [p1, p2, p7], [p1, p7, p8],
          ]
        : [
            [p3, p4, p5], [p3, p5, p6],
            [p1, p2, p3],
            [p6, p7, p8],
            [p1, p7, p2], [p1, p8, p7],
          ];
      for (const t of tris) {
        const base = pos.length / 3;
        for (const v of t) pos.push(v[0], v[1], v[2]);
        idx.push(base, base + 1, base + 2);
      }
    };
    addSide(hw, false);
    addSide(-hw, true);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * ТИП 1 пристенный: верх прямой; низ скошен вверх к фронту; спереди короткая вертикаль.
 */
function makeSlopedBottomShell(layout: Layout) {
  const W = layout.dims.w * MM;
  const D = layout.dims.d * MM;
  const H = layout.dims.h * MM;
  const yR = Math.max(layout.bottomRise, 40) * MM;
  const hw = W / 2;
  const zB = -D / 2;
  const zF = D / 2;

  const pos: number[] = [];
  const idx: number[] = [];

  pushQuad(pos, idx, [-hw, 0, zB], [hw, 0, zB], [hw, H, zB], [-hw, H, zB]);
  pushQuad(pos, idx, [hw, yR, zF], [-hw, yR, zF], [-hw, H, zF], [hw, H, zF]);
  {
    const p = [[hw, 0, zB], [hw, yR, zF], [hw, H, zF], [hw, H, zB]];
    const base = pos.length / 3;
    for (const v of [p[0], p[1], p[2], p[0], p[2], p[3]]) pos.push(v[0], v[1], v[2]);
    for (let i = 0; i < 6; i++) idx.push(base + i);
  }
  {
    const p = [[-hw, 0, zB], [-hw, H, zB], [-hw, H, zF], [-hw, yR, zF]];
    const base = pos.length / 3;
    for (const v of [p[0], p[1], p[2], p[0], p[2], p[3]]) pos.push(v[0], v[1], v[2]);
    for (let i = 0; i < 6; i++) idx.push(base + i);
  }
  pushQuad(pos, idx, [-hw, H, zB], [hw, H, zB], [hw, H, zF], [-hw, H, zF]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * ТИП 1 островной (ЗВО): верх прямой; скос снизу к обоим торцам по D;
 * короткие вертикали спереди и сзади. Сплошного дна нет.
 */
function makeIslandSlopedBottomShell(layout: Layout) {
  const W = layout.dims.w * MM;
  const D = layout.dims.d * MM;
  const H = layout.dims.h * MM;
  const yR = Math.max(layout.bottomRise, 40) * MM;
  const hw = W / 2;
  const zB = -D / 2;
  const zF = D / 2;

  const pos: number[] = [];
  const idx: number[] = [];

  /* Тыл и фронт — короткие стенки от скоса до верха */
  pushQuad(pos, idx, [-hw, yR, zB], [hw, yR, zB], [hw, H, zB], [-hw, H, zB]);
  pushQuad(pos, idx, [hw, yR, zF], [-hw, yR, zF], [-hw, H, zF], [hw, H, zF]);
  /* Боковины: низ V (центр y=0), верх полный */
  {
    const p = [[hw, 0, 0], [hw, yR, zF], [hw, H, zF], [hw, H, zB], [hw, yR, zB]];
    const base = pos.length / 3;
    /* два треугольника: центр-фронт-верхфронт + центр-верхфронт-верхтыл-тыл… */
    for (const v of [p[0], p[1], p[2], p[0], p[2], p[3], p[0], p[3], p[4]]) {
      pos.push(v[0], v[1], v[2]);
    }
    for (let i = 0; i < 9; i++) idx.push(base + i);
  }
  {
    const p = [[-hw, 0, 0], [-hw, yR, zB], [-hw, H, zB], [-hw, H, zF], [-hw, yR, zF]];
    const base = pos.length / 3;
    for (const v of [p[0], p[1], p[2], p[0], p[2], p[3], p[0], p[3], p[4]]) {
      pos.push(v[0], v[1], v[2]);
    }
    for (let i = 0; i < 9; i++) idx.push(base + i);
  }
  pushQuad(pos, idx, [-hw, H, zB], [hw, H, zB], [hw, H, zF], [-hw, H, zF]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Корпус. */
function Corpus({ layout, mat }: { layout: Layout; mat: THREE.Material }) {
  const { dims, top, bottom, supplyPlenum, profile, bottomRise, filters } = layout;
  const supply = !!supplyPlenum;
  const island = filters.some((f) => f.kind === 'front' || f.kind === 'back');
  const type1Wall = profile === 'triangle' && !supply && !island;
  const type1Island = profile === 'triangle' && !supply && island;
  const islandSupply = supply && island;
  const wallSupply = supply && !island;

  const geo = useMemo(() => {
    if (islandSupply) return makeIslandSupplyShell(layout);
    if (wallSupply) return makeWeldedSupplyShell(layout);
    if (type1Wall) return makeSlopedBottomShell(layout);
    if (type1Island) return makeIslandSlopedBottomShell(layout);
    return makeFrustumShell(
      dims.w * MM,
      bottom.d * MM,
      bottom.z * MM,
      top.w * MM,
      top.d * MM,
      top.z * MM,
    );
  }, [
    dims.w, dims.d, dims.h,
    top.w, top.d, top.z,
    bottom.d, bottom.z, bottomRise,
    supply, type1Wall, type1Island, islandSupply, wallSupply, profile, island,
    supplyPlenum?.depth, supplyPlenum?.frontRise, layout,
  ]);

  useEffect(() => () => { geo.dispose(); }, [geo]);

  if (supply || type1Wall || type1Island) {
    return <mesh geometry={geo} material={mat} castShadow />;
  }

  return (
    <mesh
      geometry={geo}
      material={mat}
      scale={[1, dims.h * MM, 1]}
      position={[0, (dims.h / 2) * MM, 0]}
      castShadow
    />
  );
}

/** Крышка / врезки. У приточных сварных корпусов крыша уже в оболочке — только патрубки. */
function TopPlate({ layout, mat, dark }: { layout: Layout; mat: THREE.Material; dark: THREE.Material }) {
  const { top, dims, spigots, supplyPlenum, profile, filters } = layout;
  const island = filters.some((f) => f.kind === 'front' || f.kind === 'back');

  if (supplyPlenum) {
    /* ЗПВП ТИП 2: скос режет плоскую крышу; ЗПВО — симметрия, без сдвига центра */
    const wallType2 = !island && profile === 'trapezoid';
    const chamfer =
      wallType2
        ? supplyType2Chamfer(dims.h, dims.d, supplyPlenum.depth).chamferZ
        : island && profile === 'trapezoid'
          ? islandSupplyType2Chamfer(dims.h, dims.d, supplyPlenum.depth).chamferZ
          : 0;
    const topD = island
      ? top.d - (profile === 'trapezoid' ? 2 * chamfer : 0)
      : top.d - chamfer;
    const topZ = island ? 0 : -chamfer / 2;
    return (
      <group position={[0, dims.h * MM, topZ * MM]}>
        {spigots.map((s, i) => {
          const body = s.role === 'supply' ? mat : dark;
          const localZ = s.z + (top.z - topZ);
          const half = topD / 2 - s.diameter / 2 - 8;
          /* Приток уже в камере — не сдвигать clamp'ом */
          const zPos =
            s.role === 'supply' ? localZ : Math.max(-half, Math.min(half, localZ));
          return (
            <group key={i} position={[s.x * MM, (BUILD.spigot / 2) * MM, zPos * MM]}>
              <mesh material={body}>
                <cylinderGeometry args={[(s.diameter / 2) * MM, (s.diameter / 2) * MM, BUILD.spigot * MM, 28, 1, true]} />
              </mesh>
              <mesh material={body} position={[0, (-BUILD.spigot / 2) * MM, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[(s.diameter / 2) * MM, 28]} />
              </mesh>
              <mesh material={mat} position={[0, (BUILD.spigot / 2) * MM, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <torusGeometry args={[(s.diameter / 2) * MM, 6 * MM, 8, 28]} />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }

  return (
    <group position={[0, dims.h * MM, top.z * MM]}>
      <mesh material={mat} position={[0, 4 * MM, 0]}>
        <boxGeometry args={[top.w * MM, 8 * MM, top.d * MM]} />
      </mesh>
      {spigots.map((s, i) => {
        const body = s.role === 'supply' ? mat : dark;
        return (
          <group key={i} position={[s.x * MM, (BUILD.spigot / 2) * MM, s.z * MM]}>
            <mesh material={body}>
              <cylinderGeometry args={[(s.diameter / 2) * MM, (s.diameter / 2) * MM, BUILD.spigot * MM, 28, 1, true]} />
            </mesh>
            <mesh material={body} position={[0, (-BUILD.spigot / 2) * MM, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[(s.diameter / 2) * MM, 28]} />
            </mesh>
            <mesh material={mat} position={[0, (BUILD.spigot / 2) * MM, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[(s.diameter / 2) * MM, 6 * MM, 8, 28]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * Ядро «ванночка + жироуловитель» у задней стенки (только ЗВП/ЗВОГ пристенные).
 * Отдельно от islandFilterCore — общие только BUILD-константы, не поза.
 * A≡B — низ на ванночке у задника; C≡D — верх под крышей чуть впереди патрубка.
 */
function wallFilterCore(layout: Layout) {
  const { dims, top, bottomRise, spigots } = layout;
  const zBack = -dims.d / 2;
  const trayD = BUILD.core.trayD;
  const trayH = Math.min(BUILD.core.trayH, 22);
  const wallGap = 8;
  const floorGap = 2;
  const yTopClear = 8;

  const trayZ = zBack + wallGap + trayD / 2;
  const floorY =
    bottomRise > 0
      ? bottomRise * ((trayZ - zBack) / Math.max(dims.d, 1))
      : 0;
  const trayY = floorY + floorGap + trayH / 2;

  /* B: низ на ванночке у задника */
  const yB = floorY + floorGap + trayH + 1;
  const zB = trayZ;

  /* C: под крышей, чуть впереди врезки — не угонять в передний угол */
  const yC = dims.h - yTopClear;
  const dy = Math.max(yC - yB, 50);
  const topFront = top.z + top.d / 2;
  const topBack = top.z - top.d / 2;
  const exhaust = spigots.find((s) => s.role === 'exhaust') ?? spigots[0];
  const pipeZ = top.z + (exhaust?.z ?? 0);
  const pipeR = (exhaust?.diameter ?? 160) / 2;
  const halfTop = top.d / 2;
  const outMax = Math.max(60, halfTop * 0.55);
  let zC = pipeZ + Math.min(pipeR + 32, outMax);
  zC = Math.min(zC, topFront - 20);
  zC = Math.max(zC, Math.max(topBack + 28, zB + 50));

  const dz = zC - zB;
  const tilt = Math.atan2(Math.abs(dz), dy);
  const fh = Math.hypot(Math.abs(dz), dy);
  const y = (yB + yC) / 2;
  const z = (zB + zC) / 2;
  /* Низ → задник (−Z), верх → проём (+Z). Знак только для стены — не трогать island. */
  const rotX = dz >= 0 ? tilt : -tilt;

  return {
    tray: {
      w: Math.min(Math.max(dims.w - 120, 220), dims.w - 60),
      d: trayD,
      h: trayH,
      y: trayY,
      z: trayZ,
    },
    filter: { fh, rotX, y, z, yC, zC, yB, zB },
  };
}

/**
 * Островное ядро V (ЗВО / ЗПВО): ванночка в центре; два ряда кассет.
 * ЗВО — тянется к крыше; ЗПВО — стандартный блок BUILD.core (не масштабируется с H/D),
 * центрирован под вытяжкой, с зазором до перегородки притока.
 */
function islandFilterCore(layout: Layout) {
  const { dims, top, spigots, supplyPlenum } = layout;
  const trayD = BUILD.core.trayD;
  const trayH = Math.min(BUILD.core.trayH, 22);
  const floorGap = 2;
  const halfGap = BUILD.core.vGap;
  const isZpvo = !!supplyPlenum;
  const plenum = supplyPlenum?.depth ?? 0;
  /* Зазор верха кассеты до шва притока (красная зона на скрине) */
  const seamClear = 28;
  const zExLimit = dims.d / 2 - plenum - (isZpvo ? seamClear : 28);

  const trayY = floorGap + trayH / 2;
  const yB = floorGap + trayH + 1;

  const exhaust = spigots.find((s) => s.role === 'exhaust') ?? spigots[0];
  const pipeZ = top.z + (exhaust?.z ?? 0);
  const pipeR = (exhaust?.diameter ?? 200) / 2;

  const zBFront = halfGap;
  const zBBack = -halfGap;

  if (isZpvo) {
    /*
     * ЗПВО: P / N со схемы (type2PMin / type2NMin) — const для всех типов.
     * Верх упирается в шов с зазором bridge — не лезет в приточную камеру / на трубу.
     */
    const isType2 = layout.profile === 'trapezoid';
    const isType3 = layout.profile === 'rect';
    const bridge = isType2
      ? BUILD.zpvo.type2Bridge
      : isType3
        ? BUILD.zpvo.type3Bridge
        : BUILD.zpvo.minBridge;
    const yB0 = yB;
    const yC = dims.h - 3;
    const pipeD =
      exhaust?.diameter ??
      (isType3 ? BUILD.zpvo.type3DisplayExhaust : BUILD.zpvo.type2DisplayExhaust);
    const pipeHalf = pipeD / 2;
    const pMin = BUILD.zpvo.type2PMin;
    const nMin = BUILD.zpvo.type2NMin;

    const supply = spigots.find((s) => s.role === 'supply');
    const sDia =
      supply?.diameter ??
      (isType3 ? BUILD.zpvo.type3DisplaySupply : BUILD.zpvo.type2DisplaySupply);
    const zSup = Math.abs(supply?.z ?? dims.d / 4);
    const supplyInner = zSup - sDia / 2;

    /* Шов на крыше: ТИП 2 — верх наклонной перегородки; иначе half − полость */
    const ch2 = isType2
      ? islandSupplyType2Chamfer(dims.h, dims.d, plenum)
      : null;
    const zSeam = ch2
      ? dims.d / 2 - ch2.chamferZ - plenum
      : dims.d / 2 - plenum;
    const zLimTop = zSeam - bridge - 6;

    /* Склейка: верхи на Ø/2+P от оси трубы */
    let zCFront = pipeZ + pipeHalf + pMin;
    let zCBack = pipeZ - pipeHalf - pMin;

    /* N до притока */
    const zMaxByN = supplyInner - nMin;
    if (zCFront > zMaxByN) {
      zCFront = Math.max(pipeHalf + 10, zMaxByN);
      zCBack = -zCFront;
    }
    /* Не пересекать шов */
    if (zCFront > zLimTop) {
      zCFront = zLimTop;
      zCBack = -zLimTop;
    }

    let gapB: number = halfGap;
    if (zCFront < gapB + 24) {
      gapB = Math.max(14, zCFront - 40);
    }

    const dz = Math.max(Math.abs(zCFront - gapB), 24);
    const dy = Math.max(yC - yB0, 50);
    const tilt = Math.atan2(dz, dy);
    const fhBank = Math.hypot(dz, dy);

    return {
      tray: {
        w: Math.max(dims.w - 8, 200),
        d: trayD,
        h: trayH,
        y: floorGap + trayH / 2,
        z: 0,
      },
      front: {
        fh: fhBank,
        rotX: tilt,
        y: (yB0 + yC) / 2,
        z: (gapB + zCFront) / 2,
      },
      back: {
        fh: fhBank,
        rotX: -tilt,
        y: (yB0 + yC) / 2,
        z: (-gapB + zCBack) / 2,
      },
    };
  }

  /* ЗВО: верхи жаровиков к крыше */
  const yTopClear = 10;
  const yC = dims.h - yTopClear;
  const dy = Math.max(yC - yB, 50);
  const halfTop = Math.min(top.d / 2, zExLimit);
  const outMax = Math.max(halfGap + 48, halfTop * 0.38);
  const out = Math.min(pipeR + 22, outMax);
  const zCFront = Math.min(pipeZ + out, zExLimit);
  const zCBack = Math.max(pipeZ - out, -zExLimit);

  const side = (zBottom: number, zTop: number, rotSign: number) => {
    const dz = zTop - zBottom;
    const t = Math.atan2(Math.abs(dz), dy);
    return {
      fh: Math.hypot(Math.abs(dz), dy),
      rotX: rotSign > 0 ? t : -t,
      y: (yB + yC) / 2,
      z: (zBottom + zTop) / 2,
    };
  };

  return {
    tray: {
      w: Math.min(Math.max(dims.w - 120, 220), dims.w - 60),
      d: trayD,
      h: trayH,
      y: trayY,
      z: 0,
    },
    front: side(zBFront, zCFront, 1),
    back: side(zBBack, zCBack, -1),
  };
}

/**
 * ЗПВП (пристенный приток): жироуловитель только в вытяжной камере.
 * Отдельно от wall/island — пункт 2: A≡B на ванночке у задника, C≡D под крышей у врезки вытяжки.
 */
function supplyWallFilterCore(layout: Layout) {
  const { dims, top, spigots, supplyPlenum } = layout;
  const plenum = supplyPlenum!;
  const zBack = -dims.d / 2;
  const zF = dims.d / 2;
  const zP = zF - plenum.depth;
  const yR = plenum.frontRise;
  const yAt = (z: number) => yR * ((z - zBack) / Math.max(zF - zBack, 1));

  const trayD = BUILD.core.trayD;
  const trayH = Math.min(BUILD.core.trayH, 20);
  const wallGap = 22;
  const floorGap = 2;
  /* Зазор под крышей с учётом толщины кассеты после наклона — иначе верх пробивает крышу */
  const tHalf = BUILD.core.filterT * 0.5;

  const trayZ = zBack + wallGap + trayD / 2;
  const floorY = yAt(trayZ);
  const trayY = floorY + floorGap + trayH / 2;

  const yB = floorY + floorGap + trayH + 1;
  const zB = trayZ;

  const exhaust = spigots.find((s) => s.role === 'exhaust') ?? spigots[0];
  const pipeZ = top.z + (exhaust?.z ?? 0);
  const pipeR = (exhaust?.diameter ?? 160) / 2;
  const outMax = Math.max(50, (zP - zBack) * 0.42);
  let zC = pipeZ + Math.min(pipeR + 28, outMax);
  zC = Math.min(zC, zP - 36);
  zC = Math.max(zC, zB + 48);

  /* Сначала оценка наклона, затем опускаем верх C≡D под крышку */
  let yC = dims.h - 8;
  let dy = Math.max(yC - yB, 50);
  let dz = zC - zB;
  let tilt = Math.atan2(Math.abs(dz), dy);
  yC = dims.h - (10 + tHalf * Math.sin(tilt) + 8);
  dy = Math.max(yC - yB, 50);
  dz = zC - zB;
  tilt = Math.atan2(Math.abs(dz), dy);
  const fh = Math.hypot(Math.abs(dz), dy);
  const y = (yB + yC) / 2;
  const z = (zB + zC) / 2;
  const rotX = dz >= 0 ? tilt : -tilt;

  return {
    tray: {
      w: Math.min(Math.max(dims.w - 120, 220), dims.w - 60),
      d: trayD,
      h: trayH,
      y: trayY,
      z: trayZ,
    },
    filter: { fh, rotX, y, z },
  };
}

/**
 * Жиросбор: ванночка в заднем углу + отбортовка.
 * У ТИП 1 кромка только у задника (по скосу) — без «парящей» рамки на y=0.
 */
function Gutter({ layout, mat }: { layout: Layout; mat: THREE.Material }) {
  const { dims, lip, filters, supplyPlenum, bottomRise, profile } = layout;
  const island = filters.some((f) => f.kind === 'front' || f.kind === 'back');

  if (supplyPlenum && !island) {
    const { tray } = supplyWallFilterCore(layout);
    return (
      <mesh material={mat} position={[0, tray.y * MM, tray.z * MM]}>
        <boxGeometry args={[tray.w * MM, tray.h * MM, tray.d * MM]} />
      </mesh>
    );
  }

  if (supplyPlenum && island) {
    /* ЗПВО — ванночка по центру вытяжной зоны (как у ЗВО) */
    const { tray } = islandFilterCore(layout);
    return (
      <mesh material={mat} position={[0, tray.y * MM, tray.z * MM]}>
        <boxGeometry args={[tray.w * MM, tray.h * MM, tray.d * MM]} />
      </mesh>
    );
  }

  if (island) {
    const { tray } = islandFilterCore(layout);
    return (
      <mesh material={mat} position={[0, tray.y * MM, tray.z * MM]}>
        <boxGeometry args={[tray.w * MM, tray.h * MM, tray.d * MM]} />
      </mesh>
    );
  }

  const { tray } = wallFilterCore(layout);
  const t = 16 * MM;
  const w = dims.w * MM;
  const d = dims.d * MM;
  const type1 = profile === 'triangle' && bottomRise > 0;

  return (
    <group>
      {type1 ? (
        <mesh material={mat} position={[0, 3 * MM, -d / 2 + t / 2]}>
          <boxGeometry args={[w + lip * 2 * MM, 2.5 * MM, t]} />
        </mesh>
      ) : (
        <>
          <mesh material={mat} position={[0, 3 * MM, d / 2 - t / 2]}>
            <boxGeometry args={[w + lip * 2 * MM, 2.5 * MM, t]} />
          </mesh>
          <mesh material={mat} position={[0, 3 * MM, -d / 2 + t / 2]}>
            <boxGeometry args={[w + lip * 2 * MM, 2.5 * MM, t]} />
          </mesh>
          <mesh material={mat} position={[w / 2 - t / 2, 3 * MM, 0]}>
            <boxGeometry args={[t, 2.5 * MM, d]} />
          </mesh>
          <mesh material={mat} position={[-w / 2 + t / 2, 3 * MM, 0]}>
            <boxGeometry args={[t, 2.5 * MM, d]} />
          </mesh>
        </>
      )}
      <mesh material={mat} position={[0, tray.y * MM, tray.z * MM]}>
        <boxGeometry args={[tray.w * MM, tray.h * MM, tray.d * MM]} />
      </mesh>
    </group>
  );
}

function renderFilterBank(
  mat: THREE.Material,
  opts: {
    key: string;
    x: number;
    y: number;
    z: number;
    rotX: number;
    fw: number;
    fh: number;
  },
) {
  const baffles = 5;
  const pitch = (BUILD.core.filterT / baffles) * MM;
  const endT = 5 * MM;
  return (
    <group key={opts.key} position={[opts.x, opts.y, opts.z]} rotation={[opts.rotX, 0, 0]}>
      {Array.from({ length: baffles }, (_, b) => (
        <mesh
          key={b}
          material={mat}
          position={[0, 0, (b - (baffles - 1) / 2) * pitch]}
          scale={[opts.fw, opts.fh, 3.5 * MM]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
      <mesh material={mat} position={[-opts.fw / 2, 0, 0]} scale={[endT, opts.fh, BUILD.core.filterT * MM]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh material={mat} position={[opts.fw / 2, 0, 0]} scale={[endT, opts.fh, BUILD.core.filterT * MM]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
    </group>
  );
}

/**
 * Лабиринтные кассеты.
 * Пристенный: низ на ванночке, верх под крышей.
 * Остров: V — два ряда, низы на центральной ванночке, верхи под краями крыши.
 */
function Filters({ layout, mat }: { layout: Layout; mat: THREE.Material }) {
  const { dims, filters, supplyPlenum } = layout;
  const island = filters.some((f) => f.kind === 'front' || f.kind === 'back');
  const fwMax = (dims.w / 2 - 28) * MM;

  if (island) {
    /* ЗВО / ЗПВО: V в вытяжной зоне (у ЗПВО между двумя притоками) */
    const core = islandFilterCore(layout);
    return (
      <group>
        {filters.map((row) => {
          const bank = row.kind === 'front' ? core.front : core.back;
          const fh = bank.fh * MM;
          return Array.from({ length: row.count }, (_, i) => {
            const along = (-row.span / 2 + row.step * (i + 0.5)) * MM;
            const x = Math.max(-fwMax, Math.min(fwMax, along));
            const fw = Math.min(BUILD.core.filterW, row.step * 0.96) * MM;
            return renderFilterBank(mat, {
              key: `${row.kind}-${i}`,
              x,
              y: bank.y * MM,
              z: bank.z * MM,
              rotX: bank.rotX,
              fw,
              fh,
            });
          });
        })}
      </group>
    );
  }

  if (!supplyPlenum) {
    const { filter } = wallFilterCore(layout);
    const fh = filter.fh * MM;
    return (
      <group>
        {filters.map((row) =>
          Array.from({ length: row.count }, (_, i) => {
            const along = (-row.span / 2 + row.step * (i + 0.5)) * MM;
            const x = Math.max(-fwMax, Math.min(fwMax, along));
            const fw = Math.min(BUILD.core.filterW, row.step * 0.96) * MM;
            return renderFilterBank(mat, {
              key: `${row.kind}-${i}`,
              x,
              y: filter.y * MM,
              z: filter.z * MM,
              rotX: filter.rotX,
              fw,
              fh,
            });
          }),
        )}
      </group>
    );
  }

  /* ЗПВП: пункт 2 в вытяжной камере */
  const { filter } = supplyWallFilterCore(layout);
  const fh = filter.fh * MM;
  return (
    <group>
      {filters.map((row) =>
        Array.from({ length: row.count }, (_, i) => {
          const along = (-row.span / 2 + row.step * (i + 0.5)) * MM;
          const x = Math.max(-fwMax, Math.min(fwMax, along));
          const fw = Math.min(BUILD.core.filterW, row.step * 0.96) * MM;
          return renderFilterBank(mat, {
            key: `${row.kind}-${i}`,
            x,
            y: filter.y * MM,
            z: filter.z * MM,
            rotX: filter.rotX,
            fw,
            fh,
          });
        }),
      )}
    </group>
  );
}

/** Гидроконтур: труба с форсунками и водяная завеса. */
function HydroLoop({ layout, mat, water }: { layout: Layout; mat: THREE.Material; water: THREE.Material }) {
  const { dims, nozzles, gutterHeight } = layout;
  if (!nozzles) return null;
  const y = (dims.h * 0.62) * MM;
  const usable = dims.w - 300;
  return (
    <group>
      <mesh material={mat} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[14 * MM, 14 * MM, dims.w * 0.82 * MM, 12]} />
      </mesh>
      {Array.from({ length: nozzles }, (_, i) => {
        const x = (nozzles === 1 ? 0 : -usable / 2 + (usable * i) / (nozzles - 1)) * MM;
        const curtainH = Math.max(y - gutterHeight * MM - 20 * MM, 40 * MM);
        return (
          <group key={i} position={[x, y, 0]}>
            <mesh material={mat} position={[0, -20 * MM, 0]}>
              <coneGeometry args={[14 * MM, 32 * MM, 10]} />
            </mesh>
            <mesh material={water} position={[0, -curtainH / 2 - 28 * MM, 0]}>
              <coneGeometry args={[dims.d * 0.22 * MM, curtainH, 14, 1, true]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Hangers({ layout, mat, length }: { layout: Layout; mat: THREE.Material; length: number }) {
  const { dims, hangers } = layout;
  if (!hangers.length) return null;
  const len = length * MM;
  return (
    <group position={[0, dims.h * MM + len / 2, 0]}>
      {hangers.map((h, i) => (
        <mesh key={i} material={mat} position={[h.x * MM, 0, h.z * MM]}>
          <cylinderGeometry args={[(BUILD.hanger.d / 2) * MM, (BUILD.hanger.d / 2) * MM, len, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function Lamps({ layout, mat, body }: { layout: Layout; mat: THREE.Material; body: THREE.Material }) {
  const { lamps, gutterHeight, supplyPlenum } = layout;
  /* На скошенном низу ЗПВП цилиндры светильников пробивают обшивку — не рисуем */
  if (supplyPlenum || lamps.length === 0) return null;
  return (
    <group position={[0, (gutterHeight + 20) * MM, 0]}>
      {lamps.map((l, i) => (
        <group key={i} position={[l.x * MM, 0, l.z * MM]}>
          <mesh material={body}>
            <cylinderGeometry args={[(BUILD.lamp.d / 2) * MM, (BUILD.lamp.d / 2) * MM, BUILD.lamp.h * MM, 16]} />
          </mesh>
          <mesh material={mat} position={[0, -(BUILD.lamp.h / 2) * MM, 0]}>
            <cylinderGeometry args={[(BUILD.lamp.d / 2 - 8) * MM, (BUILD.lamp.d / 2 - 8) * MM, 4 * MM, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Приточная камера: решётки выпуска (перегородка-шов уже в сварном корпусе).
 * ЗПВП — на переднем фронте; ЗПВО — на обоих наружных скосах у низа.
 */
function SupplyChamber({
  layout,
  mat,
  dark,
}: {
  layout: Layout;
  mat: THREE.Material;
  dark: THREE.Material;
}) {
  const { dims, supplyPlenum, supplySlot, filters, profile } = layout;
  if (!supplyPlenum || !supplySlot) return null;

  const island = filters.some((f) => f.kind === 'front' || f.kind === 'back');
  const yR = supplyPlenum.frontRise;
  const zF = dims.d / 2;
  const plenum = supplyPlenum.depth;

  const slitN = Math.max(1, supplySlot.frontCount);
  const gapMm = BUILD.supplySlot.gap;
  const slitW =
    Math.min(
      BUILD.supplySlot.panelW,
      (dims.w - 80 - Math.max(0, slitN - 1) * gapMm) / slitN,
    ) * MM;
  const slitD = Math.min(plenum * 0.45, 48) * MM;
  const slitT = 5 * MM;
  const gap = gapMm * MM;
  const span = slitN <= 1 ? 0 : (slitN - 1) * (slitW + gap);

  const type2 = profile === 'trapezoid';
  const type1 = profile === 'triangle';
  const ch = type2
    ? (island ? islandSupplyType2Chamfer(dims.h, dims.d, plenum) : supplyType2Chamfer(dims.h, dims.d, plenum))
    : null;

  if (island) {
    const zP = zF - plenum;
    const panelW = BUILD.supplySlot.panelW * MM;
    const panelH = BUILD.supplySlot.panelH * MM;
    const panelT = Math.max(BUILD.supplySlot.t, 7) * MM;
    const n = Math.max(1, supplySlot.frontCount);
    const gapU = BUILD.supplySlot.gap * MM;
    const spanU = n <= 1 ? 0 : (n - 1) * (panelW + gapU);

    if (type1) {
      /*
       * ТИП 1: решётки в отверстиях нижней горизонтальной плоскости короба.
       * Плоскость панели // полу (ламели горизонтально), выпуск вниз.
       */
      const yFloor = islandSupplyType1Seam(dims.h, dims.d, plenum).ySeam;
      const zMid = (zF + zP) / 2;
      const openD = Math.min(plenum * 0.62, 78) * MM;
      const thick = Math.max(BUILD.supplySlot.t, 6) * MM;
      const louverN = BUILD.supplySlot.louvers;
      const louverT = 1.2 * MM;

      return (
        <group>
          {([1, -1] as const).map((sign) => (
            <group key={sign}>
              {Array.from({ length: n }, (_, i) => {
                const x = n === 1 ? 0 : -spanU / 2 + i * (panelW + gapU);
                return (
                  <group
                    key={i}
                    position={[x, yFloor * MM - thick / 2, sign * zMid * MM]}
                  >
                    {/* Рамка отверстия в полу короба */}
                    <mesh material={dark}>
                      <boxGeometry args={[panelW, thick, openD]} />
                    </mesh>
                    {/* Ламели — параллельно полу, вдоль W */}
                    {Array.from({ length: louverN }, (_, L) => {
                      const zL = (-0.5 + (L + 0.5) / louverN) * (openD - 4 * MM);
                      return (
                        <mesh
                          key={L}
                          material={mat}
                          position={[0, -thick * 0.15, zL]}
                        >
                          <boxGeometry args={[panelW * 0.92, louverT, openD * 0.08]} />
                        </mesh>
                      );
                    })}
                  </group>
                );
              })}
            </group>
          ))}
        </group>
      );
    }

    /*
     * ТИП 2: щелевые решётки // полу у самого низа вертикали бортика.
     * В натуре — вырезы в плоскости, куда сажают решётки; для 3D хватает рамки.
     */
    if (type2 && ch) {
      const yV = ch.vertDy;
      const zMid = (zF + zP) / 2;
      const openD = Math.min(plenum * 0.62, 72) * MM;
      const thick = Math.max(BUILD.supplySlot.t, 6) * MM;
      const louverN = BUILD.supplySlot.louvers;
      const louverT = 1.2 * MM;
      /* Верх рамки чуть выше пола полости, целиком в пределах бортика */
      const yG = Math.min(yV - 2, Math.max(thick / MM + 2, 8));

      return (
        <group>
          {([1, -1] as const).map((sign) => (
            <group key={sign}>
              {Array.from({ length: n }, (_, i) => {
                const x = n === 1 ? 0 : -spanU / 2 + i * (panelW + gapU);
                return (
                  <group
                    key={i}
                    position={[x, yG * MM - thick / 2, sign * zMid * MM]}
                  >
                    {/* Рамка в горизонтальной плоскости (// полу) */}
                    <mesh material={dark}>
                      <boxGeometry args={[panelW, thick, openD]} />
                    </mesh>
                    {Array.from({ length: louverN }, (_, L) => {
                      const zL = (-0.5 + (L + 0.5) / louverN) * (openD - 4 * MM);
                      return (
                        <mesh
                          key={L}
                          material={mat}
                          position={[0, -thick * 0.15, zL]}
                        >
                          <boxGeometry args={[panelW * 0.9, louverT, openD * 0.1]} />
                        </mesh>
                      );
                    })}
                  </group>
                );
              })}
            </group>
          ))}
        </group>
      );
    }

    /*
     * ТИП 3: щелевые решётки // полу у низа прямоугольной полости
     * (как вырезы в плоскости; для 3D — рамка с ламелями).
     */
    {
      const zMid = (zF + zP) / 2;
      const openD = Math.min(plenum * 0.62, 72) * MM;
      const thick = Math.max(BUILD.supplySlot.t, 6) * MM;
      const louverN = BUILD.supplySlot.louvers;
      const louverT = 1.2 * MM;
      const yG = Math.max(thick / MM + 2, 8);

      return (
        <group>
          {([1, -1] as const).map((sign) => (
            <group key={sign}>
              {Array.from({ length: n }, (_, i) => {
                const x = n === 1 ? 0 : -spanU / 2 + i * (panelW + gapU);
                return (
                  <group
                    key={i}
                    position={[x, yG * MM - thick / 2, sign * zMid * MM]}
                  >
                    <mesh material={dark}>
                      <boxGeometry args={[panelW, thick, openD]} />
                    </mesh>
                    {Array.from({ length: louverN }, (_, L) => {
                      const zL = (-0.5 + (L + 0.5) / louverN) * (openD - 4 * MM);
                      return (
                        <mesh
                          key={L}
                          material={mat}
                          position={[0, -thick * 0.15, zL]}
                        >
                          <boxGeometry args={[panelW * 0.9, louverT, openD * 0.1]} />
                        </mesh>
                      );
                    })}
                  </group>
                );
              })}
            </group>
          ))}
        </group>
      );
    }
  }

  /*
   * ЗПВП: щели на переднем фронте (изнутри), не на крышке:
   * ТИП 2 — короткая вертикаль; ТИП 1 — над скосом низа; ТИП 3 — у низа фронта.
   */
  const zSlit = zF - slitD / (2 * MM) - 6;
  const ySlit =
    type2 && ch
      ? Math.max(10, Math.min(ch.vertDy * 0.4, ch.vertDy - 8))
      : type1
        ? yR + 12
        : 12;

  return (
    <group>
      {Array.from({ length: slitN }, (_, i) => {
        const x = slitN === 1 ? 0 : -span / 2 + i * (slitW + gap);
        return (
          <mesh key={i} material={dark} position={[x, ySlit * MM, zSlit * MM]}>
            <boxGeometry args={[slitW, slitT, slitD]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Габарит изделия в мировой СК (низ жёлоба → верх патрубка/подвесов). */
function hoodExtents(dims: Dims, hasHangers: boolean) {
  const topMm = dims.h + Math.max(BUILD.spigot, hasHangers ? BUILD.hanger.len : 0);
  return {
    yMin: -4 * MM,
    yMax: topMm * MM,
    halfW: (dims.w / 2 + BUILD.lip) * MM,
    halfD: (dims.d / 2 + BUILD.lip) * MM,
    span: Math.max(dims.w, dims.d, topMm) * MM,
  };
}

const VIEW_DIR = new THREE.Vector3(0.52, 0.48, 0.72).normalize();

/**
 * Кадр от верхней точки модели. Снизу — орбитой мыши (maxPolar ≈ π).
 */
function CameraRig({
  dims,
  hasHangers,
  userMoved,
}: {
  dims: Dims;
  hasHangers: boolean;
  userMoved: MutableRefObject<boolean>;
}) {
  const { camera, controls, size } = useThree();
  const lastSpan = useRef(0);

  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    const ext = hoodExtents(dims, hasHangers);
    const orbit = controls as {
      target: THREE.Vector3;
      update: () => void;
      minDistance: number;
      maxDistance: number;
    } | null;

    perspective.aspect = size.width / Math.max(size.height, 1);
    perspective.updateProjectionMatrix();

    const vFov = perspective.fov * DEG;
    const tanV = Math.tan(vFov / 2);
    const hFov = 2 * Math.atan(tanV * perspective.aspect);
    const tanH = Math.tan(hFov / 2);

    const topInset = 0.08;
    const bottomInset = 0.1;
    const sideInset = 0.08;

    const boxH = ext.yMax - ext.yMin;
    const boxHoriz = Math.max(ext.halfW, ext.halfD) * 2 * 1.2;

    let dist = boxH / ((1 - topInset - bottomInset) * 2 * tanV);
    dist = Math.max(dist, boxHoriz / ((1 - 2 * sideInset) * 2 * tanH));
    dist *= 1.06;

    const applyTopFit = () => {
      for (let i = 0; i < 4; i++) {
        const halfV = tanV * dist;
        const targetY = ext.yMax - (1 - 2 * topInset) * halfV;
        const ndcBottom = (ext.yMin - targetY) / halfV;
        const minNdc = -1 + 2 * bottomInset;
        if (ndcBottom >= minNdc - 0.02) {
          if (orbit) {
            orbit.target.set(0, targetY, 0);
            perspective.position.copy(orbit.target).addScaledVector(VIEW_DIR, dist);
            orbit.update();
          } else {
            const target = new THREE.Vector3(0, targetY, 0);
            perspective.position.copy(target).addScaledVector(VIEW_DIR, dist);
            perspective.lookAt(target);
          }
          return dist;
        }
        const usable = 1 - 2 * topInset - minNdc;
        dist = Math.max(dist * 1.04, boxH / (usable * 2 * tanV));
      }
      const halfV = tanV * dist;
      const targetY = ext.yMax - (1 - 2 * topInset) * halfV;
      if (orbit) {
        orbit.target.set(0, targetY, 0);
        perspective.position.copy(orbit.target).addScaledVector(VIEW_DIR, dist);
        orbit.update();
      }
      return dist;
    };

    let usedDist = dist;
    if (!userMoved.current || lastSpan.current === 0) {
      usedDist = applyTopFit();
    } else if (orbit && lastSpan.current > 0) {
      const ratio = ext.span / lastSpan.current;
      if (Number.isFinite(ratio) && Math.abs(ratio - 1) > 0.002) {
        const t = orbit.target;
        const offset = perspective.position.clone().sub(t).multiplyScalar(ratio);
        perspective.position.copy(t.clone().add(offset));
        usedDist = offset.length();
        orbit.update();
      } else {
        usedDist = perspective.position.distanceTo(orbit.target);
      }
    }

    lastSpan.current = ext.span;
    if (orbit) {
      orbit.minDistance = Math.max(0.2, usedDist * 0.35);
      orbit.maxDistance = Math.max(usedDist * 3.5, 6);
    }
    perspective.near = 0.05;
    perspective.far = Math.max(usedDist * 12, ext.span * 20);
    perspective.updateProjectionMatrix();
  }, [camera, controls, size.width, size.height, dims.w, dims.d, dims.h, hasHangers, userMoved]);

  return null;
}

/* ------------------------------------------------------------------ */
/* Сборка изделия                                                      */
/* ------------------------------------------------------------------ */

interface HoodProps {
  layout: Layout;
  mode: ViewMode;
  material: '430' | '304';
}

function Hood({ layout, mode, material }: HoodProps) {
  const mats = useMaterials(mode, material);
  const explodeTarget = mode === 'explode' ? 1 : 0;
  const t = useRef(0);

  const topRef = useRef<THREE.Group>(null);
  const filtersRef = useRef<THREE.Group>(null);
  const hydroRef = useRef<THREE.Group>(null);
  const gutterRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    t.current += (explodeTarget - t.current) * Math.min(1, delta * 5);
    const k = t.current;
    const h = layout.dims.h * MM;
    /* Разнос только по вертикали — компоновка узлов как в рентгене */
    if (topRef.current) topRef.current.position.y = k * h * 0.55;
    if (hydroRef.current) hydroRef.current.position.y = k * h * 0.28;
    if (gutterRef.current) gutterRef.current.position.y = -k * h * 0.4;
    if (filtersRef.current) filtersRef.current.position.y = k * h * 0.12;
  });

  /* Пристенный ЗПВП: разворачиваем к ракурсу схемы — высокая вытяжка слева, приток справа */
  const wallSupply =
    !!layout.supplyPlenum && !layout.filters.some((f) => f.kind === 'front' || f.kind === 'back');

  return (
    <group rotation={[0, wallSupply ? Math.PI : 0, 0]}>
      <Corpus layout={layout} mat={mats.corpus} />

      <group ref={topRef}>
        <TopPlate layout={layout} mat={mats.steel} dark={mats.dark} />
        <Hangers layout={layout} mat={mats.dark} length={BUILD.hanger.len} />
      </group>

      <group ref={hydroRef}>
        <HydroLoop layout={layout} mat={mats.dark} water={mats.water} />
        <SupplyChamber layout={layout} mat={mats.steel} dark={mats.dark} />
      </group>

      <group ref={filtersRef}>
        <Filters layout={layout} mat={mats.filter} />
      </group>

      <group ref={gutterRef}>
        <Gutter layout={layout} mat={mats.steel} />
        <Lamps layout={layout} mat={mats.lamp} body={mats.dark} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Публичный компонент сцены                                           */
/* ------------------------------------------------------------------ */

export interface HoodSceneProps {
  dims: Dims;
  traits: FamilyTraits;
  ducts: DuctPick;
  mode: ViewMode;
  material: '430' | '304';
  lamps: boolean;
  /** Подпись типа из каталога («ТИП 1»…) — меняет профиль корпуса. */
  typeLabel?: string | null;
}

export function HoodScene({ dims, traits, ducts, mode, material, lamps, typeLabel }: HoodSceneProps) {
  const layout = useMemo(
    () => buildLayout(dims, traits, ducts, { lamps, typeLabel }),
    [dims, traits, ducts, lamps, typeLabel],
  );

  /* Пользователь сдвинул/приблизил сцену — не затираем ракурс при смене мм */
  const userMoved = useRef(false);
  const hasHangers = layout.hangers.length > 0;

  const radius = Math.max(dims.w, dims.d) * MM;
  const camera = useMemo(
    () => ({ position: [2.2, 2.0, 2.9] as [number, number, number], fov: 32 }),
    [],
  );

  return (
    <Canvas
      camera={camera}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ background: 'transparent' }}
    >
      <StudioEnvironment />
      <CameraRig dims={dims} hasHangers={hasHangers} userMoved={userMoved} />
      <hemisphereLight args={['#efe6dc', '#1a1612', 0.72]} />
      <directionalLight position={[3, 5, 2]} intensity={1.12} color="#fff4e8" />
      <directionalLight position={[-4, 2, -3]} intensity={0.48} color="#c4a890" />
      {/* Свет снизу — нутро видно при взгляде орбитой снизу */}
      <directionalLight position={[0, -4, 1]} intensity={0.55} color="#fff4e8" />

      {/* Низ модели у y≈0 — вертикаль кадра считает CameraRig от верхней точки */}
      <group position={[0, 0, 0]}>
        <Hood layout={layout} mode={mode} material={material} />
        <ContactShadows
          position={[0, -0.02, 0]}
          opacity={0.45}
          scale={radius * 6}
          blur={2.4}
          far={2}
          color="#000000"
        />
      </group>

      <OrbitControls
        makeDefault
        enablePan
        screenSpacePanning
        panSpeed={0.85}
        /* Можно зайти снизу и смотреть вверх внутрь короба */
        minPolarAngle={0.08}
        maxPolarAngle={Math.PI - 0.08}
        minDistance={radius * 0.7 + 0.5}
        maxDistance={radius * 10 + 5}
        enableDamping
        dampingFactor={0.08}
        onStart={() => {
          userMoved.current = true;
        }}
      />
    </Canvas>
  );
}
