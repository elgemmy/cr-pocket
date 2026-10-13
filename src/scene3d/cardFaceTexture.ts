/**
 * Stylized card faces painted on a canvas — no external images.
 *
 * The real card art CDN (api-assets.clashroyale.com) does NOT send CORS
 * headers (verified 2026-10-13: no `access-control-allow-origin` on GET/HEAD),
 * so WebGL cannot upload those images as textures. Instead we draw playful
 * gradient/emblem faces in the app's gold/violet palette. Imported only by the
 * lazy 3D chunk — never in the entry bundle.
 */
import * as THREE from 'three';

export interface CardFacePalette {
  /** Top of the face gradient. */
  light: string;
  /** Bottom of the face gradient. */
  dark: string;
  /** Rim / emissive accent. */
  accent: string;
  /** Emblem shape painted in the center. */
  emblem: 'crown' | 'swords' | 'droplet' | 'sparkle' | 'shield' | 'flame';
}

/** Gold/violet-led palette (matches the design tokens). */
export const FACE_PALETTES: CardFacePalette[] = [
  { light: '#ffd873', dark: '#c78a12', accent: '#ffedb0', emblem: 'crown' },
  { light: '#8f7bff', dark: '#382aa0', accent: '#c9c0ff', emblem: 'swords' },
  { light: '#f8b8f2', dark: '#a0219b', accent: '#ffd7fb', emblem: 'droplet' },
  { light: '#5fe3c6', dark: '#146b5c', accent: '#b8fff0', emblem: 'sparkle' },
  { light: '#6b76b8', dark: '#232a66', accent: '#b9c0e8', emblem: 'shield' },
  { light: '#ffc45e', dark: '#9a5a08', accent: '#ffe3ad', emblem: 'flame' },
];

const W = 256;
const H = 304; // ~300/358 card aspect; even dims keep mip-less NPOT sampling clean

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawEmblem(ctx: CanvasRenderingContext2D, kind: CardFacePalette['emblem'], cx: number, cy: number, s: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.beginPath();
  switch (kind) {
    case 'crown':
      ctx.moveTo(-0.5, 0.32);
      ctx.lineTo(-0.5, -0.05);
      ctx.lineTo(-0.25, 0.1);
      ctx.lineTo(0, -0.32);
      ctx.lineTo(0.25, 0.1);
      ctx.lineTo(0.5, -0.05);
      ctx.lineTo(0.5, 0.32);
      ctx.closePath();
      break;
    case 'swords':
      // two crossed blades
      ctx.moveTo(-0.42, -0.42);
      ctx.lineTo(-0.28, -0.5);
      ctx.lineTo(0.42, 0.28);
      ctx.lineTo(0.28, 0.42);
      ctx.closePath();
      ctx.moveTo(0.42, -0.42);
      ctx.lineTo(0.28, -0.5);
      ctx.lineTo(-0.42, 0.28);
      ctx.lineTo(-0.28, 0.42);
      ctx.closePath();
      break;
    case 'droplet':
      ctx.moveTo(0, -0.48);
      ctx.bezierCurveTo(0.4, -0.02, 0.42, 0.12, 0.42, 0.22);
      ctx.bezierCurveTo(0.42, 0.48, 0.22, 0.52, 0, 0.52);
      ctx.bezierCurveTo(-0.22, 0.52, -0.42, 0.48, -0.42, 0.22);
      ctx.bezierCurveTo(-0.42, 0.12, -0.4, -0.02, 0, -0.48);
      break;
    case 'sparkle':
      ctx.moveTo(0, -0.5);
      ctx.quadraticCurveTo(0.08, -0.08, 0.5, 0);
      ctx.quadraticCurveTo(0.08, 0.08, 0, 0.5);
      ctx.quadraticCurveTo(-0.08, 0.08, -0.5, 0);
      ctx.quadraticCurveTo(-0.08, -0.08, 0, -0.5);
      break;
    case 'shield':
      ctx.moveTo(0, -0.46);
      ctx.lineTo(0.42, -0.3);
      ctx.bezierCurveTo(0.42, 0.18, 0.24, 0.42, 0, 0.52);
      ctx.bezierCurveTo(-0.24, 0.42, -0.42, 0.18, -0.42, -0.3);
      ctx.closePath();
      break;
    case 'flame':
      ctx.moveTo(0, -0.5);
      ctx.bezierCurveTo(0.34, -0.14, 0.42, 0.04, 0.34, 0.26);
      ctx.bezierCurveTo(0.26, 0.48, 0.08, 0.52, 0, 0.52);
      ctx.bezierCurveTo(-0.2, 0.52, -0.38, 0.38, -0.36, 0.12);
      ctx.bezierCurveTo(-0.35, -0.04, -0.22, -0.14, -0.16, -0.28);
      ctx.bezierCurveTo(-0.1, -0.16, -0.02, -0.14, 0, -0.5);
      break;
  }
  ctx.fill();
  ctx.restore();
}

/** Paint one stylized card face onto a fresh canvas. */
export function paintCardFace(palette: CardFacePalette): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Face gradient
  const face = ctx.createLinearGradient(0, 0, W * 0.35, H);
  face.addColorStop(0, palette.light);
  face.addColorStop(1, palette.dark);
  roundedRectPath(ctx, 0, 0, W, H, 34);
  ctx.fillStyle = face;
  ctx.fill();

  // Dark inner panel (like a card frame)
  roundedRectPath(ctx, 14, 14, W - 28, H - 28, 26);
  const inner = ctx.createLinearGradient(0, 14, 0, H - 14);
  inner.addColorStop(0, 'rgba(13, 16, 48, 0.72)');
  inner.addColorStop(1, 'rgba(10, 13, 38, 0.86)');
  ctx.fillStyle = inner;
  ctx.fill();

  // Diagonal sheen
  ctx.save();
  roundedRectPath(ctx, 14, 14, W - 28, H - 28, 26);
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, 0, W, H * 0.7);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
  sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0.02)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  // Soft glow behind the emblem
  const glow = ctx.createRadialGradient(W / 2, H * 0.42, 8, W / 2, H * 0.42, 96);
  glow.addColorStop(0, `${palette.accent}59`); // ~0.35 alpha
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Emblem
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = 22;
  ctx.fillStyle = palette.accent;
  drawEmblem(ctx, palette.emblem, W / 2, H * 0.42, 88);
  ctx.shadowBlur = 0;

  // Placeholder "label" bars (abstract, like the CSS CardStackHero)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  roundedRectPath(ctx, W / 2 - 52, H * 0.68, 104, 13, 6.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  roundedRectPath(ctx, W / 2 - 34, H * 0.68 + 24, 68, 13, 6.5);
  ctx.fill();

  // Inner highlight stroke
  roundedRectPath(ctx, 15, 15, W - 30, H - 30, 25);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();

  return canvas;
}

const textureCache = new Map<CardFacePalette, THREE.CanvasTexture>();

/** CanvasTexture for a palette, cached per palette (shared across meshes). */
export function cardFaceTexture(palette: CardFacePalette): THREE.CanvasTexture {
  const cached = textureCache.get(palette);
  if (cached) return cached;
  const tex = new THREE.CanvasTexture(paintCardFace(palette));
  tex.colorSpace = THREE.SRGBColorSpace;
  // NPOT mipmaps corrupt on some software GL stacks (SwiftShader); the cards
  // render near 1:1 so linear minification is plenty.
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  textureCache.set(palette, tex);
  return tex;
}

/** Dispose every cached face texture (call on scene unmount). */
export function disposeCardFaceTextures(): void {
  for (const tex of textureCache.values()) tex.dispose();
  textureCache.clear();
}
