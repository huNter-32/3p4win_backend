const express = require('express');
const socketIo = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);

// 关键配置：允许所有前端连接（上线后建议限制为你的Netlify域名）
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('新用户连接:', socket.id);

  socket.on('join-room', (roomCode) => {
    if (!/^\d{4}$/.test(roomCode)) {
      socket.emit('invalid-room');
      return;
    }

    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        board: Array(15).fill().map(() => Array(15).fill(null)),
        currentTurn: 'red'
      };
    }

    const room = rooms[roomCode];
    if (room.players.length >= 3) {
      socket.emit('room-full');
      return;
    }

    const colors = ['red', 'yellow', 'green'];
    const playerColor = colors[room.players.length];
    
    socket.join(roomCode);
    room.players.push(playerColor);
    socket.emit('assign-color', playerColor);

    if (room.players.length === 3) {
      io.to(roomCode).emit('game-start', room.players);
    }
  });

  socket.on('make-move', (data) => {
    const { row, col, color, room } = data;
    const gameRoom = rooms[room];

    if (!gameRoom || color !== gameRoom.currentTurn || 
        row < 0 || row >= 15 || col < 0 || col >= 15 ||
        gameRoom.board[row][col]) {
      return;
    }

    gameRoom.board[row][col] = color;
    gameRoom.currentTurn = getNextColor(color);
    io.to(room).emit('move-made', { row, col, color });

    if (checkWin(gameRoom.board, row, col, color)) {
      io.to(room).emit('game-over', color);
      // 重置房间
      gameRoom.board = Array(15).fill().map(() => Array(15).fill(null));
      gameRoom.currentTurn = 'red';
    }
  });

  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
  });
});

// 计算下一个玩家颜色
function getNextColor(current) {
  const colors = ['red', 'yellow', 'green'];
  const currentIndex = colors.indexOf(current);
  return colors[(currentIndex + 1) % colors.length];
}

// 检查胜利条件
function checkWin(board, row, col, color) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  return directions.some(([dx, dy]) => {
    let count = 1;
    // 正向检查
    for (let i = 1; i < 4; i++) {
      const r = row + i * dx, c = col + i * dy;
      if (r >= 0 && r < 15 && c >= 
