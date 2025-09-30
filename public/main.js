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

let currentMatch = null;
let roomId = null;
let side = null;
let timerId = null;
let timeLeft = 60; // секунд на матч

/* ---------- масштабирование всей сцены (канва + HUD) ---------- */
const BASE_W = 900, BASE_H = 500;

function resizeGame() {
    // сколько места доступно по высоте (минус панель управления и отступы)
    const controls = document.querySelector('.controls');
    const controlsHeight = controls?.offsetHeight || 0;

    // немного запасов наверху/снизу
    const topSafe = 6 + Math.max(0, (window.visualViewport?.offsetTop || 0));
    const bottomSafe = 6 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)')) || 0);

    const availableW = Math.min(window.innerWidth - 12, 1000);
    const availableH = window.innerHeight - controlsHeight - topSafe - bottomSafe - 12;

    const scale = Math.max(0.5, Math.min(availableW / BASE_W, availableH / BASE_H));

    // применяем масштаб к фиксированному слою
    fixedLayer.style.transform = `scale(${scale})`;
    fixedLayer.style.transformOrigin = 'top center';

    // чтобы контейнер занимал правильное место по потоку
    scaleWrap.style.height = `${BASE_H * scale}px`;
}

window.addEventListener('resize', resizeGame);
window.addEventListener('orientationchange', () => { setTimeout(resizeGame, 100); });
window.addEventListener('load', resizeGame);

/* ---------- ориентация ---------- */
function handleOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait) rotateOverlay.classList.remove('hidden');
    else rotateOverlay.classList.add('hidden');
}
window.addEventListener('resize', handleOrientation);
window.addEventListener('orientationchange', handleOrientation);
handleOrientation();

/* ---------- сценки ---------- */
function showMenu() {
    scene.classList.add('hidden');
    menu.classList.remove('hidden');
    if (currentMatch) {
        currentMatch.destroy();
        currentMatch = null;
    }
    leaveQueue();
    stopTimer();
    setTimer(60);
    updateStatus('');
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

function updateStatus(text) {
    statusEl.textContent = text || '';
    statusEl.style.display = text ? 'block' : 'none';
}

/* ---------- таймер ---------- */
function setTimer(v) { timeLeft = v; timerEl.textContent = `${timeLeft}`; }
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

/* ---------- сокеты ---------- */
onMatchFound((data) => {
    roomId = data.roomId;
    side = data.side;
    updateStatus('Матч найден!');
    setTimer(60);
    startLocalMatch();
});
onRoomLeft(() => {
    updateStatus('Соперник покинул игру');
    if (currentMatch) currentMatch.setPaused(true);
});

/* ---------- старт ---------- */
showMenu();
