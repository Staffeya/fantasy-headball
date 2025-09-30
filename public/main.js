import { joinQueue, leaveQueue, onMatchFound, onRoomLeft } from './net.js';
import { createMatch } from './match.js';

const menu = document.getElementById('menu');
const scene = document.getElementById('scene');
const backBtn = document.getElementById('backToMenu');
const statusEl = document.getElementById('status');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scaleWrap = document.querySelector('.game-scale');
const fixedLayer = document.querySelector('.game-fixed');

/* --- overlay конца матча --- */
const endOverlay = document.getElementById('endOverlay');
const endText = document.getElementById('endText');
const btnRematch = document.getElementById('btnRematch');
const btnToMenu = document.getElementById('btnToMenu');

let currentMatch = null, roomId = null, side = null;
let timerId = null, timeLeft = 60;
let ended = false; // чтобы не показывать оверлей дважды

// Базы для двух ориентаций
const LANDSCAPE = { w: 900, h: 500 };
const PORTRAIT = { w: 500, h: 900 };
let BASE = LANDSCAPE;

/* -------- РЕЖИМ/ОРИЕНТАЦИЯ -------- */
function isPortrait() {
    const vv = window.visualViewport;
    const w = vv ? vv.width : innerWidth;
    const h = vv ? vv.height : innerHeight;
    return h > w;
}

function applyBaseSize() {
    BASE = isPortrait() ? PORTRAIT : LANDSCAPE;
    canvas.width = BASE.w;
    canvas.height = BASE.h;
    fixedLayer.style.setProperty('--gw', BASE.w + 'px');
    fixedLayer.style.setProperty('--gh', BASE.h + 'px');
}

/* -------- МАСШТАБИРОВАНИЕ -------- */
function resizeGame() {
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;

    const controls = document.querySelector('.controls');
    const controlsH = controls ? controls.offsetHeight : 0;

    const topReserve = 88;

    const availW = Math.min(vw - 8, 1200);
    const availH = vh - controlsH - topReserve - 10;

    const baseScale = Math.min(availW / BASE.w, availH / BASE.h);
    const scale = Math.max(0.5, Math.min(baseScale * 1.04, 1.12));

    fixedLayer.style.transform = `translate(-50%, -50%) scale(${scale})`;
    scaleWrap.style.height = `${(BASE.h * scale) + topReserve}px`;
    scaleWrap.style.paddingTop = `${topReserve}px`;
}

addEventListener('resize', () => { applyBaseSize(); resizeGame(); }, { passive: true });
addEventListener('orientationchange', () => setTimeout(() => { applyBaseSize(); resizeGame(); }, 100), { passive: true });
if (window.visualViewport) {
    visualViewport.addEventListener('resize', () => { applyBaseSize(); resizeGame(); });
    visualViewport.addEventListener('scroll', () => { applyBaseSize(); resizeGame(); });
}

/* -------- Статус/таймер -------- */
function updateStatus(t) {
    statusEl.textContent = t || '';
    statusEl.style.display = t ? 'block' : 'none';
}

function setTimer(v) {
    timeLeft = Math.max(0, v | 0);
    if (currentMatch?.setTimeLeft) currentMatch.setTimeLeft(timeLeft);
}

function verdictFromScore(left, right) {
    // считаем относительно ТВОЕЙ стороны
    const you = side === 'left' ? left : right;
    const opp = side === 'left' ? right : left;
    if (you > opp) return 'Победа!';
    if (you < opp) return 'Поражение';
    return 'Ничья';
}

function showEndOverlay(title) {
    endText.textContent = title || 'Итог';
    endOverlay.classList.remove('hidden');
    btnRematch.disabled = false;
    btnToMenu.disabled = false;
    ended = true;
}
function hideEndOverlay() {
    endOverlay.classList.add('hidden');
    ended = false;
}

function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
        setTimer(timeLeft - 1);
        if (timeLeft <= 0 && !ended) {
            stopTimer();
            // берём счёт из матча и считаем вердикт
            let left = 0, right = 0;
            if (currentMatch?.getScore) {
                const s = currentMatch.getScore();
                left = s.left | 0; right = s.right | 0;
            }
            const v = verdictFromScore(left, right);
            showEndOverlay(`${v} (${left}:${right})`);
            currentMatch?.setPaused?.(true);
            updateStatus('');
        }
    }, 1000);
}
function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
}

/* -------- Сцены -------- */
function showMenu() {
    scene.classList.add('hidden');
    menu.classList.remove('hidden');
    if (currentMatch?.destroy) { currentMatch.destroy(); currentMatch = null; }
    leaveQueue();
    stopTimer();
    setTimer(60);
    updateStatus('');
    hideEndOverlay();
}

function showMatch() {
    menu.classList.add('hidden');
    scene.classList.remove('hidden');
    setTimer(60);
    updateStatus('В очереди...');
    applyBaseSize();
    resizeGame();
    hideEndOverlay();
    joinQueue();
}

/* кнопка «Меню» */
backBtn.addEventListener('click', showMenu);

/* overlay кнопки */
btnRematch.addEventListener('click', () => {
    btnRematch.disabled = true;
    btnToMenu.disabled = true;
    showMatch();
});
btnToMenu.addEventListener('click', () => {
    btnRematch.disabled = true;
    btnToMenu.disabled = true;
    showMenu();
});

/* -------- Сокеты -------- */
onMatchFound((data) => {
    roomId = data.roomId;
    side = data.side;               // важно для вердикта
    updateStatus('Матч найден!');
    setTimer(60);
    currentMatch = createMatch(canvas, ctx, { roomId, side, updateStatus });
    currentMatch?.setTimeLeft?.(timeLeft);
    startTimer();
    hideEndOverlay();
});

onRoomLeft(() => {
    updateStatus('Соперник покинул игру');
    currentMatch?.setPaused?.(true);
    if (!ended) showEndOverlay('Соперник вышел');
});

/* -------- Пауза при сворачивании -------- */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        currentMatch?.setPaused?.(true);
        stopTimer();
        updateStatus('Пауза');
    } else {
        if (!ended && timeLeft > 0) {
            startTimer();
            updateStatus('');
            currentMatch?.setPaused?.(false);
        }
    }
});

/* -------- Старт -------- */
applyBaseSize();
resizeGame();
showMenu();

/* меню из главного экрана */
document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'play') showMatch();
    if (a === 'invite') { navigator.clipboard.writeText(location.href); alert('Ссылка скопирована!'); }
    if (a === 'wardrobe' || a === 'shop') alert('Раздел в разработке ✨');
});
