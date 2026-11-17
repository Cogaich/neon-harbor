// Drawing only: the world's state and the current screen in, pixels out.
// The camera shows a 1280x720 slice of the city, scaled to fit the window.
// Flat shapes, canvas text for the HUD and the panels.

import { AVENUES, FONT, PALETTE, ROAD_W, STREETS, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 680, line: 30 };
const MINIMAP = { w: 200, h: 150, margin: 16 };

const fonts = new Map();
function font(size, bold) {
  const key = `${bold ? 'b' : ''}${size}`;
  if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
  return fonts.get(key);
}

/** A stable 0..1 hash from a building's position, for windows and details. */
function hash(x, y) {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0, cssW: 0, cssH: 0, dpr: 1 };
  let cam = { x: 1200, y: 700 };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    view.scale = Math.min(cssW / VIEW.width, cssH / VIEW.height);
    view.ox = (cssW - VIEW.width * view.scale) / 2;
    view.oy = (cssH - VIEW.height * view.scale) / 2;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
  }

  function text(value, x, y, size, color, align, bold) {
    context.font = font(size, bold);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function setWorldTransform(shakeX, shakeY) {
    const dpr = view.dpr;
    const s = view.scale * dpr;
    const tx = dpr * (view.ox - (cam.x + (shakeX || 0) - VIEW.width / 2) * view.scale);
    const ty = dpr * (view.oy - (cam.y + (shakeY || 0) - VIEW.height / 2) * view.scale);
    context.setTransform(s, 0, 0, s, tx, ty);
  }

  function setHudTransform() {
    const dpr = view.dpr;
    const s = view.scale * dpr;
    context.setTransform(s, 0, 0, s, dpr * view.ox, dpr * view.oy);
  }

  function setRawTransform() {
    context.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  function screenToWorld(sx, sy) {
    return {
      x: cam.x - VIEW.width / 2 + (sx - view.ox) / view.scale,
      y: cam.y - VIEW.height / 2 + (sy - view.oy) / view.scale,
    };
  }

  function drawRoads() {
    // Sidewalks first (wider, lighter), then the asphalt on top.
    context.fillStyle = PALETTE.sidewalk;
    for (const ax of AVENUES) {
      context.fillRect(ax - ROAD_W / 2 - 14, 0, ROAD_W + 28, WORLD.height);
    }
    for (const sy of STREETS) {
      context.fillRect(0, sy - ROAD_W / 2 - 14, WORLD.width, ROAD_W + 28);
    }
    context.fillStyle = PALETTE.road;
    for (const ax of AVENUES) {
      context.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    }
    for (const sy of STREETS) {
      context.fillRect(0, sy - ROAD_W / 2, WORLD.width, ROAD_W);
    }
    // Centre dashes.
    context.fillStyle = PALETTE.lane;
    for (const ax of AVENUES) {
      for (let y = 40; y < WORLD.height; y += 64) {
        context.fillRect(ax - 3, y, 6, 30);
      }
    }
    for (const sy of STREETS) {
      for (let x = 40; x < WORLD.width; x += 64) {
        context.fillRect(x, sy - 3, 30, 6);
      }
    }
    // Crosswalks at every intersection.
    context.fillStyle = PALETTE.crosswalk;
    for (const ax of AVENUES) {
      for (const sy of STREETS) {
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(ax - ROAD_W / 2 + 12 + (i + 3) * 16, sy - ROAD_W / 2 - 8, 8, 16);
          context.fillRect(ax - ROAD_W / 2 + 12 + (i + 3) * 16, sy + ROAD_W / 2 - 8, 8, 16);
        }
      }
    }
  }

  function drawCity(state) {
    const city = state.city;
    const vx0 = cam.x - VIEW.width / 2 - 60;
    const vy0 = cam.y - VIEW.height / 2 - 60;
    const vx1 = cam.x + VIEW.width / 2 + 60;
    const vy1 = cam.y + VIEW.height / 2 + 60;

    context.fillStyle = PALETTE.grass;
    context.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);

    // Park with pond and trees.
    context.fillStyle = PALETTE.park;
    context.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
    context.fillStyle = PALETTE.water;
    context.beginPath();
    context.ellipse(city.pond.x, city.pond.y, city.pond.rx, city.pond.ry, 0, 0, Math.PI * 2);
    context.fill();
    for (const tree of city.trees) {
      if (tree.x < vx0 || tree.x > vx1 || tree.y < vy0 || tree.y > vy1) continue;
      context.fillStyle = '#4e7a3a';
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#6aa84f';
      context.beginPath();
      context.arc(tree.x - 2, tree.y - 2, tree.r * 0.7, 0, Math.PI * 2);
      context.fill();
    }

    // Beach, water, piers.
    context.fillStyle = PALETTE.sand;
    context.fillRect(vx0, city.beachTop, vx1 - vx0, city.waterTop - city.beachTop);
    context.fillStyle = PALETTE.water;
    context.fillRect(vx0, city.waterTop, vx1 - vx0, vy1 - city.waterTop);
    context.fillStyle = PALETTE.waterDeep;
    for (let x = Math.floor(vx0 / 90) * 90; x < vx1; x += 90) {
      const wobble = Math.sin((x + state.time * 60) * 0.02) * 6;
      context.fillRect(x, city.waterTop + 26 + wobble, 46, 3);
      context.fillRect(x + 30, city.waterTop + 62 - wobble, 40, 3);
    }
    for (const pier of city.piers) {
      context.fillStyle = PALETTE.pier;
      context.fillRect(pier.x, pier.y, pier.w, pier.h);
      context.fillStyle = '#6d5238';
      for (let y = pier.y + 12; y < pier.y + pier.h; y += 22) {
        context.fillRect(pier.x, y, pier.w, 3);
      }
    }

    drawRoads();

    // Buildings, culled to the camera.
    for (const b of city.buildings) {
      if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      context.fillStyle = 'rgba(255,255,255,0.28)';
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (hash(b.x + c * 31, b.y + r * 47) < 0.55) {
            context.fillRect(b.x + 12 + c * 30, b.y + 12 + r * 30, 14, 16);
          }
        }
      }
      if (b.neon) {
        context.fillStyle = b.neon;
        context.fillRect(b.x + b.w - 6, b.y + 10, 4, b.h - 20);
      }
    }

    // Neon signs along the main avenue.
    for (const n of city.neons) {
      if (n.x < vx0 || n.x > vx1 || n.y < vy0 || n.y > vy1) continue;
      const flicker = hash(Math.floor(state.time * 3), n.y) < 0.12 ? 0.35 : 1;
      context.globalAlpha = flicker;
      context.fillStyle = n.color;
      if (n.vertical) context.fillRect(n.x - 3, n.y, 6, 44);
      else context.fillRect(n.x - 22, n.y - 3, 44, 6);
      context.globalAlpha = 1;
    }
  }

  function drawCar(x, y, angle, color, isPolice, time, disabled) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(-26, -14, 52, 28);
    context.fillStyle = disabled ? '#555c66' : color;
    context.fillRect(-24, -13, 48, 26);
    context.fillStyle = 'rgba(20,24,32,0.85)';
    context.fillRect(-6, -11, 14, 22);
    context.fillStyle = '#cfe8ff';
    context.fillRect(18, -10, 4, 8);
    context.fillRect(18, 2, 4, 8);
    context.fillStyle = '#ffeb3b';
    context.fillRect(22, -11, 3, 6);
    context.fillRect(22, 5, 3, 6);
    if (isPolice) {
      const flash = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = flash ? '#ff1744' : '#2979ff';
      context.fillRect(-12, -13, 10, 5);
      context.fillStyle = flash ? '#2979ff' : '#ff1744';
      context.fillRect(2, -13, 10, 5);
      context.fillStyle = '#ffffff';
      context.font = font(11, true);
      context.textAlign = 'center';
      context.fillText('POLICE', 0, 4);
    }
    if (disabled) {
      context.fillStyle = 'rgba(120,120,120,0.7)';
      context.beginPath();
      context.arc(-10, -16, 9 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawPed(x, y, color, angle, down, walkT) {
    context.save();
    context.translate(x, y);
    if (down) {
      context.rotate(angle + Math.PI / 2);
      context.fillStyle = '#7a7a7a';
      context.beginPath();
      context.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      context.fill();
    } else {
      const bob = Math.sin(walkT * 10) * 2;
      context.fillStyle = 'rgba(0,0,0,0.22)';
      context.beginPath();
      context.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = color;
      context.beginPath();
      context.arc(0, bob * 0.3, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f2c89b';
      context.beginPath();
      context.arc(Math.cos(angle) * 3, Math.sin(angle) * 3 + bob * 0.3, 4, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawMarker(x, y, time, label) {
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    context.save();
    context.translate(x, y);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.gold;
    context.font = font(30, true);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('★', 0, 1);
    context.restore();
    context.font = font(15, true);
    context.fillStyle = PALETTE.gold;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.fillText(label, x, y - 46);
  }

  function drawEntities(state, roadXY) {
    // Pickups.
    for (const item of state.pickups) {
      if (!item.active) continue;
      const bob = Math.sin(state.time * 3 + item.x) * 2;
      if (item.kind === 'cash') {
        context.fillStyle = '#2e7d32';
        context.beginPath();
        context.arc(item.x, item.y + bob, 12, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#a5d6a7';
        context.font = font(14, true);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('$', item.x, item.y + bob + 1);
      } else {
        context.fillStyle = '#f5f5f5';
        context.fillRect(item.x - 10, item.y + bob - 10, 20, 20);
        context.fillStyle = '#d32f2f';
        context.fillRect(item.x - 3, item.y + bob - 8, 6, 16);
        context.fillRect(item.x - 8, item.y + bob - 3, 16, 6);
      }
    }

    // Mission marker.
    const mission = state._mission;
    if (mission && mission.step) {
      drawMarker(mission.step.x, mission.step.y, state.time, mission.step.label);
    }

    // Pedestrians.
    for (const ped of state.peds) {
      const pos = roadXY(ped);
      drawPed(pos.x, pos.y, ped.color, ped.axis === 'y' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI), ped.down, state.time + ped.pos);
    }

    // Traffic.
    for (const car of state.traffic) {
      const pos = roadXY(car);
      const angle = car.angle !== undefined ? car.angle
        : car.axis === 'y' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      drawCar(pos.x, pos.y, angle, car.color, false, state.time, false);
    }

    // Police.
    for (const cop of state.police) {
      drawCar(cop.x, cop.y, cop.angle, PALETTE.policeCar, true, state.time, cop.disabled);
    }

    // Player car or player on foot.
    const p = state.player;
    if (state.playerCar) {
      const car = state.playerCar;
      drawCar(car.x, car.y, car.angle, PALETTE.playerCar, false, state.time, false);
      // Aim direction tick.
      context.strokeStyle = 'rgba(255,255,255,0.5)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(car.x, car.y);
      context.lineTo(car.x + Math.cos(car.angle) * 34, car.y + Math.sin(car.angle) * 34);
      context.stroke();
    } else {
      const blink = p.invulnT > 0 && Math.floor(p.invulnT * 10) % 2 === 0;
      if (!blink) {
        const bob = Math.sin(p.walkT * 12) * 2;
        context.fillStyle = 'rgba(0,0,0,0.25)';
        context.beginPath();
        context.ellipse(p.x, p.y + 8, 11, 5, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.player;
        context.beginPath();
        context.arc(p.x, p.y + bob * 0.3, 13, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#0d3b2e';
        context.beginPath();
        context.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5 + bob * 0.3, 5, 0, Math.PI * 2);
        context.fill();
      }
    }

    // Bullets.
    context.fillStyle = '#ffe14d';
    for (const b of state.bullets) {
      context.beginPath();
      context.arc(b.x, b.y, 4, 0, Math.PI * 2);
      context.fill();
    }

    // Muzzle flash: a brief bloom at the gun while the shot is fresh.
    if (state.muzzleT > 0 && !state.playerCar) {
      const p = state.player;
      const fx = p.x + Math.cos(p.angle) * 26;
      const fy = p.y + Math.sin(p.angle) * 26;
      const r = 12 * (state.muzzleT / 0.06);
      context.fillStyle = 'rgba(255, 225, 77, 0.9)';
      context.beginPath();
      context.arc(fx, fy, r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255, 140, 40, 0.7)';
      context.beginPath();
      context.arc(fx, fy, r * 0.55, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawHud(state, meta) {
    const mission = state._mission;
    context.textBaseline = 'alphabetic';

    // Top-left: health, cash, ammo.
    context.fillStyle = PALETTE.hudBg;
    context.fillRect(14, 14, 250, 92);
    context.fillStyle = PALETTE.text;
    context.font = font(20, true);
    context.textAlign = 'left';
    context.fillText('YOU', 26, 40);
    context.fillStyle = '#333a45';
    context.fillRect(90, 26, 150, 14);
    context.fillStyle = state.health > 30 ? '#4caf50' : '#f44336';
    context.fillRect(90, 26, 150 * Math.max(0, state.health / 100), 14);
    context.font = font(22, true);
    context.fillStyle = PALETTE.gold;
    context.fillText(`$${state.cash}`, 26, 74);
    context.font = font(16, false);
    context.fillStyle = PALETTE.muted;
    if (state.player.onFoot) {
      context.fillText(state.reloadT > 0 ? 'Reloading…' : `Ammo ${state.ammo} / ${12}`, 140, 74);
    } else {
      const kmh = Math.round(Math.abs(state.playerCar.speed) * 0.36);
      context.fillText(`${kmh} km/h`, 140, 74);
    }
    context.font = font(13, false);
    context.fillText(state.player.onFoot ? 'WASD move · Click shoot · E enter car' : 'WASD drive · E get out · P pause', 26, 96);

    // Top-right: wanted stars.
    context.fillStyle = PALETTE.hudBg;
    context.fillRect(VIEW.width - 214, 14, 200, 52);
    context.font = font(26, true);
    context.textAlign = 'right';
    for (let i = 0; i < 5; i += 1) {
      context.fillStyle = i < state.wanted ? PALETTE.gold : 'rgba(255,255,255,0.18)';
      context.fillText('★', VIEW.width - 26 - i * 34, 50);
    }

    // Top-centre: mission objective.
    if (mission) {
      const label = mission.step ? mission.step.label : mission.title;
      context.font = font(17, true);
      const w = context.measureText(label).width + 36;
      context.fillStyle = PALETTE.hudBg;
      context.fillRect((VIEW.width - w) / 2, 14, w, 40);
      context.fillStyle = PALETTE.gold;
      context.textAlign = 'center';
      context.fillText(label, VIEW.width / 2, 41);
    }

    // Message banner.
    if (state.messageT > 0 && state.message) {
      context.font = font(20, true);
      const w = context.measureText(state.message).width + 40;
      context.fillStyle = 'rgba(12,16,24,0.85)';
      context.fillRect((VIEW.width - w) / 2, 66, w, 38);
      context.fillStyle = PALETTE.text;
      context.textAlign = 'center';
      context.fillText(state.message, VIEW.width / 2, 92);
    }

    // Off-screen mission arrow.
    if (mission && mission.step) {
      const tx = mission.step.x;
      const ty = mission.step.y;
      const vx0 = cam.x - VIEW.width / 2;
      const vy0 = cam.y - VIEW.height / 2;
      const vx1 = cam.x + VIEW.width / 2;
      const vy1 = cam.y + VIEW.height / 2;
      if (tx < vx0 || tx > vx1 || ty < vy0 || ty > vy1) {
        const dx = tx - state.player.x;
        const dy = ty - state.player.y;
        const angle = Math.atan2(dy, dx);
        const ax = VIEW.width / 2 + Math.cos(angle) * 300;
        const ay = VIEW.height / 2 + Math.sin(angle) * 220;
        const dist = Math.round(Math.hypot(dx, dy));
        context.save();
        context.translate(ax, ay);
        context.rotate(angle);
        context.fillStyle = PALETTE.gold;
        context.beginPath();
        context.moveTo(18, 0);
        context.lineTo(-10, -12);
        context.lineTo(-10, 12);
        context.closePath();
        context.fill();
        context.restore();
        context.font = font(15, true);
        context.fillStyle = PALETTE.gold;
        context.textAlign = 'center';
        context.fillText(`${dist}m`, ax, ay + 30);
      }
    }

    drawMinimap(state);
  }

  function drawMinimap(state) {
    const scale = MINIMAP.w / WORLD.width;
    const mx = VIEW.width - MINIMAP.w - MINIMAP.margin;
    const my = VIEW.height - MINIMAP.h - MINIMAP.margin;
    context.fillStyle = 'rgba(10,14,20,0.8)';
    context.fillRect(mx - 4, my - 4, MINIMAP.w + 8, MINIMAP.h + 8);
    context.fillStyle = '#233026';
    context.fillRect(mx, my, MINIMAP.w, MINIMAP.h);
    context.strokeStyle = '#5a636e';
    context.lineWidth = 1;
    for (const ax of AVENUES) {
      context.beginPath();
      context.moveTo(mx + ax * scale, my);
      context.lineTo(mx + ax * scale, my + MINIMAP.h);
      context.stroke();
    }
    for (const sy of STREETS) {
      context.beginPath();
      context.moveTo(mx, my + sy * scale);
      context.lineTo(mx + MINIMAP.w, my + sy * scale);
      context.stroke();
    }
    context.fillStyle = PALETTE.water;
    context.fillRect(mx, my + state.city.waterTop * scale, MINIMAP.w, MINIMAP.h - state.city.waterTop * scale);
    const mission = state._mission;
    if (mission && mission.step) {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(mx + mission.step.x * scale, my + mission.step.y * scale, 5 + Math.sin(state.time * 4) * 1.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const cop of state.police) {
      if (cop.disabled) continue;
      context.fillStyle = Math.floor(state.time * 4) % 2 === 0 ? '#ff1744' : '#2979ff';
      context.beginPath();
      context.arc(mx + cop.x * scale, my + cop.y * scale, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(mx + state.player.x * scale, my + state.player.y * scale, 4.5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1;
    context.strokeRect(mx + (cam.x - VIEW.width / 2) * scale, my + (cam.y - VIEW.height / 2) * scale, VIEW.width * scale, VIEW.height * scale);
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = 150 + lines.length * PANEL.line + 60;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(10,14,20,0.88)';
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.gold;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    context.font = font(52, true);
    context.fillStyle = accent || PALETTE.text;
    context.textAlign = 'center';
    context.fillText(title, VIEW.width / 2, y + 86);
    context.font = font(19, false);
    context.fillStyle = PALETTE.text;
    for (let i = 0; i < lines.length; i += 1) {
      context.fillText(lines[i], VIEW.width / 2, y + 132 + i * PANEL.line);
    }
    context.font = font(21, true);
    context.fillStyle = PALETTE.gold;
    context.fillText(prompt, VIEW.width / 2, y + height - 30);
  }

  function draw(state, screen, meta) {
    cam = state.camera;
    setRawTransform();
    context.fillStyle = '#0b0e13';
    context.fillRect(0, 0, view.cssW, view.cssH);
    let shakeX = 0;
    let shakeY = 0;
    if (state.shakeT > 0) {
      const mag = state.shakeMag * (state.shakeT / 0.15);
      shakeX = (Math.random() * 2 - 1) * mag;
      shakeY = (Math.random() * 2 - 1) * mag;
    }
    setWorldTransform(shakeX, shakeY);
    drawCity(state);
    drawEntities(state, meta.roadXY);
    setHudTransform();
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(8,10,16,0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      const lines = [
        'Neon Harbor — a sunny port city where everyone',
        'is one bad decision from rich. You are new in town,',
        'broke, and Rosa needs a driver.',
        '',
        'WASD — move / drive · Mouse — aim · Click — shoot',
        'E — steal / exit a car · R — reload · P — pause · M — mute',
        'Steal cars, run jobs for Rosa and Marlo, dodge the cops.',
      ];
      if (meta.hasSave) lines.push(`Saved progress: $${meta.cash} · Job ${Math.min(meta.missionIndex + 1, 5)} of 5`);
      if (meta.bestCash > 0) lines.push(`Best cash: $${meta.bestCash}`);
      drawPanel('NEON HARBOR', lines, 'Press SPACE to play · N for a new game', '#ff5ea8');
      return;
    }
    drawHud(state, meta);
    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(8,10,16,0.5)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('PAUSED', ['The city will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      context.fillStyle = 'rgba(8,10,16,0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      const lines = [
        `You were wasted. Cash kept: $${state.cash}`,
        'The hospital patched you up — the city is still yours to take.',
      ];
      drawPanel('WASTED', lines, 'Press SPACE to get back out there', '#ff5252');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld };
}
