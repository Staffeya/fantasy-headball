/** net.js — simple Socket.IO wrappers */
export const socket = io();

export function joinQueue() {
  socket.emit('queue:join');
}

export function leaveQueue() {
  socket.emit('queue:leave');
}

export function onMatchFound(handler) {
  socket.on('match:found', handler);
}

export function sendInput(roomId, state) {
  socket.emit('input', { roomId, state });
}

export function onOpponentInput(handler) {
  socket.on('opponent:input', handler);
}

export function sendGoal(roomId, by) {
  socket.emit('goal', { roomId, by });
}

export function onOpponentGoal(handler) {
  socket.on('opponent:goal', handler);
}

export function onRoomLeft(handler) {
  socket.on('room:left', handler);
}
