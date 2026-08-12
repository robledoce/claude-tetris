'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - azul pálido
  '#ffb74d', // L - orange
];

const SKIN_COLORS = {
  retro: COLORS,
  neon: [
    null,
    '#00fff2', // I
    '#faff00', // O
    '#ff00e0', // T
    '#00ff6a', // S
    '#ff003c', // Z
    '#00aaff', // J
    '#ff8800', // L
  ],
  pastel: [
    null,
    '#a8e6f0', // I
    '#fff3b0', // O
    '#d9b8e8', // T
    '#b8e8c0', // S
    '#f0b8b8', // Z
    '#b8d0f0', // J
    '#f5cfa0', // L
  ],
  pixel: COLORS,
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const RECORDS_KEY = 'tetris-records';
const STATS_KEY = 'tetris-stats';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');

const pauseOverlay = document.getElementById('pause-overlay');
const pauseMenuView = document.getElementById('pause-menu-view');
const pauseControlsView = document.getElementById('pause-controls-view');
const resumeBtn = document.getElementById('resume-btn');
const restartPauseBtn = document.getElementById('restart-pause-btn');
const viewControlsBtn = document.getElementById('view-controls-btn');
const backPauseBtn = document.getElementById('back-pause-btn');
const startLevelSelect = document.getElementById('start-level-select');

const recordsListEl = document.getElementById('records-list');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const overlayNewRecord = document.getElementById('overlay-new-record');
const playerNameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');
const overlayRecordsListEl = document.getElementById('overlay-records-list');
const overlayBestComboEl = document.getElementById('overlay-best-combo');
const overlayMaxLinesEl = document.getElementById('overlay-max-lines');
const overlayRecordsPanel = document.querySelector('#overlay .records-panel');

const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme, gridColor, startLevel, skin;
let combo, maxCombo, finalScore, finalLines, finalCombo;

function applyTheme(newTheme) {
  theme = newTheme;
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.checked = theme === 'light';
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
  localStorage.setItem('theme', theme);
  if (board) draw();
}

function applySkin(newSkin) {
  skin = SKIN_COLORS[newSkin] ? newSkin : 'retro';
  document.body.classList.remove('skin-retro', 'skin-neon', 'skin-pastel', 'skin-pixel');
  document.body.classList.add(`skin-${skin}`);
  skinSelect.value = skin;
  localStorage.setItem('skin', skin);
  if (board) {
    draw();
    if (next) drawNext();
  }
}

applyTheme(localStorage.getItem('theme') || 'dark');
applySkin(localStorage.getItem('skin') || 'retro');
themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'light' : 'dark'));
skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawRetroBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px, py, size, size);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px, py, size, 4);
}

function drawNeonBlock(context, px, py, size, color) {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = size * 0.6;
  context.fillStyle = color;
  context.fillRect(px, py, size, size);
  context.shadowBlur = 0;
  context.strokeStyle = 'rgba(255,255,255,0.5)';
  context.lineWidth = 1;
  context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
  context.restore();
}

function drawPastelBlock(context, px, py, size, color) {
  const radius = Math.min(6, size / 4);
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(px, py, size, size, radius);
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.6)';
  context.lineWidth = 1.5;
  context.stroke();
}

function drawPixelBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px, py, size, size);
  const cell = Math.max(2, Math.floor(size / 6));
  context.fillStyle = 'rgba(0,0,0,0.15)';
  for (let yy = 0; yy < size; yy += cell * 2) {
    for (let xx = 0; xx < size; xx += cell * 2) {
      context.fillRect(px + xx, py + yy, cell, cell);
      context.fillRect(px + xx + cell, py + yy + cell, cell, cell);
    }
  }
  context.strokeStyle = 'rgba(0,0,0,0.35)';
  context.lineWidth = 1;
  context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = (SKIN_COLORS[skin] || COLORS)[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const bsize = size - 2;
  context.globalAlpha = alpha ?? 1;
  switch (skin) {
    case 'neon':
      drawNeonBlock(context, px, py, bsize, color);
      break;
    case 'pastel':
      drawPastelBlock(context, px, py, bsize, color);
      break;
    case 'pixel':
      drawPixelBlock(context, px, py, bsize, color);
      break;
    default:
      drawRetroBlock(context, px, py, bsize, color);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (current) {
    // ghost
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    // current piece
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || { bestCombo: 0, maxLines: 0 };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function qualifiesForTop(currentScore) {
  const records = loadRecords();
  return records.length < 5 || currentScore > records[records.length - 1].score;
}

function addRecord(name, recordScore, recordLines, recordCombo) {
  const records = loadRecords();
  const entry = { name: name || 'AAA', score: recordScore, lines: recordLines, combo: recordCombo };
  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  const trimmed = records.slice(0, 5);
  saveRecords(trimmed);
  return { records: trimmed, index: trimmed.indexOf(entry) };
}

function renderRecordsList(el, records, highlightIndex) {
  el.innerHTML = '';
  if (!records.length) {
    el.innerHTML = '<li class="empty">Sin récords aún</li>';
    return;
  }
  records.forEach((r, i) => {
    const li = document.createElement('li');
    if (i === highlightIndex) li.classList.add('highlight');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'rec-name';
    nameSpan.textContent = r.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'rec-score';
    scoreSpan.textContent = r.score.toLocaleString();
    li.append(nameSpan, scoreSpan);
    el.appendChild(li);
  });
}

function renderStats(comboEl, linesEl2, stats) {
  comboEl.textContent = stats.bestCombo;
  linesEl2.textContent = stats.maxLines;
}

function refreshRecordsUI() {
  renderRecordsList(recordsListEl, loadRecords());
  renderStats(bestComboEl, maxLinesEl, loadStats());
}

function endGame() {
  gameOver = true;
  current = null;
  cancelAnimationFrame(animId);
  draw();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  finalScore = score;
  finalLines = lines;
  finalCombo = maxCombo;

  const stats = loadStats();
  stats.bestCombo = Math.max(stats.bestCombo, finalCombo);
  stats.maxLines = Math.max(stats.maxLines, finalLines);
  saveStats(stats);
  renderStats(bestComboEl, maxLinesEl, stats);
  renderStats(overlayBestComboEl, overlayMaxLinesEl, stats);

  renderRecordsList(overlayRecordsListEl, loadRecords());
  overlayRecordsPanel.classList.remove('hidden');

  if (qualifiesForTop(finalScore)) {
    overlayNewRecord.classList.remove('hidden');
    playerNameInput.value = '';
    playerNameInput.focus();
  } else {
    overlayNewRecord.classList.add('hidden');
  }

  overlay.classList.remove('hidden');
}

function openPauseMenu() {
  pauseControlsView.classList.add('hidden');
  pauseMenuView.classList.remove('hidden');
  pauseOverlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    openPauseMenu();
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
      if (gameOver) return;
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  combo = 0;
  maxCombo = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

startLevel = parseInt(localStorage.getItem('startLevel'), 10) || 1;
startLevelSelect.value = String(startLevel);
startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10);
  localStorage.setItem('startLevel', String(startLevel));
});

resumeBtn.addEventListener('click', togglePause);
restartPauseBtn.addEventListener('click', () => {
  init();
  pauseOverlay.classList.add('hidden');
});
viewControlsBtn.addEventListener('click', () => {
  pauseMenuView.classList.add('hidden');
  pauseControlsView.classList.remove('hidden');
});
backPauseBtn.addEventListener('click', () => {
  pauseControlsView.classList.add('hidden');
  pauseMenuView.classList.remove('hidden');
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Resetear todos los récords?')) return;
  localStorage.removeItem(RECORDS_KEY);
  localStorage.removeItem(STATS_KEY);
  refreshRecordsUI();
  renderRecordsList(overlayRecordsListEl, []);
  renderStats(overlayBestComboEl, overlayMaxLinesEl, loadStats());
});

function saveCurrentRecord() {
  const name = playerNameInput.value.trim().slice(0, 12);
  const { records, index } = addRecord(name, finalScore, finalLines, finalCombo);
  renderRecordsList(overlayRecordsListEl, records, index);
  renderRecordsList(recordsListEl, records);
  overlayNewRecord.classList.add('hidden');
}

saveRecordBtn.addEventListener('click', saveCurrentRecord);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveCurrentRecord();
});

refreshRecordsUI();
init();
