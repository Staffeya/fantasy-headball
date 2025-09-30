import { joinQueue, leaveQueue, onMatchFound, onRoomLeft } from './net.js';
import { createMatch } from './match.js';

const menu = document.getElementById('menu');
const scene = document.getElementById('scene');
const backBtn = document.getElementById('backToMenu');
const rotateOverlay = document.getElementById('rotate');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scaleWrap = document.querySelector('.game-scale');
const fixedLayer = document.querySelector('.game-fixed');

let currentMatch = null, roomId = null, side = null;
let timerId = null, timeLeft = 60;

const BASE_W = 900, BASE_H = 500;

/** Надёжное масштабирование под любое устройство (Telegram WebView учитывается) */
function getViewportSize() {
    // VisualViewport корректнее в моб. WebView
    const vv = window.visualViewport;
    return vv ? { w: vv.width, h: vv.height } : { w: window.innerWidth, h: window.innerHeight };
}

function resizeGame() {
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;

    const controls = document.querySelector('.controls');
    const controlsH = controls ? controls.offsetHeight : 0;

    const availW = Math.min(vw - 8, 1200);              // можно шире
    const availH = vh - controlsH - 8 - 8;              // больше места по высоте

    // базовый scale + лёгкое увеличение (до 10%) чтобы занять экран
    const baseScale = Math.min(availW / BASE_W, availH / BASE_H);
    const scale = Math.max(0.5, Math.min(baseScale * 1.08, 1.1)); // 0.5..1.1

    fixedLayer.style.transform = `translate(-50%, -50%) scale(${scale})`;
    scaleWrap.style.height = `${BASE_H * scale}px`;
}

/* ---------- ориентация (просим альбомную) ---------- */
function handleOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait) rotateOverlay.classList.remove('hidden');
    else rotateOverlay.classList.add('hidden');
}
window.addEventListener('resize', handleOrientation);
window.addEventListener('orientationchange', handleOrientation);

/* ---------- сцены ---------- */
function showMenu() {
    scene.classList.add('hidden');
    menu.classList.remove('hidden');
    if (currentMatch) { currentMatch.destroy(); currentMatch = null; }
    leaveQueue();
    stopTimer(); setTimer(60); updateStatus('');
}

function showMatch() {
    menu.classList.add('hidden');
    scene.classList.remove('hidden');
    scoreEl.textContent = '0 : 0';
    setTimer(60);
    updateStatus('В очереди...');
    resizeGame();
    joinQueue();
}

function startLocalMatch() {
    currentMatch = createMatch(canvas, ctx, { roomId, side, scoreEl, updateStatus });
    startTimer();
}

/* ---------- статус/таймер ---------- */
function updateStatus(t) { statusEl.textContent = t || ''; statusEl.style.display = t ? 'block' : 'none'; }
function setTimer(v) { timeLeft = v; timerEl.textContent = `${timeLeft}`; }
function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
        timeLeft -= 1;
        if (timeLeft <= 0) { setTimer(0); stopTimer(); updateStatus('⏱ Время!'); if (currentMatch) currentMatch.setPaused(true); return; }
        timerEl.textContent = `${timeLeft}`;
    }, 1000);
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

/* ---------- меню ---------- */
document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'play') showMatch();
    if (action === 'invite') { navigator.clipboard.writeText(window.location.href); alert('Ссылка скопирована!'); }
    if (action === 'wardrobe' || action === 'shop') alert('Раздел в разработке ✨');
});
document.getElementById('backToMenu').addEventListener('click', showMenu);

/* ---------- сокеты ---------- */
onMatchFound((data) => { roomId = data.roomId; side = data.side; updateStatus('Матч найден!'); setTimer(60); startLocalMatch(); });
onRoomLeft(() => { updateStatus('Соперник покинул игру'); if (currentMatch) currentMatch.setPaused(true); });

/* ---------- старт ---------- */
handleOrientation();
resizeGame();
showMenu();
