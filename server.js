const express = require('express');
const socketIo = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const rooms = {}; // 存储房间数据

io.on('connection', (socket) => {
    console.log('新用户连接');

    socket.on('join-room', (roomCode) => {
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

        if (gameRoom && color === gameRoom.currentTurn && !gameRoom.board[row][col]) {
            gameRoom.board[row][col] = color;
            gameRoom.currentTurn = getNextColor(color);

            io.to(room).emit('move-made', { row, col, color });

            if (checkWin(gameRoom.board, row, col, color)) {
                io.to(room).emit('game-over', color);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('用户断开连接');
    });
});

function getNextColor(current) {
    const colors = ['red', 'yellow', 'green'];
    const currentIndex = colors.indexOf(current);
    return colors[(currentIndex + 1) % colors.length];
}

function checkWin(board, row, col, color) {
    const directions = [
        [0, 1],   // 水平
        [1, 0],    // 垂直
        [1, 1],    // 对角线
        [1, -1]    // 反对角线
    ];

    for (const [dx, dy] of directions) {
        let count = 1;

        // 正向检查
        for (let i = 1; i < 4; i++) {
            const newRow = row + i * dx;
            const newCol = col + i * dy;
            if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15 &&
                board[newRow][newCol] === color) {
                count++;
            } else {
                break;
            }
        }

        // 反向检查
        for (let i = 1; i < 4; i++) {
            const newRow = row - i * dx;
            const newCol = col - i * dy;
            if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15 &&
                board[newRow][newCol] === color) {
                count++;
            } else {
                break;
            }
        }

        if (count >= 4) return true;
    }

    return false;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});