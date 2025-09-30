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

let currentMatch = null;
let roomId = null;
let side = null;
let timerId = null;
let timeLeft = 60; // секунд на матч

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
    joinQueue();
}

function startLocalMatch() {
    currentMatch = createMatch(canvas, ctx, { roomId, side, scoreEl, updateStatus });
    startTimer();
}

function handleOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait) rotateOverlay.classList.remove('hidden');
    else rotateOverlay.classList.add('hidden');
}
window.addEventListener('resize', handleOrientation);
window.addEventListener('orientationchange', handleOrientation);
handleOrientation();

function updateStatus(text) {
    statusEl.textContent = text || '';
    statusEl.style.display = text ? 'block' : 'none';
}

function setTimer(v) {
    timeLeft = v;
    timerEl.textContent = `${timeLeft}`;
}
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
function stopTimer() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
}

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
    setTimer(60);
    startLocalMatch();
});

onRoomLeft(() => {
    updateStatus('Соперник покинул игру');
    if (currentMatch) currentMatch.setPaused(true);
});

// Initial scene
showMenu();
