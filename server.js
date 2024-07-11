const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('public'));

const rooms = new Map();
const gridSize = 20;
const canvasSize = 350;  // 캔버스 크기를 350으로 변경
const gridWidth = canvasSize / gridSize;

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('createRoom', () => {
    const roomCode = generateRoomCode();
    rooms.set(roomCode, { players: [], foods: [], gameStarted: false });
    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
  });

  socket.on('joinRoom', (roomCode) => {
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      if (room.players.length < 4 && !room.gameStarted) {
        socket.join(roomCode);
        const playerIndex = room.players.length;
        const startPositions = [
          { x: Math.floor(gridWidth / 4), y: Math.floor(gridWidth / 4) },
          { x: Math.floor(gridWidth * 3 / 4), y: Math.floor(gridWidth / 4) },
          { x: Math.floor(gridWidth / 4), y: Math.floor(gridWidth * 3 / 4) },
          { x: Math.floor(gridWidth * 3 / 4), y: Math.floor(gridWidth * 3 / 4) }
        ];
        const player = {
          id: socket.id,
          segments: [{ 
            x: startPositions[playerIndex].x, 
            y: startPositions[playerIndex].y 
          }],
          color: ['red', 'green', 'blue', 'yellow'][playerIndex],
          direction: { x: 1, y: 0 },
          score: 0,
          alive: true
        };
        room.players.push(player);
        socket.emit('joinedRoom', { roomCode, playerIndex });
        io.to(roomCode).emit('playerJoined', room.players.length);
      } else {
        socket.emit('roomFull');
      }
    } else {
      socket.emit('roomNotFound');
    }
  });

  // 나머지 코드는 동일하게 유지
  // ...
});

function generateFood() {
  return {
    x: Math.floor(Math.random() * gridWidth),
    y: Math.floor(Math.random() * gridWidth)
  };
}

function gameLoop(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.players.forEach(player => {
    if (!player.alive) return;

    const newHead = {
      x: (player.segments[0].x + player.direction.x + gridWidth) % gridWidth,
      y: (player.segments[0].y + player.direction.y + gridWidth) % gridWidth
    };

    // 충돌 체크 로직
    // ...

    if (!player.alive) return;

    const foodIndex = room.foods.findIndex(food => food.x === newHead.x && food.y === newHead.y);
    if (foodIndex !== -1) {
      room.foods.splice(foodIndex, 1);
      room.foods.push(generateFood());
      player.score += 10;
    } else {
      player.segments.pop();
    }

    player.segments.unshift(newHead);
  });

  // 게임 종료 조건 확인
  // ...

  io.to(roomCode).emit('gameState', { players: room.players, foods: room.foods });

  setTimeout(() => gameLoop(roomCode), 100);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
