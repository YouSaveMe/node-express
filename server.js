const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('public'));

const rooms = new Map();
const gridSize = 20;
const canvasSize = 400;

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
          { x: 0, y: 0 },
          { x: canvasSize - gridSize, y: 0 },
          { x: 0, y: canvasSize - gridSize },
          { x: canvasSize - gridSize, y: canvasSize - gridSize }
        ];
        const player = {
          id: socket.id,
          x: startPositions[playerIndex].x,
          y: startPositions[playerIndex].y,
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

  socket.on('startGame', (roomCode) => {
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      room.gameStarted = true;
      room.foods = generateFoods(room.players.length);
      io.to(roomCode).emit('gameStarted', { players: room.players, foods: room.foods });
      gameLoop(roomCode);
    }
  });

  socket.on('changeDirection', ({ roomCode, direction }) => {
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      const player = room.players.find(p => p.id === socket.id);
      if (player && player.alive) {
        player.direction = direction;
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    rooms.forEach((room, roomCode) => {
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomCode).emit('playerLeft', room.players.length);
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else if (room.gameStarted) {
          // 게임 중 플레이어가 나가면 먹이 수를 조정
          room.foods = adjustFoodCount(room.foods, room.players.length);
        }
      }
    });
  });
});

function generateFoods(count) {
  const foods = [];
  for (let i = 0; i < count; i++) {
    foods.push(generateFood());
  }
  return foods;
}

function generateFood() {
  return {
    x: Math.floor(Math.random() * (canvasSize / gridSize)) * gridSize,
    y: Math.floor(Math.random() * (canvasSize / gridSize)) * gridSize
  };
}

function adjustFoodCount(foods, playerCount) {
  if (foods.length > playerCount) {
    return foods.slice(0, playerCount);
  } else if (foods.length < playerCount) {
    while (foods.length < playerCount) {
      foods.push(generateFood());
    }
  }
  return foods;
}

function gameLoop(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.players.forEach(player => {
    if (!player.alive) return;

    player.x += player.direction.x * gridSize;
    player.y += player.direction.y * gridSize;

    player.x = (player.x + canvasSize) % canvasSize;
    player.y = (player.y + canvasSize) % canvasSize;

    // 충돌 감지
    room.players.forEach(otherPlayer => {
      if (otherPlayer !== player && otherPlayer.alive && otherPlayer.x === player.x && otherPlayer.y === player.y) {
        player.alive = false;
      }
    });

    // 먹이 먹기
    const foodIndex = room.foods.findIndex(food => food.x === player.x && food.y === player.y);
    if (foodIndex !== -1) {
      room.foods.splice(foodIndex, 1);
      room.foods.push(generateFood());
      player.score += 10;
    }
  });

  // 게임 종료 조건 확인
  const alivePlayers = room.players.filter(player => player.alive);
  if (alivePlayers.length <= 1) {
    const rankings = room.players.sort((a, b) => b.score - a.score);
    io.to(roomCode).emit('gameOver', rankings);
    rooms.delete(roomCode);
    return;
  }

  io.to(roomCode).emit('gameState', { players: room.players, foods: room.foods });

  setTimeout(() => gameLoop(roomCode), 100);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
