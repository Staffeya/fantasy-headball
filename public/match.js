import { sendInput, onOpponentInput, sendGoal, onOpponentGoal } from './net.js';

export function createMatch(canvas, ctx, { roomId, side, updateStatus }) {
    const W = canvas.width, H = canvas.height;
    const groundY = H - 40, goalWidth = 80, goalHeight = 120;

    const inputState = { left: false, right: false, jump: false, kick: false };
    const opponentInput = { left: false, right: false, jump: false, kick: false };

    const me = player(side === 'left' ? 120 : W - 120, groundY, side);
    const foe = player(side === 'left' ? W - 120 : 120, groundY, side === 'left' ? 'right' : 'left');
    const ball = entity(W / 2, groundY - 50, 14);

    let scoreL = 0, scoreR = 0;
    let timeLeft = 60;
    let lastKickAt = 0;
    let running = true;

    // ======= управление
    addEventListener('keydown', onDown, { passive: false });
    addEventListener('keyup', onUp, { passive: false });
    document.querySelectorAll('.ctrl').forEach(btn => {
        const code = btn.dataset.key, set = (v) => setKey(code, v);
        btn.addEventListener('pointerdown', () => set(true));
        btn.addEventListener('pointerup', () => set(false));
        btn.addEventListener('pointerleave', () => set(false));
        btn.addEventListener('pointercancel', () => set(false));
    });
    function onDown(e) { if (['ArrowLeft', 'ArrowRight', 'Space', 'KeyX'].includes(e.code)) e.preventDefault(); setKey(e.code, true); }
    function onUp(e) { setKey(e.code, false); }
    function setKey(code, v) { if (code === 'ArrowLeft') inputState.left = v; if (code === 'ArrowRight') inputState.right = v; if (code === 'Space') inputState.jump = v; if (code === 'KeyX') inputState.kick = v; }

    // ======= сеть
    onOpponentInput((state) => Object.assign(opponentInput, state));
    onOpponentGoal(({ by }) => {
        if (by === 'left') scoreL++; else scoreR++;
        resetPositions(); flashGoal();
    });

    function broadcastInput() { sendInput(roomId, inputState); }

    function resetPositions() {
        me.x = side === 'left' ? 120 : W - 120; me.y = groundY; me.vx = me.vy = 0;
        foe.x = side === 'left' ? W - 120 : 120; foe.y = groundY; foe.vx = foe.vy = 0;
        ball.x = W / 2; ball.y = groundY - 60; ball.vx = 0; ball.vy = 0;
    }

    function player(x, y, side) { return { x, y, r: 24, vx: 0, vy: 0, onGround: true, side }; }
    function entity(x, y, r) { return { x, y, r, vx: 0, vy: 0 }; }

    // ======= «мягкая» физика
    const GRAV = 0.6;
    const FRICTION = 0.90;
    const MOVE = 1.6;
    const JUMP = -9.5;
    const KICK_POWER = 6;

    let lastTime = performance.now();
    function loop(t) {
        if (!running) return;
        const dt = Math.min(32, t - lastTime); lastTime = t;
        step(dt / 16); draw();
        requestAnimationFrame(loop);
    }

    function step(dt) {
        control(me, inputState);
        control(foe, opponentInput);

        applyPhysics(me); applyPhysics(foe); applyBall(ball);

        collideCircle(ball, me); collideCircle(ball, foe);

        if (inputState.kick && performance.now() - lastKickAt > 250) { tryKick(me); lastKickAt = performance.now(); }
        if (opponentInput.kick && Math.random() < 0.2) tryKick(foe);

        if (isGoal(ball, 'left')) { scoreR++; resetPositions(); flashGoal(); sendGoal(roomId, 'right'); }
        else if (isGoal(ball, 'right')) { scoreL++; resetPositions(); flashGoal(); sendGoal(roomId, 'left'); }

        broadcastInput();
    }

    function flashGoal() { updateStatus('ГОЛ!'); setTimeout(() => updateStatus(''), 800); }

    function control(p, s) { if (s.left) p.vx -= MOVE; if (s.right) p.vx += MOVE; if (s.jump && p.onGround) { p.vy = JUMP; p.onGround = false; } }
    function applyPhysics(p) {
        p.vy += GRAV; p.x += p.vx; p.y += p.vy;
        if (p.y > groundY) { p.y = groundY; p.vy = 0; p.onGround = true; }
        if (p.x < p.r) { p.x = p.r; p.vx = 0; }
        if (p.x > W - p.r) { p.x = W - p.r; p.vx = 0; }
        p.vx *= FRICTION; if (Math.abs(p.vx) < 0.05) p.vx = 0;
    }
    function applyBall(b) {
        b.vy += GRAV; b.x += b.vx; b.y += b.vy;
        if (b.x < b.r) { b.x = b.r; b.vx *= -0.75; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx *= -0.75; }
        if (b.y < b.r) { b.y = b.r; b.vy *= -0.75; }
        if (b.y > groundY - 2) { b.y = groundY - 2; b.vy *= -0.65; b.vx *= 0.96; }
        const crossbarY = groundY - goalHeight;
        if (b.y - b.r < crossbarY && ((b.x < goalWidth) || (b.x > W - goalWidth))) {
            b.y = crossbarY + b.r; b.vy = Math.abs(b.vy) * 0.5;
        }
    }
    function collideCircle(b, p) {
        const dx = b.x - p.x, dy = b.y - p.y, dist = Math.hypot(dx, dy), min = b.r + p.r;
        if (dist < min) {
            const nx = dx / (dist || 1), ny = dy / (dist || 1), overlap = min - dist;
            b.x += nx * overlap; b.y += ny * overlap;
            const relVx = b.vx - p.vx, relVy = b.vy - p.vy, dot = relVx * nx + relVy * ny;
            b.vx -= 1.5 * dot * nx; b.vy -= 1.5 * dot * ny;
            b.vx += p.vx * 0.2; b.vy += p.vy * 0.2;
        }
    }
    function tryKick(p) {
        const dx = ball.x - p.x, dy = ball.y - p.y, dist = Math.hypot(dx, dy);
        if (dist < p.r + ball.r + 10) {
            const ang = Math.atan2(dy, dx), dir = p.side === 'left' ? 1 : -1;
            ball.vx += Math.cos(ang) * KICK_POWER + dir * 1.5;
            ball.vy += Math.sin(ang) * KICK_POWER - 1.2;
        }
    }
    function isGoal(b, side) {
        const within = b.y > groundY - goalHeight + 10; if (!within) return false;
        return side === 'left' ? (b.x < b.r + 2) : (b.x > W - b.r - 2);
    }

    // ======= РИСОВАНИЕ (включая HUD на canvas)
    function draw() {
        ctx.clearRect(0, 0, W, H);
        // ground
        ctx.strokeStyle = '#2a3a61';
        ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();
        // goals
        drawPortal(0, groundY, goalWidth, goalHeight, '#7b9dff');
        drawPortal(W - goalWidth, groundY, goalWidth, goalHeight, '#ff7bf2');
        // entities
        drawBall(ball);
        drawPlayer(me, '#7b9dff'); drawPlayer(foe, '#ff7bf2');
        // HUD (score + timer по центру)
        drawHUD();
    }

    function drawPortal(x0, gy, w, h, color) {
        ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(x0 + 5, gy - h, w - 10, h, 12); ctx.stroke(); ctx.fill(); ctx.restore();
    }
    function drawBall(b) { ctx.save(); ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fillStyle = '#e8eefc'; ctx.fill(); ctx.strokeStyle = '#2a3a61'; ctx.stroke(); ctx.restore(); }
    function drawPlayer(p, color) {
        ctx.save();
        ctx.beginPath(); ctx.arc(p.x, p.y - p.r, p.r + 8, 0, Math.PI * 2); ctx.fillStyle = 'rgba(123,157,255,0.08)'; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y - p.r, p.r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
        ctx.fillStyle = '#0b1220'; ctx.fillRect(p.x - 8, p.y - p.r - 6, 6, 4); ctx.fillRect(p.x + 2, p.y - p.r - 6, 6, 4);
        ctx.restore();
    }

    function drawHUD() {
        // координаты центра
        const cx = W / 2;

        // значения
        const scoreText = `${scoreL} : ${scoreR}`;
        const timeText = `${timeLeft}`;

        // параметры
        const scoreY = 22;   // было 8 — опустили ниже
        const timeY = 54;   // таймер ещё ниже

        // общие стили
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // фон-плашка (капсула) под счёт
        const padX = 14, padY = 6;
        ctx.font = 'bold 28px system-ui, -apple-system, Segoe UI, Roboto';
        const scoreW = ctx.measureText(scoreText).width;
        const boxW = Math.max(74, scoreW + padX * 2);
        const boxH = 32 + padY * 2;

        // капсула
        roundRect(ctx, cx - boxW / 2, scoreY - 8, boxW, boxH, 10, 'rgba(12,18,32,0.72)', '#2a3a61');

        // сам счёт
        ctx.fillStyle = '#e8eefc';
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 4;
        ctx.strokeText(scoreText, cx, scoreY);
        ctx.fillText(scoreText, cx, scoreY);

        // таймер на маленькой плашке ниже
        ctx.font = '600 18px system-ui, -apple-system, Segoe UI, Roboto';
        const timeW = ctx.measureText(timeText).width;
        roundRect(ctx, cx - (timeW + 20) / 2, timeY - 6, timeW + 20, 26, 8, 'rgba(12,18,32,0.72)', '#2a3a61');
        ctx.strokeText(timeText, cx, timeY);
        ctx.fillText(timeText, cx, timeY);

        ctx.restore();
    }

    // утилита для скруглённых прямоугольников
    function roundRect(ctx, x, y, w, h, r, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }

    requestAnimationFrame(loop);

    return {
        destroy() { running = false; },
        setPaused(v) { running = !v; },
        setTimeLeft(v) { timeLeft = v; }
    };
}
