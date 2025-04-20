const express = require('express');
const socketIo = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const rooms = {};

io.on('connection', (socket) => {
    console.log('新用户连接');
    
    socket.on('join-room', (roomCode) => {
        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [], board: Array(15).fill().map(() => Array(15).fill(null)) };
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
        io.to(roomCode).emit('player-joined', room.players);
        
        if (room.players.length === 3) {
            io.to(roomCode).emit('game-start', room.players);
        }
    });
    
    socket.on('make-move', (data) => {
        const { room, row, col, color } = data;
        const gameRoom = rooms[room];
        
        if (gameRoom && !gameRoom.board[row][col]) {
            gameRoom.board[row][col] = color;
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

function checkWin(board, row, col, color) {
    const directions = [
        [0, 1], [1, 0], [1, 1], [1, -1]
    ];
    
    for (const [dx, dy] of directions) {
        let count = 1;
        
        for (let i = 1; i < 4; i++) {
            const [r1, r2] = [row + i*dx, row - i*dx];
            const [c1, c2] = [col + i*dy, col - i*dy];
            
            if (r1 >= 0 && r1 < 15 && c1 >= 0 && c1 < 15 && board[r1][c1] === color) count++;
            if (r2 >= 0 && r2 < 15 && c2 >= 0 && c2 < 15 && board[r2][c2] === color) count++;
            
            if (count >= 4) return true;
        }
    }
    return false;
}

server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});
