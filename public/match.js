import { sendInput, onOpponentInput, sendGoal, onOpponentGoal } from './net.js';

/** Simple arcade physics for 2 players and a ball */
export function createMatch(canvas, ctx, { roomId, side, scoreEl, updateStatus }) {
    const W = canvas.width;
    const H = canvas.height;

    const groundY = H - 40;
    const goalWidth = 80, goalHeight = 120;

    const inputState = { left: false, right: false, jump: false, kick: false };
    const opponentInput = { left: false, right: false, jump: false, kick: false };

    const me = player(side === 'left' ? 120 : W - 120, groundY, side);
    const foe = player(side === 'left' ? W - 120 : 120, groundY, side === 'left' ? 'right' : 'left');
    const ball = entity(W / 2, groundY - 50, 14);

    let scoreL = 0, scoreR = 0;
    let lastKickAt = 0;
    let running = true;

    // Keyboard
    window.addEventListener('keydown', onDown, { passive: false });
    window.addEventListener('keyup', onUp, { passive: false });

    // Touch controls
    document.querySelectorAll('.ctrl').forEach(btn => {
        const code = btn.dataset.key;
        const set = (v) => setKey(code, v);
        btn.addEventListener('pointerdown', () => set(true));
        btn.addEventListener('pointerup', () => set(false));
        btn.addEventListener('pointerleave', () => set(false));
        btn.addEventListener('pointercancel', () => set(false));
    });

    function onDown(e) { if (['ArrowLeft', 'ArrowRight', 'Space', 'KeyX'].includes(e.code)) e.preventDefault(); setKey(e.code, true); }
    function onUp(e) { setKey(e.code, false); }

    function setKey(code, pressed) {
        if (code === 'ArrowLeft') inputState.left = pressed;
        if (code === 'ArrowRight') inputState.right = pressed;
        if (code === 'Space') inputState.jump = pressed;
        if (code === 'KeyX') inputState.kick = pressed;
    }

    // Network listeners
    onOpponentInput((state) => { Object.assign(opponentInput, state); });
    onOpponentGoal(({ by }) => {
        if (by === 'left') scoreL++; else scoreR++;
        scoreEl.textContent = `${scoreL} : ${scoreR}`;
        resetPositions();
        updateStatus('ГОЛ!');
        setTimeout(() => updateStatus(''), 800);
    });

    function broadcastInput() { sendInput(roomId, inputState); }

    function resetPositions() {
        me.x = side === 'left' ? 120 : W - 120;
        me.y = groundY; me.vx = me.vy = 0;
        foe.x = side === 'left' ? W - 120 : 120;
        foe.y = groundY; foe.vx = foe.vy = 0;
        ball.x = W / 2; ball.y = groundY - 60; ball.vx = 0; ball.vy = 0;
    }

    function player(x, y, side) { return { x, y, r: 24, vx: 0, vy: 0, onGround: true, side }; }
    function entity(x, y, r) { return { x, y, r, vx: 0, vy: 0 }; }

    const GRAV = 0.8, FRICTION = 0.92, MOVE = 2.3, JUMP = -12, KICK_POWER = 9;

    let lastTime = performance.now();
    function loop(t) {
        if (!running) return;
        const dt = Math.min(32, t - lastTime);
        lastTime = t;

        step(dt / 16);
        draw();
        requestAnimationFrame(loop);
    }

    function step(dt) {
        control(me, inputState);
        control(foe, opponentInput);

        applyPhysics(me); applyPhysics(foe); applyBall(ball);

        collideCircle(ball, me); collideCircle(ball, foe);

        if (inputState.kick && performance.now() - lastKickAt > 250) {
            tryKick(me); lastKickAt = performance.now();
        }
        if (opponentInput.kick && Math.random() < 0.2) tryKick(foe);

        if (isGoal(ball, 'left')) {
            scoreR++; scoreEl.textContent = `${scoreL} : ${scoreR}`;
            sendGoal(roomId, 'right'); resetPositions(); flashGoal();
        } else if (isGoal(ball, 'right')) {
            scoreL++; scoreEl.textContent = `${scoreL} : ${scoreR}`;
            sendGoal(roomId, 'left'); resetPositions(); flashGoal();
        }

        broadcastInput();
    }

    function flashGoal() { updateStatus('ГОЛ!'); setTimeout(() => updateStatus(''), 800); }

    function control(p, state) {
        if (state.left) p.vx -= MOVE;
        if (state.right) p.vx += MOVE;
        if (state.jump && p.onGround) { p.vy = JUMP; p.onGround = false; }
    }

    function applyPhysics(p) {
        p.vy += GRAV; p.x += p.vx; p.y += p.vy;
        if (p.y > groundY) { p.y = groundY; p.vy = 0; p.onGround = true; }
        if (p.x < p.r) { p.x = p.r; p.vx = 0; }
        if (p.x > canvas.width - p.r) { p.x = canvas.width - p.r; p.vx = 0; }
        p.vx *= FRICTION; if (Math.abs(p.vx) < 0.05) p.vx = 0;
    }

    function applyBall(b) {
        b.vy += GRAV; b.x += b.vx; b.y += b.vy;
        if (b.x < b.r) { b.x = b.r; b.vx *= -0.9; }
        if (b.x > canvas.width - b.r) { b.x = canvas.width - b.r; b.vx *= -0.9; }
        if (b.y < b.r) { b.y = b.r; b.vy *= -0.9; }
        if (b.y > groundY - 2) { b.y = groundY - 2; b.vy *= -0.85; b.vx *= 0.98; }
        const crossbarY = groundY - goalHeight;
        if (b.y - b.r < crossbarY && ((b.x < goalWidth) || (b.x > canvas.width - goalWidth))) {
            b.y = crossbarY + b.r; b.vy = Math.abs(b.vy) * 0.5;
        }
    }

    function collideCircle(b, p) {
        const dx = b.x - p.x, dy = b.y - p.y;
        const dist = Math.hypot(dx, dy), minDist = b.r + p.r;
        if (dist < minDist) {
            const nx = dx / (dist || 1), ny = dy / (dist || 1), overlap = minDist - dist;
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
            ball.vx += Math.cos(ang) * KICK_POWER + dir * 2;
            ball.vy += Math.sin(ang) * KICK_POWER - 2;
        }
    }

    function isGoal(b, side) {
        const withinPost = b.y > groundY - goalHeight + 10;
        if (!withinPost) return false;
        if (side === 'left') return b.x < b.r + 2 && b.y > groundY - goalHeight + 10;
        else return b.x > canvas.width - b.r - 2 && b.y > groundY - goalHeight + 10;
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#2a3a61';
        ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(canvas.width, groundY); ctx.stroke();
        drawPortal(0, groundY, goalWidth, goalHeight, '#7b9dff');
        drawPortal(canvas.width - goalWidth, groundY, goalWidth, goalHeight, '#ff7bf2');
        drawBall(ball);
        drawPlayer(me, '#7b9dff'); drawPlayer(foe, '#ff7bf2');
    }

    function drawPortal(x0, gy, w, h, color) {
        ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(x0 + 5, gy - h, w - 10, h, 12); ctx.stroke(); ctx.fill(); ctx.restore();
    }
    function drawBall(b) {
        ctx.save(); ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#e8eefc'; ctx.fill(); ctx.strokeStyle = '#2a3a61'; ctx.stroke(); ctx.restore();
    }
    function drawPlayer(p, color) {
        ctx.save();
        ctx.beginPath(); ctx.arc(p.x, p.y - p.r, p.r + 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(123,157,255,0.08)'; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y - p.r, p.r, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(p.x - 8, p.y - p.r - 6, 6, 4);
        ctx.fillRect(p.x + 2, p.y - p.r - 6, 6, 4);
        ctx.restore();
    }

    requestAnimationFrame(loop);

    return {
        destroy() { running = false; },
        setPaused(v) { running = !v; }
    };
}
