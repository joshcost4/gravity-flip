import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";

// ─── Game constants ───────────────────────────────────────────────────────────
const GW = 800;
const GH = 450;
const FLOOR = GH - 62;
const CEIL = 62;
const CHAR_X = 120;
const CHAR_W = 26;
const CHAR_H = 26;
const BASE_SPD = 3.2;
const GRAVITY = 0.5;
const MAX_VY = 11;
const FLIP_VEL = 9.2;

type Screen = "menu" | "playing" | "paused" | "gameover" | "shop" | "scores" | "settings" | "about";

const STORAGE_KEY = "gravity-flip-progress-v1";

interface PersistedProgress {
  highScore: number;
  totalGems: number;
  lastScore: number;
  lastGems: number;
  scoreHistory: number[];
  ownedChars: number[];
  equippedChar: number;
  showHint: boolean;
  motionEnabled: boolean;
  sfxEnabled: boolean;
  sfxVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
}

const DEFAULT_PROGRESS: PersistedProgress = {
  highScore: 0,
  totalGems: 0,
  lastScore: 0,
  lastGems: 0,
  scoreHistory: [],
  ownedChars: [0],
  equippedChar: 0,
  showHint: true,
  motionEnabled: true,
  sfxEnabled: true,
  sfxVolume: 82,
  musicEnabled: true,
  musicVolume: 50,
};

function readProgress(): PersistedProgress {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<PersistedProgress>;
    return {
      highScore: Number(parsed.highScore) || 0,
      totalGems: Number(parsed.totalGems) || 0,
      lastScore: Number(parsed.lastScore) || 0,
      lastGems: Number(parsed.lastGems) || 0,
      scoreHistory: Array.isArray(parsed.scoreHistory)
        ? parsed.scoreHistory
            .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
            .slice(0, 20)
            .map(value => Math.max(0, Math.floor(value)))
        : [],
      ownedChars: Array.isArray(parsed.ownedChars)
        ? parsed.ownedChars.filter((value): value is number => Number.isInteger(value) && value >= 0)
        : [0],
      equippedChar: Number(parsed.equippedChar) || 0,
      showHint: typeof parsed.showHint === "boolean" ? parsed.showHint : true,
      motionEnabled: typeof parsed.motionEnabled === "boolean" ? parsed.motionEnabled : true,
      sfxEnabled: typeof parsed.sfxEnabled === "boolean" ? parsed.sfxEnabled : true,
      sfxVolume: typeof parsed.sfxVolume === "number" ? Math.max(0, Math.min(100, parsed.sfxVolume)) : 82,
      musicEnabled: typeof parsed.musicEnabled === "boolean" ? parsed.musicEnabled : true,
      musicVolume: typeof parsed.musicVolume === "number" ? Math.max(0, Math.min(100, parsed.musicVolume)) : 50,
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function writeProgress(progress: PersistedProgress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

interface WorldTheme {
  id: number;
  name: string;
  label: string;
  threshold: number;
  bgTop: string;
  bgBottom: string;
  glow: string;
  groundTop: string;
  groundBottom: string;
  ceilingTop: string;
  ceilingBottom: string;
  grid: string;
  accent: string;
  accentSoft: string;
  starA: string;
  starB: string;
  starC: string;
  obstacle: string;
  obstacleAlt: string;
  particle: string;
}

const WORLD_THEMES: WorldTheme[] = [
  {
    id: 0,
    name: "NEON CITY",
    label: "CITY",
    threshold: 0,
    bgTop: "#04060f",
    bgBottom: "#0b1540",
    glow: "rgba(0,229,255,0.15)",
    groundTop: "#0f1d48",
    groundBottom: "#060b1d",
    ceilingTop: "#060b1d",
    ceilingBottom: "#0f1d48",
    grid: "rgba(0,229,255,0.08)",
    accent: "#00e5ff",
    accentSoft: "#4cc7ff",
    starA: "#4a6080",
    starB: "#90b8e0",
    starC: "#c8e6ff",
    obstacle: "#cc1020",
    obstacleAlt: "#ff4050",
    particle: "#00e5ff",
  },
  {
    id: 1,
    name: "AURORA RIDGE",
    label: "AURORA",
    threshold: 500,
    bgTop: "#07111d",
    bgBottom: "#112d3e",
    glow: "rgba(74,255,192,0.16)",
    groundTop: "#1b3d3f",
    groundBottom: "#0f2326",
    ceilingTop: "#0f2326",
    ceilingBottom: "#1b3d3f",
    grid: "rgba(74,255,192,0.08)",
    accent: "#4affc0",
    accentSoft: "#8bf8d0",
    starA: "#46696b",
    starB: "#82c7b0",
    starC: "#dbfff0",
    obstacle: "#2f7a54",
    obstacleAlt: "#6be59a",
    particle: "#4affc0",
  },
  {
    id: 2,
    name: "MIDNIGHT GRID",
    label: "MIDNIGHT",
    threshold: 1000,
    bgTop: "#060512",
    bgBottom: "#1b1238",
    glow: "rgba(155,92,255,0.16)",
    groundTop: "#241a4b",
    groundBottom: "#0d0a20",
    ceilingTop: "#0d0a20",
    ceilingBottom: "#241a4b",
    grid: "rgba(155,92,255,0.08)",
    accent: "#9b5cff",
    accentSoft: "#bc8bff",
    starA: "#3d335a",
    starB: "#6d5aa8",
    starC: "#f0e3ff",
    obstacle: "#8b1ebf",
    obstacleAlt: "#cf7bff",
    particle: "#b67eff",
  },
  {
    id: 3,
    name: "SOLAR SPARK",
    label: "SOLAR",
    threshold: 1500,
    bgTop: "#13080b",
    bgBottom: "#2f1320",
    glow: "rgba(255,177,68,0.2)",
    groundTop: "#46222c",
    groundBottom: "#17090d",
    ceilingTop: "#17090d",
    ceilingBottom: "#46222c",
    grid: "rgba(255,177,68,0.08)",
    accent: "#ffb04a",
    accentSoft: "#ffd28a",
    starA: "#5f3d41",
    starB: "#a55b3f",
    starC: "#ffe7c2",
    obstacle: "#b84f20",
    obstacleAlt: "#ff9456",
    particle: "#ffd28a",
  },
  {
    id: 4,
    name: "VOID RIFT",
    label: "VOID",
    threshold: 2000,
    bgTop: "#05030d",
    bgBottom: "#1c1036",
    glow: "rgba(130,92,255,0.2)",
    groundTop: "#2a214f",
    groundBottom: "#080512",
    ceilingTop: "#080512",
    ceilingBottom: "#2a214f",
    grid: "rgba(130,92,255,0.08)",
    accent: "#8a62ff",
    accentSoft: "#b194ff",
    starA: "#3d3658",
    starB: "#6a5fa9",
    starC: "#efe4ff",
    obstacle: "#4f28a1",
    obstacleAlt: "#8d5cff",
    particle: "#b194ff",
  },
  {
    id: 5,
    name: "COSMIC STORM",
    label: "COSMOS",
    threshold: 2500,
    bgTop: "#080310",
    bgBottom: "#28103a",
    glow: "rgba(255,140,48,0.2)",
    groundTop: "#39204d",
    groundBottom: "#12081f",
    ceilingTop: "#12081f",
    ceilingBottom: "#39204d",
    grid: "rgba(255,140,48,0.08)",
    accent: "#ff8c30",
    accentSoft: "#ffb36b",
    starA: "#4b395b",
    starB: "#8e5f8e",
    starC: "#ffe3b2",
    obstacle: "#b34700",
    obstacleAlt: "#ff9d40",
    particle: "#ffb36b",
  },
  {
    id: 6,
    name: "ECLIPSE CORE",
    label: "ECLIPSE",
    threshold: 3000,
    bgTop: "#04050d",
    bgBottom: "#131a33",
    glow: "rgba(255,81,167,0.18)",
    groundTop: "#242c56",
    groundBottom: "#090d1a",
    ceilingTop: "#090d1a",
    ceilingBottom: "#242c56",
    grid: "rgba(255,81,167,0.08)",
    accent: "#ff4fa5",
    accentSoft: "#ff9aca",
    starA: "#434f69",
    starB: "#7f6aa6",
    starC: "#ffe2f3",
    obstacle: "#a11d69",
    obstacleAlt: "#ff6dc5",
    particle: "#ff9aca",
  },
];

function getWorldForScore(score: number): WorldTheme {
  return WORLD_THEMES.reduce((current, theme) => (score >= theme.threshold ? theme : current), WORLD_THEMES[0]);
}

function getNextWorldThreshold(score: number): number {
  const next = WORLD_THEMES.find(theme => score < theme.threshold);
  return next ? next.threshold : 0;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Obs {
  x: number;
  y: number;
  w: number;
  h: number;
  type: "fs" | "cs" | "mb";
  vy: number;
}
interface GemObj {
  x: number;
  y: number;
  done: boolean;
  pulse: number;
}
interface Ptcl {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  life0: number;
  r: number;
  col: string;
}
interface BGStar {
  x: number;
  y: number;
  spd: number;
  op: number;
  r: number;
  layer: number;
}

interface GS {
  cy: number;
  cvy: number;
  gd: number; // 1=down, -1=up
  rot: number;
  obs: Obs[];
  gems: GemObj[];
  ptcls: Ptcl[];
  stars: BGStar[];
  score: number;
  gc: number;
  spd: number;
  frame: number;
  alive: boolean;
  nextObs: number;
  nextGem: number;
  shake: number;
  flipCD: number;
  charId: number;
}

// ─── State factory ────────────────────────────────────────────────────────────
function mkStars(): BGStar[] {
  return Array.from({ length: 120 }, () => {
    const layer = Math.floor(Math.random() * 3);
    return {
      x: Math.random() * GW,
      y: Math.random() * GH,
      spd: [0.12, 0.4, 1.1][layer],
      op: [0.2, 0.45, 0.7][layer],
      r: [0.4, 0.9, 1.6][layer],
      layer,
    };
  });
}

function mkGS(charId = 0): GS {
  return {
    cy: FLOOR - CHAR_H,
    cvy: 0,
    gd: 1,
    rot: 0,
    obs: [],
    gems: [],
    ptcls: [],
    stars: mkStars(),
    score: 0,
    gc: 0,
    spd: BASE_SPD,
    frame: 0,
    alive: true,
    nextObs: 95,
    nextGem: 60,
    shake: 0,
    flipCD: 0,
    charId,
  };
}

// ─── Obstacle spawn ───────────────────────────────────────────────────────────
function spawnObs(gs: GS): Obs {
  const t = gs.frame;
  const pool: Obs["type"][] = ["fs"];
  if (t > 480) pool.push("cs");
  if (t > 1400) pool.push("mb");
  const type = pool[Math.floor(Math.random() * pool.length)] as Obs["type"];

  if (type === "fs") {
    const h = 28 + Math.random() * 48;
    const w = 16 + Math.random() * 30;
    return { x: GW + 20, y: FLOOR - h, w, h, type, vy: 0 };
  } else if (type === "cs") {
    const h = 28 + Math.random() * 48;
    const w = 16 + Math.random() * 30;
    return { x: GW + 20, y: CEIL, w, h, type, vy: 0 };
  } else {
    const h = 55 + Math.random() * 75;
    const w = 22 + Math.random() * 18;
    const y = CEIL + 22 + Math.random() * (FLOOR - CEIL - h - 44);
    return { x: GW + 20, y, w, h, type, vy: 1.1 + Math.random() * 0.9 };
  }
}

function aabb(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  const m = 5;
  return ax + m < bx + bw && ax + aw - m > bx && ay + m < by + bh && ay + ah - m > by;
}

function getCharBonus(charId: number) {
  switch (charId) {
    case 1:
      return { gravity: 0.92, flipVel: 1.0, speed: 0.05, trail: 1.04 };
    case 2:
      return { gravity: 1.0, flipVel: 1.02, speed: 0.08, trail: 1.08 };
    case 3:
      return { gravity: 0.86, flipVel: 1.04, speed: 0.05, trail: 1.1 };
    case 4:
      return { gravity: 0.9, flipVel: 1.08, speed: 0.04, trail: 1.12 };
    case 5:
      return { gravity: 1.02, flipVel: 1.12, speed: 0.06, trail: 1.16 };
    case 6:
      return { gravity: 0.95, flipVel: 1.06, speed: 0.09, trail: 1.12 };
    case 7:
      return { gravity: 1.04, flipVel: 1.14, speed: 0.07, trail: 1.2 };
    case 8:
      return { gravity: 0.88, flipVel: 1.03, speed: 0.1, trail: 1.14 };
    case 9:
      return { gravity: 0.98, flipVel: 1.16, speed: 0.08, trail: 1.18 };
    case 10:
      return { gravity: 0.94, flipVel: 1.02, speed: 0.04, trail: 1.06 };
    case 11:
      return { gravity: 0.97, flipVel: 1.05, speed: 0.05, trail: 1.08 };
    case 12:
      return { gravity: 0.9, flipVel: 1.08, speed: 0.06, trail: 1.12 };
    case 13:
      return { gravity: 1.01, flipVel: 1.07, speed: 0.07, trail: 1.14 };
    case 14:
      return { gravity: 0.89, flipVel: 1.1, speed: 0.08, trail: 1.16 };
    case 15:
      return { gravity: 0.96, flipVel: 1.03, speed: 0.05, trail: 1.1 };
    case 16:
      return { gravity: 0.91, flipVel: 1.04, speed: 0.06, trail: 1.12 };
    case 17:
      return { gravity: 0.97, flipVel: 1.08, speed: 0.07, trail: 1.15 };
    default:
      return { gravity: 1, flipVel: 1, speed: 0, trail: 1 };
  }
}

// ─── Game step ────────────────────────────────────────────────────────────────
function stepGame(gs: GS): "gem" | null {
  if (!gs.alive) return null;
  gs.frame++;
  gs.score = Math.floor(gs.frame / 5);
  const bonus = getCharBonus(gs.charId);
  const world = getWorldForScore(gs.score);
  gs.spd = BASE_SPD + gs.frame * 0.00135 + Math.floor(gs.score / 500) * 0.12 + world.id * 0.035 + bonus.speed;
  if (gs.flipCD > 0) gs.flipCD--;
  if (gs.shake > 0) gs.shake--;

  // Physics
  gs.cvy += GRAVITY * gs.gd * bonus.gravity;
  gs.cvy = Math.max(-MAX_VY, Math.min(MAX_VY, gs.cvy));
  gs.cy += gs.cvy;
  gs.rot = (gs.rot + gs.gd * 2.8) % 360;

  if (gs.gd === 1 && gs.cy + CHAR_H >= FLOOR) {
    gs.cy = FLOOR - CHAR_H;
    gs.cvy = 0;
  }
  if (gs.gd === -1 && gs.cy <= CEIL) {
    gs.cy = CEIL;
    gs.cvy = 0;
  }

  // Stars
  const sr = gs.spd / BASE_SPD;
  for (const s of gs.stars) {
    s.x -= s.spd * sr;
    if (s.x < 0) {
      s.x = GW + 2;
      s.y = Math.random() * GH;
    }
  }

  // Obstacles
  gs.nextObs--;
  if (gs.nextObs <= 0) {
    gs.obs.push(spawnObs(gs));
    const extraChance = 0.16 + world.id * 0.08 + Math.floor(gs.score / 500) * 0.03;
    if (Math.random() < Math.min(0.7, extraChance)) {
      gs.obs.push(spawnObs(gs));
    }
    gs.nextObs = Math.max(36, 142 - gs.frame * 0.045 - world.id * 7 - Math.floor(gs.score / 500) * 4) + Math.random() * 42;
  }
  for (const o of gs.obs) {
    o.x -= gs.spd;
    if (o.type === "mb") {
      o.y += o.vy;
      if (o.y <= CEIL + 8 || o.y + o.h >= FLOOR - 8) o.vy *= -1;
    }
  }
  gs.obs = gs.obs.filter(o => o.x + o.w > -5);

  // Gems
  gs.nextGem--;
  if (gs.nextGem <= 0) {
    gs.gems.push({
      x: GW + 10,
      y: CEIL + 28 + Math.random() * (FLOOR - CEIL - 56),
      done: false,
      pulse: Math.random() * Math.PI * 2,
    });
    gs.nextGem = 42 + Math.random() * 78;
  }
  for (const g of gs.gems) {
    g.x -= gs.spd;
    g.pulse += 0.11;
  }
  gs.gems = gs.gems.filter(g => g.x > -20 && !g.done);

  // Trail particles
  if (gs.frame % 3 === 0) {
    gs.ptcls.push({
      x: CHAR_X + CHAR_W / 2 - 4,
      y: gs.cy + CHAR_H / 2 + (Math.random() - 0.5) * 4,
      vx: -1.8 - Math.random() * 2,
      vy: (Math.random() - 0.5) * 1.2,
      life: 18 + Math.random() * 12,
      life0: 30,
      r: 1.8 + Math.random() * 2.2 * bonus.trail,
      col: CHARS[gs.charId]?.col ?? "#00e5ff",
    });
  }

  // Update particles
  for (const p of gs.ptcls) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.04 * gs.gd;
    p.life--;
  }
  gs.ptcls = gs.ptcls.filter(p => p.life > 0);

  // Collision — obstacles
  for (const o of gs.obs) {
    if (aabb(CHAR_X, gs.cy, CHAR_W, CHAR_H, o.x, o.y, o.w, o.h)) {
      gs.alive = false;
      gs.shake = 20;
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 2.5 + Math.random() * 7;
        gs.ptcls.push({
          x: CHAR_X + CHAR_W / 2,
          y: gs.cy + CHAR_H / 2,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 35 + Math.random() * 22,
          life0: 57,
          r: 2.5 + Math.random() * 4,
          col: "#ff3040",
        });
      }
      return null;
    }
  }

  // Collision — gems
  for (const g of gs.gems) {
    if (!g.done) {
      const dx = g.x - (CHAR_X + CHAR_W / 2);
      const dy = g.y - (gs.cy + CHAR_H / 2);
      if (dx * dx + dy * dy < CHAR_W * CHAR_W * 1.3) {
        g.done = true;
        gs.gc++;
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 0.8 + Math.random() * 3.5;
          gs.ptcls.push({
            x: g.x,
            y: g.y,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            life: 16 + Math.random() * 14,
            life0: 30,
            r: 1.2 + Math.random() * 2.5,
            col: "#00e5ff",
          });
        }
        return "gem";
      }
    }
  }
  return null;
}

function drawCharacterShape(
  ctx: CanvasRenderingContext2D,
  charId: number,
  col: string,
  w: number,
  h: number,
  rot: number,
  frame: number,
  accentColor: string
) {
  const half = w / 2;

  ctx.save();
  ctx.rotate((rot * Math.PI) / 180);

  ctx.shadowColor = col;
  ctx.shadowBlur = 24;

  if (charId === 0) {
    // Cube
    ctx.fillStyle = col;
    ctx.fillRect(-half, -half, w, h);
    ctx.fillStyle = accentColor;
    ctx.fillRect(-half, -half, w, h * 0.48);
  } else if (charId === 1) {
    // Ball
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(-4, -4, half * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (charId === 2) {
    // Bot
    ctx.fillStyle = col;
    ctx.fillRect(-half + 2, -half + 2, w - 4, h - 4);
    ctx.fillStyle = "#04060f";
    ctx.fillRect(-half + 8, -half + 8, w - 16, h - 16);
    ctx.fillStyle = col;
    ctx.fillRect(-3, -half - 7, 6, 8);
    ctx.fillRect(-3, -half + 2, 6, 3);
  } else if (charId === 3) {
    // UFO
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -half - 2);
    ctx.quadraticCurveTo(half + 8, -2, 0, half + 4);
    ctx.quadraticCurveTo(-half - 8, -2, 0, -half - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(4,6,15,0.78)";
    ctx.fillRect(-half + 6, -half + 6, w - 12, h - 12);
    ctx.fillStyle = col;
    ctx.fillRect(-half + 10, -half + 8, w - 20, h - 16);
  } else if (charId === 4) {
    // Bird
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -half - 2);
    ctx.lineTo(half + 2, 6);
    ctx.lineTo(-half - 2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.moveTo(-2, -half + 2);
    ctx.lineTo(6, 4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
  } else if (charId === 5) {
    // Prism
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -half - 2);
    ctx.lineTo(half + 4, 0);
    ctx.lineTo(0, half + 2);
    ctx.lineTo(-half - 4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(-5, -4, 10, 8);
  } else if (charId === 6) {
    // Jet
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-half + 2, -4);
    ctx.lineTo(half - 2, -4);
    ctx.lineTo(half - 8, 0);
    ctx.lineTo(half - 2, 4);
    ctx.lineTo(-half + 2, 4);
    ctx.closePath();
    ctx.fill();
  } else if (charId === 7) {
    // Star
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -half - 4);
    ctx.lineTo(6, -8);
    ctx.lineTo(half + 2, -4);
    ctx.lineTo(10, 2);
    ctx.lineTo(4, half + 2);
    ctx.lineTo(0, 10);
    ctx.lineTo(-4, half + 2);
    ctx.lineTo(-10, 2);
    ctx.lineTo(-half - 2, -4);
    ctx.lineTo(-6, -8);
    ctx.closePath();
    ctx.fill();
  } else if (charId === 8) {
    // Drone
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#04060f";
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.fillRect(-half - 3, -2, 4, 4);
    ctx.fillRect(half - 1, -2, 4, 4);
    ctx.fillRect(-half - 2, -5, 2, 3);
    ctx.fillRect(half, -5, 2, 3);
  } else if (charId === 9) {
    // Rune
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const x = Math.cos(angle) * half;
      const y = Math.sin(angle) * half;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#04060f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-half * 0.5, 0);
    ctx.lineTo(half * 0.5, 0);
    ctx.moveTo(0, -half * 0.5);
    ctx.lineTo(0, half * 0.5);
    ctx.stroke();
  } else if (charId === 10) {
    // Hex
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.lineTo(Math.cos(angle) * half, Math.sin(angle) * half);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#04060f";
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.lineTo(Math.cos(angle) * half * 0.5, Math.sin(angle) * half * 0.5);
    }
    ctx.closePath();
    ctx.fill();
  } else if (charId === 11) {
    // Pulse
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.45 * (0.6 + Math.sin(frame * 0.15) * 0.4), 0, Math.PI * 2);
    ctx.fill();
  } else if (charId === 12) {
    // Mirror
    ctx.fillStyle = col;
    ctx.fillRect(-half, -half, w, h);
    ctx.fillStyle = "#04060f";
    ctx.beginPath();
    ctx.moveTo(-half, -half);
    ctx.lineTo(half, half);
    ctx.lineTo(-half, half);
    ctx.closePath();
    ctx.fill();
  } else if (charId === 13) {
    // Rocket
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-half, -half + 3);
    ctx.lineTo(half - 4, -half + 3);
    ctx.quadraticCurveTo(half + 4, 0, half - 4, half - 3);
    ctx.lineTo(-half, half - 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff4000";
    ctx.fillRect(-half - 4, -4, 4, 8);
  } else if (charId === 14) {
    // Comet
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(-2, 0, half * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff8c30";
    ctx.beginPath();
    ctx.moveTo(-half * 0.4, -half * 0.6);
    ctx.lineTo(-half - 6, 0);
    ctx.lineTo(-half * 0.4, half * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (charId === 15) {
    // Spark
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-2, -half - 2);
    ctx.lineTo(half + 2, -2);
    ctx.lineTo(-2, 0);
    ctx.lineTo(half, half + 2);
    ctx.lineTo(-half - 2, 2);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
  } else if (charId === 16) {
    // Halo
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.9, 0, Math.PI * 2);
    ctx.stroke();
  } else if (charId === 17) {
    // Wave
    ctx.fillStyle = col;
    ctx.fillRect(-half, -half, w, h);
    ctx.strokeStyle = "#04060f";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = -half; x <= half; x += 2) {
      const y = Math.sin((x * 0.25) + (frame * 0.15)) * (half * 0.5);
      if (x === -half) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    // Catch-all
    ctx.fillStyle = col;
    ctx.fillRect(-half, -half, w, h);
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-3, -half + 4, 3, 3);
  ctx.fillRect(1, -half + 4, 3, 3);
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fillRect(-half, -half, half * 0.55, half * 0.55);

  ctx.restore();
}

// ─── Canvas draw ──────────────────────────────────────────────────────────────
function drawGame(ctx: CanvasRenderingContext2D, gs: GS): void {
  const shx = gs.shake > 0 ? (Math.random() - 0.5) * 7 : 0;
  const shy = gs.shake > 0 ? (Math.random() - 0.5) * 5 : 0;
  const world = getWorldForScore(gs.score);
  const pulse = 0.5 + Math.sin(gs.frame * 0.04) * 0.12;

  ctx.save();
  ctx.translate(shx, shy);

  const bg = ctx.createLinearGradient(0, 0, 0, GH);
  bg.addColorStop(0, world.bgTop);
  bg.addColorStop(1, world.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(-15, -15, GW + 30, GH + 30);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = world.glow;
  ctx.beginPath();
  ctx.arc(GW * 0.8, GH * 0.22, 180 + pulse * 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  for (const s of gs.stars) {
    ctx.globalAlpha = s.op;
    ctx.fillStyle = s.layer === 2 ? world.starC : s.layer === 1 ? world.starB : world.starA;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.025;
  ctx.fillStyle = "#000";
  for (let y = 0; y < GH; y += 4) {
    ctx.fillRect(0, y, GW, 2);
  }
  ctx.globalAlpha = 1;

  const fg = ctx.createLinearGradient(0, FLOOR, 0, GH);
  fg.addColorStop(0, world.groundTop);
  fg.addColorStop(1, world.groundBottom);
  ctx.fillStyle = fg;
  ctx.fillRect(0, FLOOR, GW, GH - FLOOR);

  const cg = ctx.createLinearGradient(0, 0, 0, CEIL);
  cg.addColorStop(0, world.ceilingTop);
  cg.addColorStop(1, world.ceilingBottom);
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, GW, CEIL);

  ctx.strokeStyle = world.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x < GW; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, FLOOR);
    ctx.lineTo(x, GH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CEIL);
    ctx.stroke();
  }

  ctx.shadowColor = world.accent;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = world.accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR);
  ctx.lineTo(GW, FLOOR);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, CEIL);
  ctx.lineTo(GW, CEIL);
  ctx.stroke();
  ctx.shadowBlur = 0;

  for (const p of gs.ptcls) {
    const a = p.life / p.life0;
    ctx.globalAlpha = a;
    ctx.shadowColor = p.col;
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  for (const g of gs.gems) {
    if (g.done) continue;
    const pulse = 0.65 + Math.sin(g.pulse) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.shadowColor = world.accent;
    ctx.shadowBlur = 20;
    ctx.fillStyle = world.accent;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y - 9);
    ctx.lineTo(g.x + 6.5, g.y);
    ctx.lineTo(g.x, g.y + 9);
    ctx.lineTo(g.x - 6.5, g.y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = pulse * 0.45;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(g.x, g.y - 5);
    ctx.lineTo(g.x + 3.5, g.y - 0.5);
    ctx.lineTo(g.x, g.y + 2.5);
    ctx.lineTo(g.x - 3.5, g.y - 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  for (const o of gs.obs) {
    ctx.shadowColor = world.accent;
    ctx.shadowBlur = 18;

    if (o.type === "fs") {
      ctx.fillStyle = world.obstacle;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y);
      ctx.lineTo(o.x + o.w, o.y + o.h);
      ctx.lineTo(o.x, o.y + o.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = world.obstacleAlt;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w * 0.38, o.y + o.h * 0.28);
      ctx.lineTo(o.x + o.w * 0.5, o.y + o.h * 0.06);
      ctx.lineTo(o.x + o.w * 0.56, o.y + o.h * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (o.type === "cs") {
      ctx.fillStyle = world.obstacle;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y + o.h);
      ctx.lineTo(o.x + o.w, o.y);
      ctx.lineTo(o.x, o.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = world.obstacleAlt;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w * 0.38, o.y + o.h * 0.72);
      ctx.lineTo(o.x + o.w * 0.5, o.y + o.h * 0.94);
      ctx.lineTo(o.x + o.w * 0.56, o.y + o.h * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = world.obstacle;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = world.obstacleAlt;
      ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, o.h * 0.35);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = world.accentSoft;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(o.x, o.y, o.w, o.h);
    }
    ctx.shadowBlur = 0;
  }

  if (gs.alive) {
    const cx = CHAR_X + CHAR_W / 2;
    const cy = gs.cy + CHAR_H / 2;
    const char = CHARS[gs.charId] ?? CHARS[0];

    ctx.save();
    ctx.translate(cx, cy);
    drawCharacterShape(ctx, gs.charId, char.col, CHAR_W, CHAR_H, gs.rot, gs.frame, world.accent);
    ctx.restore();
  }

  ctx.restore();
}

// ─── Shop characters ──────────────────────────────────────────────────────────
const CHARS = [
  { name: "CUBE", price: 0, col: "#00e5ff", icon: "■", perk: "Balanced handling with a crisp neon trail.", rarity: "Starter", description: "The reliable default rig for clean flips and steady control." },
  { name: "BALL", price: 140, col: "#ff2d78", icon: "●", perk: "Smoother arcs and a stylish bounce aura.", rarity: "Popular", description: "A rounded powerhouse that feels lighter and more fluid in motion." },
  { name: "BOT", price: 220, col: "#ffd700", icon: "⬡", perk: "Sharper stability and brighter particle bursts.", rarity: "Elite", description: "A high-tech shell built for precision and dramatic trails." },
  { name: "UFO", price: 320, col: "#9b5cff", icon: "◈", perk: "Hovering drift and a luminous glow for every flip.", rarity: "Rare", description: "A sleek alien craft that turns every jump into a cinematic glide." },
  { name: "BIRD", price: 180, col: "#00ff88", icon: "▲", perk: "Fast reactions and a lightweight silhouette.", rarity: "Special", description: "A nimble flyer with a playful edge and high-energy flair." },
  { name: "PRISM", price: 420, col: "#ff8c30", icon: "◆", perk: "Maximum style with a dazzling crystal shimmer.", rarity: "Legend", description: "The ultimate showpiece for players chasing prestige and spectacle." },
  { name: "JET", price: 460, col: "#ff5f7e", icon: "↗", perk: "Faster flips and a snappy boost on every launch.", rarity: "Epic", description: "A razor-edged jet shell that turns every gravity switch into a burst of speed." },
  { name: "STAR", price: 500, col: "#ffe66d", icon: "✦", perk: "Bright star trails and zero hesitation in midair.", rarity: "Epic", description: "A heavenly frame built for flashy runs and dramatic comebacks." },
  { name: "DRONE", price: 560, col: "#43d9ff", icon: "⟡", perk: "Extra float and a calm, precise control profile.", rarity: "Mythic", description: "An autonomous drone shell that glides smoothly through chaos." },
  { name: "RUNE", price: 620, col: "#ff7bff", icon: "☼", perk: "Ultra-reactive movement with a radiant aura.", rarity: "Mythic", description: "A mystical rune core reserved for players who love high-risk, high-reward runs." },
  { name: "HEX", price: 90, col: "#6ee7ff", icon: "⬢", perk: "Quick turns and a crisp, geometric trail.", rarity: "Budget", description: "A compact shell that feels snappy and easy to master." },
  { name: "PULSE", price: 110, col: "#7cff77", icon: "◌", perk: "Bright pulses and a lighter, springier feel.", rarity: "Budget", description: "A cheerful little frame with strong rhythm and easy momentum." },
  { name: "MIRROR", price: 160, col: "#ff7cc8", icon: "◫", perk: "Sharper visual feedback and a smoother glide.", rarity: "Rare", description: "A reflective shell that rewards clean timing and stylish flips." },
  { name: "ROCKET", price: 240, col: "#ff6b4a", icon: "⤴", perk: "Faster launches and a burstier feel on every jump.", rarity: "Special", description: "A compact rocket shell built for quick, punchy runs." },
  { name: "COMET", price: 130, col: "#ff9b4a", icon: "☄", perk: "A blazing tail that makes every flip pop.", rarity: "Budget", description: "A fast comet shell that feels bright and breezy in motion." },
  { name: "SPARK", price: 170, col: "#ffe66d", icon: "⚡", perk: "Crackling energy with extra sparkle in the air.", rarity: "Special", description: "A bright spark rig that crackles with fresh style and flair." },
  { name: "HALO", price: 200, col: "#8d7cff", icon: "◎", perk: "A calm glow and a softer landing on every turn.", rarity: "Rare", description: "A halo shell that turns each move into a polished, graceful arc." },
  { name: "WAVE", price: 250, col: "#45d5ff", icon: "≈", perk: "Smooth flow and a flowing trail during rapid flips.", rarity: "Special", description: "A wave-shaped shell built for smooth, stylish rhythm." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const orb = { fontFamily: "'Orbitron', sans-serif" };
const raj = { fontFamily: "'Rajdhani', sans-serif" };

function NeonBtn({
  children,
  onClick,
  size = "md",
  danger = false,
  ghost = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  danger?: boolean;
  ghost?: boolean;
  disabled?: boolean;
}) {
  const col = danger ? "#ff3040" : "#00e5ff";
  const pad = size === "lg" ? "18px 64px" : size === "sm" ? "9px 20px" : "13px 32px";
  const fs = size === "lg" ? "20px" : size === "sm" ? "10px" : "13px";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...orb,
        padding: pad,
        fontSize: fs,
        letterSpacing: "0.16em",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        border: ghost ? `1px solid ${disabled ? "rgba(0,229,255,0.08)" : col + "33"}` : "none",
        background: ghost ? "transparent" : disabled ? "rgba(0,229,255,0.08)" : col,
        color: ghost ? (disabled ? "#2a3a55" : col) : disabled ? "#2a3a55" : "#04060f",
        clipPath: ghost ? "none" : "polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)",
        boxShadow: ghost || disabled ? "none" : `0 0 28px ${col}55, 0 0 56px ${col}22`,
        transition: "all 0.14s ease",
      }}
    >
      {children}
    </button>
  );
}

// ─── Screens ──────────────────────────────────────────────────────────────────
function MenuScreen({
  highScore,
  totalGems,
  gamesPlayed,
  sfxEnabled,
  onPlay,
  onShop,
  onScores,
  onSettings,
  onAbout,
}: {
  highScore: number;
  totalGems: number;
  gamesPlayed: number;
  sfxEnabled: boolean;
  onPlay: () => void;
  onShop: () => void;
  onScores: () => void;
  onSettings: () => void;
  onAbout: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 flex flex-col items-center justify-center"
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 700px 500px at 50% 55%, rgba(0,229,255,0.045) 0%, transparent 70%)",
        }}
      />

      {/* Top stat bar */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-6 pt-5">
        <div style={{ ...raj, color: "#4a6080", fontSize: "13px", letterSpacing: "0.05em" }}>
          <span style={{ color: "#ffd700" }}>★</span> BEST{" "}
          <span style={{ color: "#c8e6ff", marginLeft: "4px" }}>{highScore}</span>
        </div>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <div style={{ ...raj, color: "#4a6080", fontSize: "13px" }}>
            <span style={{ color: "#00e5ff" }}>◆</span>{" "}
            <span style={{ color: "#c8e6ff" }}>{totalGems.toLocaleString()}</span>
          </div>
          <div style={{ ...raj, color: "#4a6080", fontSize: "13px" }}>
            <span style={{ color: "#8bf1ff" }}>⟡</span>{" "}
            <span style={{ color: "#c8e6ff" }}>{gamesPlayed}</span>
          </div>
          <div style={{ ...raj, color: "#4a6080", fontSize: "13px" }}>
            <span style={{ color: sfxEnabled ? "#ff98ff" : "#4a6080" }}>♪</span>{" "}
            <span style={{ color: "#c8e6ff" }}>{sfxEnabled ? "SFX" : "SFX OFF"}</span>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="mb-12 text-center select-none">
        <div
          style={{
            ...orb,
            fontSize: "clamp(40px, 9vw, 78px)",
            fontWeight: 900,
            color: "#00e5ff",
            letterSpacing: "0.06em",
            textShadow: "0 0 30px rgba(0,229,255,0.65), 0 0 70px rgba(0,229,255,0.22)",
            lineHeight: 1,
          }}
        >
          GRAVITY
        </div>
        <div
          style={{
            ...orb,
            fontSize: "clamp(30px, 6.5vw, 62px)",
            fontWeight: 400,
            color: "#c8e6ff",
            letterSpacing: "0.28em",
            textShadow: "0 0 20px rgba(200,230,255,0.28)",
            lineHeight: 1,
            marginTop: "6px",
          }}
        >
          FLIP
        </div>
        <div className="flex items-center gap-3 mt-5 justify-center">
          <div style={{ height: "1px", width: "56px", background: "linear-gradient(to left, rgba(0,229,255,0.45), transparent)" }} />
          <div style={{ ...orb, color: "#00e5ff", fontSize: "8px", letterSpacing: "0.32em", opacity: 0.7 }}>ONE TAP ARCADE</div>
          <div style={{ height: "1px", width: "56px", background: "linear-gradient(to right, rgba(0,229,255,0.45), transparent)" }} />
        </div>
      </div>

      {/* Play button */}
      <div className="mb-10">
        <NeonBtn size="lg" onClick={onPlay}>
          PLAY
        </NeonBtn>
      </div>

      {/* Nav row */}
      <div className="flex flex-wrap justify-center gap-3">
        {[
          { label: "SHOP", icon: "◆", fn: onShop },
          { label: "SCORES", icon: "★", fn: onScores },
          { label: "SETTINGS", icon: "⚙", fn: onSettings },
          { label: "ABOUT", icon: "ℹ", fn: onAbout },
        ].map(item => (
          <button
            key={item.label}
            onClick={item.fn}
            style={{
              ...orb,
              padding: "10px 18px",
              fontSize: "10px",
              letterSpacing: "0.14em",
              background: "rgba(8,14,33,0.85)",
              border: "1px solid rgba(0,229,255,0.14)",
              color: "#4a6080",
              cursor: "pointer",
              transition: "all 0.14s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = "#00e5ff";
              e.currentTarget.style.borderColor = "rgba(0,229,255,0.38)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = "#4a6080";
              e.currentTarget.style.borderColor = "rgba(0,229,255,0.14)";
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Hint */}
      <div className="absolute bottom-6" style={{ ...raj, color: "#1e2e48", fontSize: "12px", letterSpacing: "0.12em" }}>
        SPACE / TAP TO FLIP GRAVITY
      </div>
    </motion.div>
  );
}

function PauseOverlay({
  onResume,
  onRestart,
  onHome,
  onSettings,
}: {
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(4,6,15,0.72)", backdropFilter: "blur(3px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        style={{
          background: "#080e21",
          border: "1px solid rgba(0,229,255,0.18)",
          padding: "40px 56px",
          textAlign: "center",
          minWidth: "280px",
          boxShadow: "0 0 60px rgba(0,229,255,0.08)",
        }}
      >
        <div style={{ ...orb, fontSize: "22px", fontWeight: 700, color: "#00e5ff", letterSpacing: "0.22em", marginBottom: "32px" }}>PAUSE</div>
        <div className="flex flex-col gap-2">
          {[{ label: "RESUME", fn: onResume, ghost: false }, { label: "SETTINGS", fn: onSettings, ghost: true }, { label: "RESTART", fn: onRestart, ghost: true }, { label: "MENU", fn: onHome, ghost: true }].map(btn => (
            <div key={btn.label} style={{ width: "100%" }}>
              <button
                onClick={btn.fn}
                style={{
                  ...orb,
                  display: "block",
                  width: "100%",
                  padding: "13px",
                  fontSize: "13px",
                  letterSpacing: "0.16em",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.14s",
                  background: btn.ghost ? "transparent" : "#00e5ff",
                  color: btn.ghost ? "#4a6080" : "#04060f",
                  border: btn.ghost ? "1px solid rgba(0,229,255,0.14)" : "none",
                  boxShadow: btn.ghost ? "none" : "0 0 24px rgba(0,229,255,0.4)",
                }}
                onMouseEnter={e => {
                  if (btn.ghost) e.currentTarget.style.color = "#00e5ff";
                }}
                onMouseLeave={e => {
                  if (btn.ghost) e.currentTarget.style.color = "#4a6080";
                }}
              >
                {btn.label}
              </button>
            </div>
          ))}
        </div>
        <div style={{ ...raj, color: "#2a3a55", fontSize: "11px", letterSpacing: "0.1em", marginTop: "20px" }}>ESC to toggle</div>
      </motion.div>
    </div>
  );
}

function GameOverScreen({
  score,
  best,
  gems,
  onPlay,
  onHome,
  onShop,
}: {
  score: number;
  best: number;
  gems: number;
  onPlay: () => void;
  onHome: () => void;
  onShop: () => void;
}) {
  const isNew = score > 0 && score >= best;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(4,6,15,0.92)" }}>
      <div style={{ textAlign: "center", maxWidth: "340px", width: "100%", padding: "0 24px" }}>
        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <div style={{ ...orb, fontSize: "40px", fontWeight: 900, color: "#ff3040", letterSpacing: "0.1em", lineHeight: 1, textShadow: "0 0 36px rgba(255,48,64,0.55)" }}>
            GAME
          </div>
          <div style={{ ...orb, fontSize: "40px", fontWeight: 900, color: "#ff3040", letterSpacing: "0.1em", lineHeight: 1, textShadow: "0 0 36px rgba(255,48,64,0.55)", marginBottom: "28px" }}>
            OVER
          </div>
        </motion.div>

        {isNew && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} style={{ ...orb, fontSize: "10px", color: "#ffd700", letterSpacing: "0.3em", marginBottom: "14px", textShadow: "0 0 20px rgba(255,215,0,0.6)" }}>
            ★ NEW HIGH SCORE ★
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "rgba(0,229,255,0.08)", marginBottom: "1px" }}>
            {[{ label: "SCORE", value: score }, { label: "BEST", value: best }].map(s => (
              <div key={s.label} style={{ background: "#080e21", padding: "18px 12px" }}>
                <div style={{ ...orb, color: "#4a6080", fontSize: "9px", letterSpacing: "0.22em", marginBottom: "8px" }}>{s.label}</div>
                <div style={{ ...orb, color: "#c8e6ff", fontSize: "28px", fontWeight: 700, lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#080e21", padding: "16px", marginBottom: "28px" }}>
            <div style={{ ...orb, color: "#4a6080", fontSize: "9px", letterSpacing: "0.22em", marginBottom: "8px" }}>GEMS EARNED</div>
            <div style={{ ...orb, color: "#00e5ff", fontSize: "24px", fontWeight: 700, textShadow: "0 0 16px rgba(0,229,255,0.45)" }}>◆ {gems}</div>
          </div>
        </motion.div>

        <motion.div className="flex flex-col gap-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <button onClick={onPlay} style={{ ...orb, display: "block", width: "100%", padding: "17px", background: "#00e5ff", color: "#04060f", fontSize: "17px", fontWeight: 700, letterSpacing: "0.15em", border: "none", cursor: "pointer", clipPath: "polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)", boxShadow: "0 0 32px rgba(0,229,255,0.45)" }}>
            PLAY AGAIN
          </button>
          <div className="flex gap-2">
            {[{ label: "HOME", fn: onHome }, { label: "SHOP", fn: onShop }].map(b => (
              <button key={b.label} onClick={b.fn} style={{ ...orb, flex: 1, padding: "12px", background: "transparent", border: "1px solid rgba(0,229,255,0.13)", color: "#4a6080", fontSize: "11px", letterSpacing: "0.14em", cursor: "pointer", transition: "all 0.14s" }} onMouseEnter={e => {
                e.currentTarget.style.color = "#00e5ff";
                e.currentTarget.style.borderColor = "rgba(0,229,255,0.35)";
              }} onMouseLeave={e => {
                e.currentTarget.style.color = "#4a6080";
                e.currentTarget.style.borderColor = "rgba(0,229,255,0.13)";
              }}>
                {b.label}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function CharacterPreview({ index, active }: { index: number; active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ch = CHARS[index];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 72, 72);
    ctx.save();
    ctx.translate(36, 36);
    drawCharacterShape(ctx, index, ch.col, 26, 26, 0, 0, ch.col);
    ctx.restore();
  }, [index, ch]);

  return (
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: index === 1 ? "50%" : index === 2 ? "16px" : index === 3 ? "50% 50% 40% 40%" : index === 4 ? "20px 20px 34px 34px" : index === 5 ? "6px" : "10px",
        background: active ? "rgba(0, 229, 255, 0.1)" : "rgba(255, 255, 255, 0.03)",
        border: active ? `2px solid ${ch.col}` : "2px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <canvas ref={canvasRef} width={72} height={72} />
    </div>
  );
}

function MiniCharacterPreview({ index, frame }: { index: number; frame: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ch = CHARS[index];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 80, 80);
    ctx.save();
    ctx.translate(40, 40);
    drawCharacterShape(ctx, index, ch.col, 30, 30, frame * 2.2, frame, ch.col);
    ctx.restore();
  }, [index, ch, frame]);

  return <canvas ref={canvasRef} width={80} height={80} style={{ filter: "drop-shadow(0 0 10px rgba(0,229,255,0.15))" }} />;
}

function MiniGridPreview({ index, col }: { index: number; col: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, 48, 48);
    ctx.save();
    ctx.translate(24, 24);
    drawCharacterShape(ctx, index, col, 22, 22, -15, 0, col);
    ctx.restore();
  }, [index, col]);

  return <canvas ref={canvasRef} width={48} height={48} />;
}

function ShopScreen({
  totalGems,
  owned,
  equipped,
  onEquip,
  onBuy,
  onBack,
}: {
  totalGems: number;
  owned: Set<number>;
  equipped: number;
  onEquip: (i: number) => void;
  onBuy: (i: number) => void;
  onBack: () => void;
}) {
  const [sel, setSel] = useState(0);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let animId = 0;
    const loop = () => {
      setFrame(f => f + 1);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const ch = CHARS[sel];
  const isOwned = owned.has(sel);
  const isEquipped = equipped === sel;
  const canAfford = totalGems >= ch.price;
  const bonus = getCharBonus(sel);

  const rarityColors: Record<string, string> = {
    Starter: "#4a6080",
    Budget: "#7f8c8d",
    Popular: "#ff2d78",
    Elite: "#ffd700",
    Special: "#00ff88",
    Rare: "#9b5cff",
    Legend: "#ff8c30",
    Epic: "#ff3040",
    Mythic: "#ff7bff",
  };
  const rarityCol = rarityColors[ch.rarity] || "#00e5ff";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col justify-between p-6"
      style={{ background: "rgba(4,6,15,0.92)", backdropFilter: "blur(3px)" }}
    >
      <div className="flex justify-between items-center mb-4">
        <div style={{ ...orb, fontSize: "20px", fontWeight: 700, color: "#00e5ff", letterSpacing: "0.18em" }}>
          CYBER SHOP
        </div>
        <div style={{ ...raj, color: "#4a6080", fontSize: "14px" }}>
          TOTAL GEMS: <span style={{ color: "#ffd700", fontWeight: 700 }}>◆ {totalGems.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-0 overflow-hidden mb-4">
        {/* Left Column: Specs & Mini-canvas Preview */}
        <div
          className="flex flex-col items-center justify-between p-5"
          style={{
            flex: "0 0 250px",
            background: "#080e21",
            border: "1px solid rgba(0,229,255,0.14)",
            borderRadius: "8px",
            overflowY: "auto",
          }}
        >
          <div className="flex flex-col items-center w-full">
            <span
              style={{
                ...orb,
                fontSize: "9px",
                fontWeight: 700,
                color: rarityCol,
                border: `1px solid ${rarityCol}33`,
                padding: "3px 8px",
                borderRadius: "999px",
                letterSpacing: "0.15em",
                marginBottom: "12px",
              }}
            >
              {ch.rarity.toUpperCase()}
            </span>

            <div
              style={{
                width: 90,
                height: 90,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(4,6,15,0.5)",
                border: "1px solid rgba(0,229,255,0.08)",
                borderRadius: "50%",
                boxShadow: `0 0 20px ${ch.col}1a`,
                marginBottom: "12px",
              }}
            >
              <MiniCharacterPreview index={sel} frame={frame} />
            </div>

            <div style={{ ...orb, fontSize: "18px", fontWeight: 700, color: "#c8e6ff", letterSpacing: "0.08em", marginBottom: "4px" }}>
              {ch.name}
            </div>
            
            <div style={{ ...raj, fontSize: "12px", color: "#4a6080", textAlign: "center", marginBottom: "12px", lineHeight: "1.3" }}>
              {ch.description}
            </div>

            <div style={{ height: "1px", width: "80%", background: "rgba(0,229,255,0.08)", marginBottom: "12px" }} />

            <div className="w-full flex flex-col gap-2">
              <div style={{ ...orb, fontSize: "9px", color: "#4a6080", letterSpacing: "0.15em" }}>STAT MODIFIERS</div>
              
              {[
                { label: "SPEED BOOST", val: bonus.speed, max: 0.15, text: `+${Math.round(bonus.speed * 100)}%` },
                { label: "GRAVITY COEFFICIENT", val: 1 - bonus.gravity, max: 0.2, text: bonus.gravity < 1 ? `-${Math.round((1 - bonus.gravity) * 100)}% (Float)` : `${Math.round(bonus.gravity * 100)}%` },
                { label: "FLIP ACCEL Force", val: bonus.flipVel - 1, max: 0.2, text: `+${Math.round((bonus.flipVel - 1) * 100)}%` },
                { label: "TRAIL PARTICLES", val: bonus.trail - 1, max: 0.3, text: `+${Math.round((bonus.trail - 1) * 100)}%` },
              ].map(stat => (
                <div key={stat.label}>
                  <div className="flex justify-between" style={{ ...raj, fontSize: "11px", color: "#6f86a8", marginBottom: "2px" }}>
                    <span>{stat.label}</span>
                    <span style={{ color: "#c8e6ff" }}>{stat.text}</span>
                  </div>
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        background: ch.col,
                        width: `${Math.max(10, Math.min(100, (Math.abs(stat.val) / (stat.max || 1)) * 100))}%`,
                        boxShadow: `0 0 6px ${ch.col}`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full mt-4">
            {isEquipped ? (
              <button
                disabled
                style={{
                  ...orb,
                  width: "100%",
                  padding: "12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  background: "rgba(0,229,255,0.08)",
                  color: "#2a3a55",
                  border: "1px solid rgba(0,229,255,0.08)",
                }}
              >
                EQUIPPED
              </button>
            ) : isOwned ? (
              <button
                onClick={() => onEquip(sel)}
                style={{
                  ...orb,
                  width: "100%",
                  padding: "12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  background: "#00e5ff",
                  color: "#04060f",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 0 16px rgba(0,229,255,0.35)",
                }}
              >
                EQUIP SKIN
              </button>
            ) : (
              <button
                onClick={() => onBuy(sel)}
                disabled={!canAfford}
                style={{
                  ...orb,
                  width: "100%",
                  padding: "12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  background: canAfford ? "#ffd700" : "rgba(255,255,255,0.05)",
                  color: canAfford ? "#04060f" : "#4a6080",
                  border: "none",
                  cursor: canAfford ? "pointer" : "not-allowed",
                  boxShadow: canAfford ? "0 0 16px rgba(255,215,0,0.35)" : "none",
                }}
              >
                BUY FOR ◆ {ch.price}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Character Grid */}
        <div
          className="flex-1 p-4"
          style={{
            background: "#060b1d",
            border: "1px solid rgba(0,229,255,0.08)",
            borderRadius: "8px",
            overflowY: "auto",
          }}
        >
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
            {CHARS.map((char, idx) => {
              const ownedSelf = owned.has(idx);
              const equippedSelf = equipped === idx;
              const selectedSelf = sel === idx;

              return (
                <button
                  key={char.name}
                  onClick={() => setSel(idx)}
                  style={{
                    aspectRatio: "1/1",
                    background: selectedSelf ? "rgba(0,229,255,0.12)" : "rgba(8,14,33,0.65)",
                    border: equippedSelf
                      ? `2px solid ${char.col}`
                      : selectedSelf
                      ? "2px solid #00e5ff"
                      : "2px solid rgba(0,229,255,0.08)",
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    position: "relative",
                    transition: "all 0.1s ease",
                    padding: 0,
                  }}
                >
                  <div style={{ transform: "scale(0.85)" }}>
                    <MiniGridPreview index={idx} col={char.col} />
                  </div>

                  {ownedSelf && (
                    <span
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        fontSize: "8px",
                        color: equippedSelf ? char.col : "#49ffaa",
                        textShadow: "0 0 4px rgba(0,0,0,0.5)",
                      }}
                    >
                      ✓
                    </span>
                  )}

                  {!ownedSelf && (
                    <span
                      style={{
                        ...raj,
                        position: "absolute",
                        bottom: 4,
                        fontSize: "8px",
                        fontWeight: 700,
                        color: "#ffd700",
                        background: "rgba(4,6,15,0.75)",
                        padding: "1px 4px",
                        borderRadius: "2px",
                      }}
                    >
                      ◆{char.price}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <NeonBtn onClick={onBack}>
          BACK
        </NeonBtn>
      </div>
    </motion.div>
  );
}

function ScoresScreen({
  highScore,
  lastScore,
  totalGems,
  gamesPlayed,
  scoreHistory,
  onResetProgress,
  onBack,
}: {
  highScore: number;
  lastScore: number;
  totalGems: number;
  gamesPlayed: number;
  scoreHistory: number[];
  onResetProgress: () => void;
  onBack: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28 }}
      className="absolute inset-0 flex flex-col justify-between p-6"
      style={{ background: "rgba(4,6,15,0.92)", backdropFilter: "blur(3px)" }}
    >
      <div style={{ ...orb, fontSize: "20px", fontWeight: 700, color: "#00e5ff", letterSpacing: "0.18em", marginBottom: "16px" }}>
        ARCADE LEADERBOARD & STATS
      </div>

      <div className="flex flex-1 gap-6 min-h-0 overflow-hidden mb-6">
        {/* Left Side: Stats Summary */}
        <div
          className="flex flex-col justify-between p-5"
          style={{
            flex: "0 0 250px",
            background: "#080e21",
            border: "1px solid rgba(0,229,255,0.14)",
            borderRadius: "8px",
          }}
        >
          <div className="flex flex-col gap-4">
            <div style={{ ...orb, fontSize: "10px", color: "#4a6080", letterSpacing: "0.15em" }}>SUMMARY</div>

            {[
              { label: "PERSONAL BEST", val: highScore, color: "#ffd700" },
              { label: "LAST RUN SCORE", val: lastScore, color: "#00e5ff" },
              { label: "GEMS COLLECTED", val: `◆ ${totalGems.toLocaleString()}`, color: "#ffd28a" },
              { label: "RUNS INITIATED", val: gamesPlayed, color: "#4cc7ff" },
            ].map(item => (
              <div key={item.label} style={{ background: "rgba(4,6,15,0.4)", padding: "12px", borderLeft: `3px solid ${item.color}` }}>
                <div style={{ ...raj, fontSize: "10px", color: "#4a6080", letterSpacing: "0.1em", marginBottom: "4px" }}>{item.label}</div>
                <div style={{ ...orb, fontSize: "20px", fontWeight: 700, color: "#c8e6ff" }}>{item.val}</div>
              </div>
            ))}
          </div>

          <div>
            {confirmReset ? (
              <div className="flex flex-col gap-2">
                <div style={{ ...raj, fontSize: "11px", color: "#ff3040", fontWeight: 500 }}>PERMANENTLY RESET ALL PROGRESS?</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onResetProgress();
                      setConfirmReset(false);
                    }}
                    style={{
                      ...orb,
                      flex: 1,
                      padding: "8px",
                      background: "#ff3040",
                      color: "#ffffff",
                      fontSize: "10px",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    YES
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    style={{
                      ...orb,
                      flex: 1,
                      padding: "8px",
                      background: "rgba(255,255,255,0.1)",
                      color: "#c8e6ff",
                      fontSize: "10px",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    NO
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                style={{
                  ...orb,
                  width: "100%",
                  padding: "10px",
                  background: "transparent",
                  color: "#ff3040",
                  border: "1px solid rgba(255,48,64,0.22)",
                  fontSize: "9px",
                  letterSpacing: "0.1em",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255,48,64,0.1)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                RESET DATA
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Scrollable Run History */}
        <div
          className="flex-1 p-4"
          style={{
            background: "#060b1d",
            border: "1px solid rgba(0,229,255,0.08)",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ ...orb, fontSize: "10px", color: "#4a6080", letterSpacing: "0.15em", marginBottom: "12px" }}>
            RUN LOGS (LAST 20 ATTEMPTS)
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
            {scoreHistory.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center" style={{ ...raj, color: "#4a6080", fontSize: "14px" }}>
                No score records found.<br />Initiate a run to populate this log!
              </div>
            ) : (
              scoreHistory.map((score, index) => {
                const isBest = score === highScore && score > 0;
                return (
                  <div
                    key={index}
                    style={{
                      background: "rgba(8,14,33,0.7)",
                      border: isBest ? "1px solid rgba(255,215,0,0.3)" : "1px solid rgba(0,229,255,0.05)",
                      padding: "10px 18px",
                      borderRadius: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ ...orb, color: "#4a6080", fontSize: "11px" }}>RUN #{scoreHistory.length - index}</span>
                      {isBest && (
                        <span style={{ ...orb, color: "#ffd700", fontSize: "9px", letterSpacing: "0.1em" }}>★ PERSONAL BEST</span>
                      )}
                    </div>
                    <span style={{ ...orb, fontSize: "18px", fontWeight: 700, color: isBest ? "#ffd700" : "#c8e6ff" }}>
                      {score.toString().padStart(4, "0")}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <NeonBtn onClick={onBack}>
          BACK
        </NeonBtn>
      </div>
    </motion.div>
  );
}

function SettingsScreen({
  showHint,
  motionEnabled,
  sfxEnabled,
  sfxVolume,
  musicEnabled,
  musicVolume,
  onToggleHint,
  onToggleMotion,
  onToggleSfx,
  onToggleSfxVolume,
  onToggleMusic,
  onToggleMusicVolume,
  onBack,
}: {
  showHint: boolean;
  motionEnabled: boolean;
  sfxEnabled: boolean;
  sfxVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
  onToggleHint: () => void;
  onToggleMotion: () => void;
  onToggleSfx: () => void;
  onToggleSfxVolume: (value: number) => void;
  onToggleMusic: () => void;
  onToggleMusicVolume: (value: number) => void;
  onBack: () => void;
}) {
  const motionProps = motionEnabled
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.28 },
      }
    : ({
        initial: false,
        animate: false,
        transition: false,
      } as const);

  return (
    <motion.div {...motionProps} className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(4,6,15,0.92)" }}>
      <div style={{ width: "100%", maxWidth: "420px", padding: "24px", textAlign: "center" }}>
        <div style={{ ...orb, fontSize: "20px", fontWeight: 700, color: "#00e5ff", letterSpacing: "0.18em", marginBottom: "18px" }}>SETTINGS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "24px" }}>
          {[
            { label: "Tap Hint", value: showHint, onToggle: onToggleHint },
            { label: "Motion Effects", value: motionEnabled, onToggle: onToggleMotion },
          ].map(item => (
            <div key={item.label} style={{ background: "#080e21", padding: "16px", border: "1px solid rgba(0,229,255,0.12)", borderRadius: "14px", textAlign: "left", gridColumn: "span 2" }}>
              <div style={{ ...raj, color: "#4a6080", fontSize: "9px", letterSpacing: "0.22em", marginBottom: "10px" }}>{item.label.toUpperCase()}</div>
              <button
                onClick={item.onToggle}
                style={{
                  ...orb,
                  padding: "12px 18px",
                  fontSize: "12px",
                  fontWeight: 700,
                  width: "100%",
                  textAlign: "left",
                  background: item.value ? "#00e5ff" : "rgba(255,255,255,0.05)",
                  color: item.value ? "#04060f" : "#4a6080",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: item.value ? "0 0 20px rgba(0,229,255,0.25)" : "none",
                }}
              >
                {item.value ? "ENABLED" : "DISABLED"}
              </button>
            </div>
          ))}

          {/* SFX volume */}
          <div style={{ background: "#080e21", padding: "16px", border: "1px solid rgba(0,229,255,0.12)", borderRadius: "14px", textAlign: "left" }}>
            <div style={{ ...raj, color: "#4a6080", fontSize: "9px", letterSpacing: "0.22em", marginBottom: "10px" }}>SOUND EFFECTS (SFX)</div>
            <button
              onClick={onToggleSfx}
              style={{
                ...orb,
                padding: "12px 14px",
                fontSize: "11px",
                fontWeight: 700,
                width: "100%",
                textAlign: "left",
                background: sfxEnabled ? "#00e5ff" : "rgba(255,255,255,0.05)",
                color: sfxEnabled ? "#04060f" : "#4a6080",
                border: "none",
                cursor: "pointer",
                boxShadow: sfxEnabled ? "0 0 20px rgba(0,229,255,0.25)" : "none",
              }}
            >
              {sfxEnabled ? "ENABLED" : "DISABLED"}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={sfxVolume}
              onChange={e => onToggleSfxVolume(Number((e.target as HTMLInputElement).value))}
              style={{ width: "100%", marginTop: "12px", accentColor: "#00e5ff" }}
            />
            <div style={{ textAlign: "center", color: "#4a6080", fontSize: "11px", marginTop: "8px", ...orb }}>VOL: {sfxVolume}%</div>
          </div>

          {/* Music volume */}
          <div style={{ background: "#080e21", padding: "16px", border: "1px solid rgba(0,229,255,0.12)", borderRadius: "14px", textAlign: "left" }}>
            <div style={{ ...raj, color: "#4a6080", fontSize: "9px", letterSpacing: "0.22em", marginBottom: "10px" }}>BGM SYNTH beats</div>
            <button
              onClick={onToggleMusic}
              style={{
                ...orb,
                padding: "12px 14px",
                fontSize: "11px",
                fontWeight: 700,
                width: "100%",
                textAlign: "left",
                background: musicEnabled ? "#00e5ff" : "rgba(255,255,255,0.05)",
                color: musicEnabled ? "#04060f" : "#4a6080",
                border: "none",
                cursor: "pointer",
                boxShadow: musicEnabled ? "0 0 20px rgba(0,229,255,0.25)" : "none",
              }}
            >
              {musicEnabled ? "ENABLED" : "DISABLED"}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={musicVolume}
              onChange={e => onToggleMusicVolume(Number((e.target as HTMLInputElement).value))}
              style={{ width: "100%", marginTop: "12px", accentColor: "#00e5ff" }}
            />
            <div style={{ textAlign: "center", color: "#4a6080", fontSize: "11px", marginTop: "8px", ...orb }}>VOL: {musicVolume}%</div>
          </div>
        </div>

        <button
          onClick={onBack}
          style={{
            ...orb,
            width: "100%",
            padding: "14px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.16em",
            background: "#00e5ff",
            color: "#04060f",
            border: "none",
            cursor: "pointer",
            clipPath: "polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)",
            boxShadow: "0 0 26px rgba(0,229,255,0.28)",
          }}
        >
          BACK
        </button>
      </div>
    </motion.div>
  );
}

function AboutScreen({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28 }}
      className="absolute inset-0 flex flex-col justify-between p-6"
      style={{ background: "rgba(4,6,15,0.92)", backdropFilter: "blur(3px)" }}
    >
      <div style={{ ...orb, fontSize: "20px", fontWeight: 700, color: "#00e5ff", letterSpacing: "0.18em", marginBottom: "16px" }}>
        ABOUT & SYSTEM SPECS
      </div>

      <div
        className="flex-1 p-5 pr-3 overflow-y-auto mb-6"
        style={{
          background: "#080e21",
          border: "1px solid rgba(0,229,255,0.14)",
          borderRadius: "8px",
          textAlign: "left",
        }}
      >
        <div className="mb-6">
          <div style={{ ...orb, fontSize: "11px", color: "#00e5ff", letterSpacing: "0.12em", marginBottom: "8px" }}>INTERFACE CONTROLS</div>
          <div style={{ ...raj, fontSize: "13px", color: "#6f86a8", lineHeight: "1.6" }}>
            <span style={{ color: "#c8e6ff", fontWeight: 600 }}>[SPACEBAR] / [UP ARROW] / [TAP CANVAS]</span>: Triggers a gravity flip. Instantly reverses your vertical gravity coefficient, sending you flying to the opposite side of the screen.
            <br />
            <span style={{ color: "#c8e6ff", fontWeight: 600 }}>[ESCAPE]</span>: Pauses/Resumes active gameplay.
          </div>
        </div>

        <div className="mb-6">
          <div style={{ ...orb, fontSize: "11px", color: "#00e5ff", letterSpacing: "0.12em", marginBottom: "8px" }}>MECHANICS & PERKS</div>
          <div style={{ ...raj, fontSize: "13px", color: "#6f86a8", lineHeight: "1.6" }}>
            Collect glowing <span style={{ color: "#ffd700", fontWeight: 600 }}>Gems (◆)</span> during runs to unlock rare and legendary character cores in the shop.
            <br />
            Different cores possess distinct engineering stats:
            <ul style={{ listStyleType: "disc", paddingLeft: "20px", marginTop: "4px" }}>
              <li><span style={{ color: "#c8e6ff" }}>Speed Multiplier</span>: Adjusts the forward speed scaling factor.</li>
              <li><span style={{ color: "#c8e6ff" }}>Gravity Coefficient</span>: Lower coefficients yield lighter, floatier drift.</li>
              <li><span style={{ color: "#c8e6ff" }}>Flip Accel Force</span>: Dictates how fast you accelerate during a gravity reversal.</li>
              <li><span style={{ color: "#c8e6ff" }}>Trail Particles</span>: Increases size and lifetime of aesthetic neon exhaust trails.</li>
            </ul>
          </div>
        </div>

        <div className="mb-2">
          <div style={{ ...orb, fontSize: "11px", color: "#00e5ff", letterSpacing: "0.12em", marginBottom: "8px" }}>PROJECT CREDITS</div>
          <div style={{ ...raj, fontSize: "13px", color: "#6f86a8", lineHeight: "1.6" }}>
            Original Concept: Figma Community Design
            <br />
            Arcade UI & Logic Overhaul: Antigravity AI
            <br />
            Co-creator / Lead Architect: <span style={{ color: "#ffd700", fontWeight: 700, textShadow: "0 0 10px rgba(255,215,0,0.3)" }}>Josh C.</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <NeonBtn onClick={onBack}>
          BACK
        </NeonBtn>
      </div>
    </motion.div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────
export default function App() {
  const initialProgress = readProgress();
  const [screen, setScreen] = useState<Screen>("menu");
  const [settingsReturnScreen, setSettingsReturnScreen] = useState<Screen>("menu");
  const [highScore, setHighScore] = useState(initialProgress.highScore);
  const [totalGems, setTotalGems] = useState(initialProgress.totalGems);
  const [lastScore, setLastScore] = useState(initialProgress.lastScore);
  const [lastGems, setLastGems] = useState(initialProgress.lastGems);
  const [scoreHistory, setScoreHistory] = useState<number[]>(initialProgress.scoreHistory);
  const [liveScore, setLiveScore] = useState(0);
  const [liveGems, setLiveGems] = useState(0);
  const [ownedChars, setOwnedChars] = useState(() => new Set(initialProgress.ownedChars));
  const [equippedChar, setEquippedChar] = useState(initialProgress.equippedChar);

  const [showHint, setShowHint] = useState(initialProgress.showHint);
  const [motionEnabled, setMotionEnabled] = useState(initialProgress.motionEnabled);
  const [sfxEnabled, setSfxEnabled] = useState(initialProgress.sfxEnabled);
  const [sfxVolume, setSfxVolume] = useState(initialProgress.sfxVolume);
  const [musicEnabled, setMusicEnabled] = useState(initialProgress.musicEnabled ?? true);
  const [musicVolume, setMusicVolume] = useState(initialProgress.musicVolume ?? 50);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GS>(mkGS());
  const equippedCharRef = useRef(initialProgress.equippedChar);
  const rafRef = useRef<number>(0);
  const screenRef = useRef<Screen>("menu");
  screenRef.current = screen;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicIntervalRef = useRef<number | null>(null);
  const musicOscARef = useRef<OscillatorNode | null>(null);
  const musicOscBRef = useRef<OscillatorNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicFilterRef = useRef<BiquadFilterNode | null>(null);
  const musicLfoRef = useRef<OscillatorNode | null>(null);
  const musicLfoGainRef = useRef<GainNode | null>(null);

  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!AudioCtxClass) return null;
      audioCtxRef.current = new AudioCtxClass();
    }
    return audioCtxRef.current;
  }, []);

  const stopBgMusic = useCallback(() => {
    if (musicIntervalRef.current !== null) {
      window.clearInterval(musicIntervalRef.current);
      musicIntervalRef.current = null;
    }
    if (musicLfoRef.current) {
      try {
        musicLfoRef.current.stop();
      } catch {}
      musicLfoRef.current.disconnect();
      musicLfoRef.current = null;
    }
    if (musicLfoGainRef.current) {
      musicLfoGainRef.current.disconnect();
      musicLfoGainRef.current = null;
    }
    if (musicOscARef.current) {
      try {
        musicOscARef.current.stop();
      } catch {}
      musicOscARef.current.disconnect();
      musicOscARef.current = null;
    }
    if (musicOscBRef.current) {
      try {
        musicOscBRef.current.stop();
      } catch {}
      musicOscBRef.current.disconnect();
      musicOscBRef.current = null;
    }
    if (musicFilterRef.current) {
      musicFilterRef.current.disconnect();
      musicFilterRef.current = null;
    }
    if (musicGainRef.current) {
      musicGainRef.current.disconnect();
      musicGainRef.current = null;
    }
  }, []);

  const startBgMusic = useCallback(() => {
    if (!musicEnabled || typeof window === "undefined") return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    stopBgMusic();

    const musicGain = ctx.createGain();
    const volMul = Math.max(0, Math.min(1, musicVolume / 100));
    musicGain.gain.setValueAtTime(volMul * 0.14, ctx.currentTime);
    musicGain.connect(ctx.destination);
    musicGainRef.current = musicGain;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, ctx.currentTime);
    filter.connect(musicGain);
    musicFilterRef.current = filter;

    const bassline = [110, 110, 130.81, 130.81, 98, 98, 87.31, 87.31];
    let step = 0;

    const playBassNote = () => {
      if (ctx.state === "suspended") return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = "sawtooth";
      const freq = bassline[step % bassline.length];
      osc.frequency.setValueAtTime(freq, now);

      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.linearRampToValueAtTime(0.6, now + 0.012);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(noteGain);
      noteGain.connect(filter);
      
      osc.start(now);
      osc.stop(now + 0.24);

      osc.onended = () => {
        noteGain.disconnect();
        osc.disconnect();
      };

      if (step % 4 === 2) {
        const arpOsc = ctx.createOscillator();
        const arpGain = ctx.createGain();
        arpOsc.type = "triangle";
        const arpFreq = freq * 3.0; 
        arpOsc.frequency.setValueAtTime(arpFreq, now);

        arpGain.gain.setValueAtTime(0, now);
        arpGain.gain.linearRampToValueAtTime(0.18, now + 0.005);
        arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        arpOsc.connect(arpGain);
        arpGain.connect(musicGain);

        arpOsc.start(now + 0.04);
        arpOsc.stop(now + 0.18);

        arpOsc.onended = () => {
          arpGain.disconnect();
          arpOsc.disconnect();
        };
      }

      step++;
    };

    musicIntervalRef.current = window.setInterval(playBassNote, 250);
  }, [ensureAudioCtx, musicEnabled, musicVolume, stopBgMusic]);

  const playSoundEffect = useCallback(
    (type: "click" | "flip" | "gameover" | "toggle" | "gem") => {
      if (!sfxEnabled) return;
      const ctx = ensureAudioCtx();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      let freq = 320;
      let duration = 0.18;
      let tone: OscillatorType = "triangle";
      if (type === "gameover") {
        freq = 130;
        duration = 0.42;
        tone = "sine";
      } else if (type === "toggle") {
        freq = 520;
        duration = 0.14;
        tone = "triangle";
      } else if (type === "click") {
        freq = 280;
        duration = 0.12;
        tone = "square";
      } else if (type === "flip") {
        freq = 280;
        duration = 0.16;
        tone = "square";
      } else if (type === "gem") {
        freq = 620;
        duration = 0.16;
        tone = "sawtooth";
      }

      osc.frequency.setValueAtTime(freq, now);
      osc.type = tone;
      gain.gain.setValueAtTime(0, now);

      const volMul = Math.max(0, Math.min(1, sfxVolume / 100));
      if (volMul <= 0) return;

      const maxVol = volMul * 0.18 + 0.04;
      gain.gain.linearRampToValueAtTime(maxVol, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);

      osc.onended = () => {
        gain.disconnect();
        osc.disconnect();
      };
    },
    [ensureAudioCtx, sfxEnabled, sfxVolume]
  );

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const scale = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      if (canvasRef.current) {
        canvasRef.current.width = w * scale;
        canvasRef.current.height = h * scale;
      }
      if (bgCanvasRef.current) {
        bgCanvasRef.current.width = w * scale;
        bgCanvasRef.current.height = h * scale;
      }
    };
    
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isGame = screen === "playing" || screen === "paused";

  // Menu Background Animation
  useEffect(() => {
    if (isGame) return;
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let active = true;
    let frame = 0;

    const render = () => {
      if (!active) return;
      frame++;

      const w = canvas.width;
      const h = canvas.height;
      
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#04060f";
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      for (let i = 0; i < 40; i++) {
        const sx = ((Math.sin(i * 12.3) + 1) / 2) * w;
        const sy = (((Math.cos(i * 45.6) + 1) / 2) * h + frame * 0.15) % h;
        const r = ((Math.sin(i * 99.8) + 1) / 2) * 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const theme = getWorldForScore(highScore);
      ctx.strokeStyle = theme.grid;
      ctx.lineWidth = 1;
      
      const horizon = h * 0.45;
      const numLines = 18;
      for (let i = 0; i <= numLines; i++) {
        const xStart = (i / numLines) * w;
        ctx.beginPath();
        ctx.moveTo(xStart, h);
        ctx.lineTo(w / 2 + (xStart - w / 2) * 0.1, horizon);
        ctx.stroke();
      }

      const gridCount = 9;
      const speed = 0.8;
      for (let i = 0; i < gridCount; i++) {
        const offset = ((frame * speed) % 60) / 60;
        const ratio = (i + offset) / gridCount;
        const y = horizon + (h - horizon) * Math.pow(ratio, 2);
        
        ctx.globalAlpha = ratio * 0.7;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      const grad = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 20);
      grad.addColorStop(0, "rgba(4, 6, 15, 1)");
      grad.addColorStop(0.5, theme.accent + "18");
      grad.addColorStop(1, "rgba(4, 6, 15, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, horizon - 40, w, 80);

      const pulse = 0.5 + Math.sin(frame * 0.03) * 0.15;
      ctx.fillStyle = theme.glow;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.35 + pulse * 20, 0, Math.PI * 2);
      ctx.fill();

      requestAnimationFrame(render);
    };

    render();
    return () => {
      active = false;
    };
  }, [screen, isGame, highScore]);

  // Background Music controller hook
  useEffect(() => {
    if (musicEnabled && screen !== "paused") {
      startBgMusic();
    } else {
      stopBgMusic();
    }
    return () => stopBgMusic();
  }, [screen, musicEnabled, musicVolume, startBgMusic, stopBgMusic]);

  useEffect(() => {
    equippedCharRef.current = equippedChar;
    if (gsRef.current) gsRef.current.charId = equippedChar;
  }, [equippedChar]);

  useEffect(() => {
    writeProgress({
      highScore,
      totalGems,
      lastScore,
      lastGems,
      scoreHistory,
      ownedChars: Array.from(ownedChars).sort((a, b) => a - b),
      equippedChar,
      showHint,
      motionEnabled,
      sfxEnabled,
      sfxVolume,
      musicEnabled,
      musicVolume,
    });
  }, [
    highScore,
    totalGems,
    lastScore,
    lastGems,
    scoreHistory,
    ownedChars,
    equippedChar,
    showHint,
    motionEnabled,
    sfxEnabled,
    sfxVolume,
    musicEnabled,
    musicVolume,
  ]);

  const syncActiveChar = useCallback(() => {
    if (!gsRef.current) return;
    const nextChar = equippedCharRef.current;
    if (gsRef.current.charId !== nextChar) {
      gsRef.current.charId = nextChar;
    }
  }, []);

  const applyEquippedChar = useCallback((idx: number) => {
    equippedCharRef.current = idx;
    setEquippedChar(idx);
    if (gsRef.current) gsRef.current.charId = idx;
  }, []);

  const resetProgress = useCallback(() => {
    setHighScore(0);
    setTotalGems(0);
    setLastScore(0);
    setLastGems(0);
    setScoreHistory([]);
    setOwnedChars(new Set([0]));
    setEquippedChar(0);
    applyEquippedChar(0);
    if (sfxEnabled) playSoundEffect("toggle");
  }, [applyEquippedChar, playSoundEffect, sfxEnabled]);

  const flip = useCallback(() => {
    const gs = gsRef.current;
    syncActiveChar();
    if (!gs.alive || gs.flipCD > 0) return;
    if (sfxEnabled) playSoundEffect("flip");
    const bonus = getCharBonus(gs.charId);
    gs.gd = -gs.gd;
    gs.cvy = FLIP_VEL * gs.gd * bonus.flipVel;
    gs.flipCD = 6;
    setShowHint(false);
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 4;
      gs.ptcls.push({
        x: CHAR_X + CHAR_W / 2,
        y: gs.cy + CHAR_H / 2,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 22 + Math.random() * 18,
        life0: 40,
        r: 2 + Math.random() * 3,
        col: CHARS[gs.charId]?.col ?? "#00e5ff",
      });
    }
  }, [playSoundEffect, sfxEnabled, syncActiveChar]);

  const startGame = useCallback(() => {
    if (sfxEnabled) playSoundEffect("click");
    try {
      const el = document.documentElement;
      if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } catch {}
    const activeChar = equippedCharRef.current;
    gsRef.current = mkGS(activeChar);
    gsRef.current.charId = activeChar;
    setLiveScore(0);
    setLiveGems(0);
    setShowHint(true);
    setScreen("playing");
  }, [playSoundEffect, sfxEnabled]);

  useEffect(() => {
    if (screen !== "playing") {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastUI = 0;
    let goScheduled = false;

    const loop = (ts: number) => {
      if (screenRef.current !== "playing") return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const gs = gsRef.current;
      syncActiveChar();
      const effect = stepGame(gs);
      if (effect === "gem" && sfxEnabled) playSoundEffect("gem");

      const scale = Math.min(canvas.width / GW, canvas.height / GH);
      const offsetX = (canvas.width - GW * scale) / 2;
      const offsetY = (canvas.height - GH * scale) / 2;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      drawGame(ctx, gs);

      if (ts - lastUI > 80) {
        setLiveScore(gs.score);
        setLiveGems(gs.gc);
        lastUI = ts;
      }

      if (!gs.alive && !goScheduled) {
        goScheduled = true;
        setTimeout(() => {
          const s = gs.score;
          const g = gs.gc;
          setLastScore(s);
          setLastGems(g);
          setHighScore(h => Math.max(h, s));
          setScoreHistory(history => [s, ...history].slice(0, 20));
          if (sfxEnabled) playSoundEffect("gameover");
          setTotalGems(t => t + g);
          setScreen("gameover");
        }, 900);
        return;
      }

      if (gs.alive) rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, playSoundEffect, sfxEnabled, syncActiveChar]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
          audioCtxRef.current.resume();
        }
        if (screenRef.current === "playing") flip();
        if (screenRef.current === "paused") setScreen("playing");
      }
      if (e.code === "Escape") {
        if (screenRef.current === "playing") setScreen("paused");
        else if (screenRef.current === "paused") setScreen("playing");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip]);

  const buyChar = useCallback(
    (idx: number) => {
      const ch = CHARS[idx];
      if (ownedChars.has(idx) || totalGems < ch.price) return;
      setTotalGems(t => t - ch.price);
      setOwnedChars(s => new Set([...s, idx]));
      if (sfxEnabled) playSoundEffect("toggle");
    },
    [ownedChars, totalGems, playSoundEffect, sfxEnabled]
  );

  const equipChar = useCallback(
    (idx: number) => {
      if (!ownedChars.has(idx)) return;
      applyEquippedChar(idx);
      if (sfxEnabled) playSoundEffect("toggle");
    },
    [applyEquippedChar, ownedChars, playSoundEffect, sfxEnabled]
  );

  const currentWorld = getWorldForScore(liveScore);
  const nextWorldThreshold = getNextWorldThreshold(liveScore);

  // Motion disable fix:
  // Only the Settings screen is currently gated by motionEnabled. The rest of the app
  // will still render motion components; to keep the toggle consistent, we ensure
  // Settings screen animations always honor motionEnabled.

  return (
    <div className="gravityflip-root relative w-full h-screen overflow-hidden" style={{ background: "#04060f" }}>
      <canvas
        ref={bgCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: isGame ? "none" : "block" }}
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          display: isGame ? "block" : "none",
          width: "100%",
          height: "100%",
          cursor: screen === "playing" ? "pointer" : "default",
          touchAction: "none",
        }}
        onPointerDown={
          screen === "playing"
            ? e => {
                e.preventDefault();
                (e.currentTarget as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
                if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
                  audioCtxRef.current.resume();
                }
                flip();
              }
            : undefined
        }
        onContextMenu={e => e.preventDefault()}
      />

      {screen === "playing" && (
        <div className="absolute inset-0 pointer-events-none flex flex-col p-5">
          <div className="flex justify-between items-start">
            <div>
              <div style={{ ...orb, color: "#4a6080", fontSize: "9px", letterSpacing: "0.18em" }}>SCORE</div>
              <div style={{ ...orb, color: "#00e5ff", fontSize: "30px", fontWeight: 700, lineHeight: 1, textShadow: "0 0 20px rgba(0,229,255,0.6)" }}>{liveScore.toString().padStart(4, "0")}</div>
              <div style={{ marginTop: "8px", display: "inline-flex", alignItems: "center", gap: "8px", padding: "7px 10px", border: `1px solid ${currentWorld.accent}33`, background: "rgba(4,6,15,0.7)", borderRadius: "999px" }}>
                <span style={{ ...orb, color: currentWorld.accent, fontSize: "9px", letterSpacing: "0.2em" }}>{currentWorld.label}</span>
                <span style={{ ...raj, color: "#6f86a8", fontSize: "10px" }}>{currentWorld.name}</span>
              </div>
              {nextWorldThreshold > 0 && (
                <div style={{ ...raj, color: "#4a6080", fontSize: "10px", marginTop: "6px", letterSpacing: "0.08em" }}>
                  Next world at {nextWorldThreshold}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div style={{ ...orb, color: "#4a6080", fontSize: "9px", letterSpacing: "0.18em" }}>GEMS</div>
                <div style={{ ...orb, color: "#00e5ff", fontSize: "20px", fontWeight: 700, textShadow: "0 0 14px rgba(0,229,255,0.5)" }}>◆ {liveGems}</div>
              </div>
              <button
                className="pointer-events-auto flex flex-col items-center justify-center"
                style={{
                  width: 46,
                  height: 46,
                  background: "rgba(8,14,33,0.82)",
                  border: "1px solid rgba(0,229,255,0.22)",
                  color: "#00e5ff",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  lineHeight: 1.05,
                  boxShadow: "0 0 26px rgba(0,229,255,0.12)",
                  userSelect: "none",
                }}
                onClick={() => setScreen("paused")}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 6, height: 18, background: "#00e5ff", borderRadius: 2, boxShadow: "0 0 12px rgba(0,229,255,0.35)" }} />
                    <div style={{ width: 6, height: 18, background: "rgba(200,230,255,0.9)", borderRadius: 2 }} />
                  </div>
                  <div style={{ width: 26, height: 2, background: "rgba(0,229,255,0.25)", borderRadius: 999 }} />
                </div>
              </button>
            </div>
          </div>

          {showHint && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
              <div style={{ ...orb, color: "rgba(0,229,255,0.45)", fontSize: "11px", letterSpacing: "0.22em" }}>TAP · SPACE · ↑ TO FLIP GRAVITY</div>
            </div>
          )}
        </div>
      )}

      {screen === "menu" && (
        <MenuScreen
          highScore={highScore}
          totalGems={totalGems}
          gamesPlayed={scoreHistory.length}
          sfxEnabled={sfxEnabled}
          onPlay={startGame}
          onShop={() => setScreen("shop")}
          onScores={() => setScreen("scores")}
          onSettings={() => {
            setSettingsReturnScreen("menu");
            setScreen("settings");
          }}
          onAbout={() => setScreen("about")}
        />
      )}

      {screen === "paused" && (
        <PauseOverlay
          onResume={() => setScreen("playing")}
          onRestart={startGame}
          onHome={() => setScreen("menu")}
          onSettings={() => {
            setSettingsReturnScreen("paused");
            setScreen("settings");
          }}
        />
      )}

      {screen === "gameover" && (
        <GameOverScreen
          score={lastScore}
          best={highScore}
          gems={lastGems}
          onPlay={startGame}
          onHome={() => setScreen("menu")}
          onShop={() => setScreen("shop")}
        />
      )}

      {screen === "shop" && (
        <ShopScreen totalGems={totalGems} owned={ownedChars} equipped={equippedChar} onEquip={equipChar} onBuy={buyChar} onBack={() => setScreen("menu")} />
      )}

      {screen === "scores" && (
        <ScoresScreen
          highScore={highScore}
          lastScore={lastScore}
          totalGems={totalGems}
          gamesPlayed={scoreHistory.length}
          scoreHistory={scoreHistory}
          onResetProgress={resetProgress}
          onBack={() => setScreen("menu")}
        />
      )}

      {screen === "about" && <AboutScreen onBack={() => {
        playSoundEffect("click");
        setScreen("menu");
      }} />}

      {screen === "settings" && (
        <SettingsScreen
          showHint={showHint}
          motionEnabled={motionEnabled}
          sfxEnabled={sfxEnabled}
          sfxVolume={sfxVolume}
          musicEnabled={musicEnabled}
          musicVolume={musicVolume}
          onToggleHint={() => {
            playSoundEffect("toggle");
            setShowHint(enabled => !enabled);
          }}
          onToggleMotion={() => {
            playSoundEffect("toggle");
            setMotionEnabled(enabled => !enabled);
          }}
          onToggleSfx={() => {
            playSoundEffect("toggle");
            setSfxEnabled(enabled => !enabled);
          }}
          onToggleSfxVolume={value => setSfxVolume(value)}
          onToggleMusic={() => {
            playSoundEffect("toggle");
            setMusicEnabled(enabled => !enabled);
          }}
          onToggleMusicVolume={value => setMusicVolume(value)}
          onBack={() => {
            playSoundEffect("click");
            setScreen(settingsReturnScreen);
          }}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.45} 50%{opacity:0.9} }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,229,255,0.2); }
      `}</style>
    </div>
  );
}

