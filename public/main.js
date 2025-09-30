import { joinQueue, leaveQueue, onMatchFound, onRoomLeft } from './net.js';
import { createMatch } from './match.js';

const menu = document.getElementById('menu');
const scene = document.getElementById('scene');
const backBtn = document.getElementById('backToMenu');
const rotateOverlay = document.getElementById('rotate');
const statusEl = document.getElementById('status');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scaleWrap = document.querySelector('.game-scale');
const fixedLayer = document.querySelector('.game-fixed');

let currentMatch = null, roomId = null, side = null;
let timerId = null, timeLeft = 60;

const BASE_W = 900, BASE_H = 500;

/* ---------- масштабирование (contain) ---------- */
function getViewportSize() { const vv = window.visualViewport; return vv ? { w: vv.width, h: vv.height } : { w: innerWidth, h: innerHeight }; }
function resizeGame() {
    const { w, h } = getViewportSize();
    const controls = document.querySelector('.controls');
    const controlsH = controls ? controls.offsetHeight : 0;

    const availW = Math.min(w - 8, 1200);
    const availH = h - controlsH - 8 - 8;

    const base = Math.min(availW / BASE_W, availH / BASE_H);
    const scale = Math.max(0.5, Math.min(base * 1.08, 1.1));

    fixedLayer.style.transform = `translate(-50%, -50%) scale(${scale})`;
    scaleWrap.style.height = `${BASE_H * scale}px`;
}
addEventListener('resize', resizeGame, { passive: true });
addEventListener('orientationchange', () => setTimeout(resizeGame, 100), { passive: true });
if (window.visualViewport) {
    visualViewport.addEventListener('resize', resizeGame);
    visualViewport.addEventListener('scroll', resizeGame);
}

/* ---------- ориентация ---------- */
function handleOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    rotateOverlay.classList.toggle('hidden', !isPortrait);
}
addEventListener('resize', handleOrientation);
addEventListener('orientationchange', handleOrientation);

/* ---------- статус ---------- */
function updateStatus(t) { statusEl.textContent = t || ''; statusEl.style.display = t ? 'block' : 'none'; }

/* ---------- таймер ---------- */
function setTimer(v) { timeLeft = v; if (currentMatch) currentMatch.setTimeLeft(timeLeft); }
function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
        timeLeft -= 1;
        if (timeLeft <= 0) {
            setTimer(0);
            stopTimer();
            updateStatus('⏱ Время!');
            if (currentMatch) currentMatch.setPaused(true);
            return;
        }
        if (currentMatch) currentMatch.setTimeLeft(timeLeft);
    }, 1000);
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

/* ---------- сцены ---------- */
function showMenu() {
    scene.classList.add('hidden');
    menu.classList.remove('hidden');
    if (currentMatch) { currentMatch.destroy(); currentMatch = null; }
    leaveQueue(); stopTimer(); setTimer(60); updateStatus('');
}
function showMatch() {
    menu.classList.add('hidden');
    scene.classList.remove('hidden');
    setTimer(60);
    updateStatus('В очереди...');
    resizeGame();
    joinQueue();
}

backBtn.addEventListener('click', showMenu);

/* ---------- сокеты ---------- */
onMatchFound((data) => {
    roomId = data.roomId; side = data.side;
    updateStatus('Матч найден!');
    setTimer(60);
    currentMatch = createMatch(canvas, ctx, { roomId, side, updateStatus });
    currentMatch.setTimeLeft(timeLeft);
    startTimer();
});
onRoomLeft(() => { updateStatus('Соперник покинул игру'); if (currentMatch) currentMatch.setPaused(true); });

/* ---------- старт ---------- */
handleOrientation();
resizeGame();
showMenu();

// меню кнопки в index.html остаются без изменений
document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'play') showMatch();
    if (a === 'invite') { navigator.clipboard.writeText(location.href); alert('Ссылка скопирована!'); }
    if (a === 'wardrobe' || a === 'shop') alert('Раздел в разработке ✨');
});
