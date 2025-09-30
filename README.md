# Fantasy Headball — Telegram WebApp (Node + Express + Socket.IO + Telegraf)

## Старт

1) `cp .env.example .env` и заполните:
   - `BOT_TOKEN` — токен бота Telegram.
   - `APP_URL` — внешний URL, где доступно приложение (например, https://example.com).
   - `PORT` — порт сервера.

2) Установка:
```bash
npm i
```

3) Запуск в разработке:
```bash
npm run dev
```
Откроется сервер на `http://localhost:3000` (если `PORT=3000`).

4) В @BotFather включите Web App кнопку: достаточно, чтобы бот отправлял клавиатуру с кнопкой, открывающей `APP_URL`.
   При старте бот отправляет пользователю кнопку "Играть" с `web_app` url.

---

## Структура
```
server/index.js          # сервер Express + Socket.IO + бот Telegraf
public/index.html        # главная страница и сцена игры
public/style.css         # стили
public/main.js           # управление сценами и UI
public/match.js          # физика и отрисовка игры
public/net.js            # обёртки Socket.IO
.env                     # конфиг окружения
```

## Сокет-события
- `queue:join` — вход в очередь
- `queue:leave` — выход из очереди
- `match:found` — матч найден (roomId, side)
- `input` — инпут игрока (кнопки/состояние)
- `goal` — гол (автор, счёт)
- `opponent:input` — данные соперника
- `opponent:goal` — уведомление о голе соперника
- `room:left` — соперник покинул комнату

---

## Примечания
- Для продакшн используйте HTTPS и вебхук Telegraf. В примере — polling.
- Вся физика локальна/аркадная и синхронизируется простыми инпутами через сеть.
