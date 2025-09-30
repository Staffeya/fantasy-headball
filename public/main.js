import { joinQueue, leaveQueue, onMatchFound, onRoomLeft } from './net.js';
import { createMatch } from './match.js';

const menu = document.getElementById('menu');
const scene = document.getElementById('scene');
const backBtn = document.getElementById('backToMenu');
const rotateOverlay = document.getElementById('rotate');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let currentScene = 'menu';
let currentMatch = null;
let roomId = null;
let side = null;

function showMenu() {
  currentScene = 'menu';
  scene.classList.add('hidden');
  menu.classList.remove('hidden');
  if (currentMatch) {
    currentMatch.destroy();
    currentMatch = null;
  }
  leaveQueue();
  updateStatus('');
}

function showMatch() {
  currentScene = 'match';
  menu.classList.add('hidden');
  scene.classList.remove('hidden');
  scoreEl.textContent = '0 : 0';
  updateStatus('В очереди...');
  joinQueue();
}

function updateStatus(text) {
  statusEl.textContent = text || '';
  statusEl.style.display = text ? 'block' : 'none';
}

function handleOrientation() {
  const isPortrait = window.innerHeight > window.innerWidth;
  if (isPortrait) rotateOverlay.classList.remove('hidden');
  else rotateOverlay.classList.add('hidden');
}
window.addEventListener('resize', handleOrientation);
window.addEventListener('orientationchange', handleOrientation);
handleOrientation();

// Menu delegation
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'play') showMatch();
  if (action === 'invite') {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert('Ссылка скопирована! Отправьте другу.');
  }
  if (action === 'wardrobe' || action === 'shop') {
    alert('Раздел в разработке ✨');
  }
});

backBtn.addEventListener('click', showMenu);

// Matchmaking events
onMatchFound((data) => {
  roomId = data.roomId;
  side = data.side; // 'left' | 'right'
  updateStatus('Матч найден!');
  startLocalMatch();
});

onRoomLeft(() => {
  updateStatus('Соперник покинул игру');
  if (currentMatch) currentMatch.setPaused(true);
});

function startLocalMatch() {
  currentMatch = createMatch(canvas, ctx, { roomId, side, scoreEl, updateStatus });
}

// Initial scene
showMenu();
