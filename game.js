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

const HIGHSCORES_KEY = 'tetris-highscores';
const BEST_COMBO_KEY = 'tetris-best-combo';
const MAX_LINES_KEY = 'tetris-max-lines';

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

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const bestComboValueEl = document.getElementById('best-combo-value');
const maxLinesValueEl = document.getElementById('max-lines-value');
const startTbody = document.querySelector('#start-highscore-table tbody');
const gameoverTbody = document.querySelector('#gameover-highscore-table tbody');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveNameBtn = document.getElementById('save-name-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme, gridColor;
let combo, maxCombo;

function applyTheme(newTheme) {
  theme = newTheme;
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.checked = theme === 'light';
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
  localStorage.setItem('theme', theme);
  if (board) draw();
}

applyTheme(localStorage.getItem('theme') || 'dark');
themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'light' : 'dark'));

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function loadHighscores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(e => e && typeof e.name === 'string' && typeof e.score === 'number');
  } catch (e) {
    return [];
  }
}

function saveHighscores(list) {
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
}

function loadIntRecord(key) {
  try {
    const v = parseInt(localStorage.getItem(key), 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch (e) {
    return 0;
  }
}

function saveIntRecord(key, value) {
  localStorage.setItem(key, String(value));
}

function loadBestCombo() {
  return loadIntRecord(BEST_COMBO_KEY);
}

function saveBestCombo(value) {
  saveIntRecord(BEST_COMBO_KEY, value);
}

function loadMaxLines() {
  return loadIntRecord(MAX_LINES_KEY);
}

function saveMaxLines(value) {
  saveIntRecord(MAX_LINES_KEY, value);
}

function isTopScore(candidateScore) {
  const list = loadHighscores();
  if (list.length < 5) return true;
  return candidateScore > list[list.length - 1].score;
}

function addHighscore(name, candidateScore) {
  const list = loadHighscores();
  const entry = { name: name || 'ANÓNIMO', score: candidateScore };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.splice(5);
  saveHighscores(list);
  return entry;
}

function resetRecords() {
  localStorage.removeItem(HIGHSCORES_KEY);
  localStorage.removeItem(BEST_COMBO_KEY);
  localStorage.removeItem(MAX_LINES_KEY);
}

function renderHighscoreTable(tbody, highlightEntry) {
  if (!tbody) return;
  tbody.innerHTML = '';
  const list = loadHighscores();
  for (let i = 0; i < 5; i++) {
    const entry = list[i];
    const row = document.createElement('tr');
    if (entry && highlightEntry && entry.name === highlightEntry.name && entry.score === highlightEntry.score) {
      row.classList.add('highlight-row');
    }
    const rankCell = document.createElement('td');
    rankCell.textContent = i + 1;
    const nameCell = document.createElement('td');
    nameCell.textContent = entry ? entry.name : '--';
    const scoreCell = document.createElement('td');
    scoreCell.textContent = entry ? entry.score.toLocaleString() : '--';
    row.append(rankCell, nameCell, scoreCell);
    tbody.appendChild(row);
  }
}

function renderRecordsSummary() {
  if (bestComboValueEl) bestComboValueEl.textContent = loadBestCombo();
  if (maxLinesValueEl) maxLinesValueEl.textContent = loadMaxLines();
}

function refreshRecordsUI(highlightEntry) {
  renderHighscoreTable(startTbody, highlightEntry || null);
  renderHighscoreTable(gameoverTbody, highlightEntry || null);
  renderRecordsSummary();
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
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    if (combo > maxCombo) maxCombo = combo;
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
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

function endGame() {
  gameOver = true;
  current = null;
  cancelAnimationFrame(animId);
  draw();

  if (maxCombo > loadBestCombo()) saveBestCombo(maxCombo);
  if (lines > loadMaxLines()) saveMaxLines(lines);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  if (isTopScore(score)) {
    nameEntry.classList.remove('hidden');
    nameInput.value = '';
    setTimeout(() => nameInput.focus(), 0);
  } else {
    nameEntry.classList.add('hidden');
  }

  refreshRecordsUI(null);
  overlay.classList.remove('hidden');
}

function saveHighscoreName() {
  if (nameEntry.classList.contains('hidden')) return;
  const name = (nameInput.value || '').trim().slice(0, 12) || 'ANÓNIMO';
  const entry = addHighscore(name, score);
  refreshRecordsUI(entry);
  nameEntry.classList.add('hidden');
}

function togglePause() {
  if (gameOver || !board) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
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
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  combo = 0;
  maxCombo = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  nameEntry.classList.add('hidden');
  startScreen.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver || !board) return;
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

playBtn.addEventListener('click', init);

resetRecordsBtn.addEventListener('click', () => {
  if (confirm('¿Seguro que quieres borrar todos los récords guardados?')) {
    resetRecords();
    refreshRecordsUI(null);
  }
});

saveNameBtn.addEventListener('click', saveHighscoreName);
nameInput.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.code === 'Enter') saveHighscoreName();
});

refreshRecordsUI(null);
startScreen.classList.remove('hidden');
