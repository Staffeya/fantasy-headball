import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Telegraf, Markup } from 'telegraf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const BOT_TOKEN = process.env.BOT_TOKEN;

const app = express();
app.use(cors());
app.use(express.json());

/** ✅ Убираем предупреждение ngrok free (interstitial) */
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// === Simple Matchmaking Queue ===
const queue = [];
const rooms = new Map(); // roomId -> { players: [socketIdA, socketIdB] }

function tryMatchPlayers() {
    while (queue.length >= 2) {
        const a = queue.shift();
        const b = queue.shift();
        if (!a?.connected) continue;
        if (!b?.connected) { queue.unshift(a); continue; }

        const roomId = `room_${a.id.slice(0, 5)}_${b.id.slice(0, 5)}_${Date.now()}`;
        a.join(roomId);
        b.join(roomId);
        rooms.set(roomId, { players: [a.id, b.id] });

        // Assign sides
        const [leftId, rightId] = Math.random() < 0.5 ? [a.id, b.id] : [b.id, a.id];
        io.to(leftId).emit('match:found', { roomId, side: 'left' });
        io.to(rightId).emit('match:found', { roomId, side: 'right' });
    }
}

io.on('connection', (socket) => {
    // console.log('Socket connected', socket.id);

    socket.on('queue:join', () => {
        if (!queue.includes(socket)) {
            queue.push(socket);
            tryMatchPlayers();
        }
    });

    socket.on('queue:leave', () => {
        const idx = queue.indexOf(socket);
        if (idx !== -1) queue.splice(idx, 1);
    });

    socket.on('input', ({ roomId, state }) => {
        socket.to(roomId).emit('opponent:input', state);
    });

    socket.on('goal', ({ roomId, by }) => {
        socket.to(roomId).emit('opponent:goal', { by });
    });

    socket.on('disconnecting', () => {
        // Remove from queue if present
        const idx = queue.indexOf(socket);
        if (idx !== -1) queue.splice(idx, 1);

        // Inform rooms
        for (const roomId of socket.rooms) {
            if (roomId === socket.id) continue;
            socket.to(roomId).emit('room:left');
            rooms.delete(roomId);
        }
    });
});

// === Telegram Bot ===
if (!BOT_TOKEN) {
    console.warn('BOT_TOKEN not set. Bot disabled.');
} else {
    const bot = new Telegraf(BOT_TOKEN);

    bot.start((ctx) => {
        return ctx.reply('Добро пожаловать в Fantasy Headball!',
            Markup.keyboard([
                [Markup.button.webApp('🎮 Играть', APP_URL)]
            ]).resize()
        );
    });

    bot.hears(/игра|play|start/i, (ctx) => {
        return ctx.reply('Открывай игру 👇', Markup.inlineKeyboard([
            Markup.button.webApp('Открыть WebApp', APP_URL)
        ]));
    });

    bot.launch().then(() => console.log('Telegram bot launched'));
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// === Fallback route (SPA-style) ===
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
