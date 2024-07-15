const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('public'));

const rooms = new Map();
const gridSize = 20;
const canvasSize = 400;
const gridWidth = canvasSize / gridSize;

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('getRoomList', () => {
    const roomList = Array.from(rooms.entries()).map(([code, room]) => ({
      code,
      playerCount: room.players.length,
      gameStarted: room.gameStarted
    }));
    socket.emit('roomList', roomList);
  });

  socket.on('joinRoom', (roomCode) => {
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      if (room.players.length < 6 && !room.gameStarted) {
        socket.join(roomCode);
        addPlayerToRoom(socket, roomCode);
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
      if (room.players.length >= 2) {
        room.gameStarted = true;
        // 게임 시작 시 각 플레이어의 방향을 다시 랜덤하게 설정
        room.players.forEach(player => {
          player.direction = getRandomDirection();
        });
        room.foods = generateFoods(room.players.length);
        io.to(roomCode).emit('gameStarted', { players: room.players, foods: room.foods });
        gameLoop(roomCode);
      } else {
        socket.emit('notEnoughPlayers');
      }
    }
  });
  
  socket.on('changeDirection', ({ roomCode, direction }) => {
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      const player = room.players.find(p => p.id === socket.id);
      if (player && player.alive) {
        if (!(player.direction.x === -direction.x && player.direction.y === -direction.y)) {
          player.direction = direction;
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    rooms.forEach((room, roomCode) => {
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        // Reassign player numbers
        room.players.forEach((p, i) => p.number = i + 1);
        io.to(roomCode).emit('playerLeft', { 
          playerCount: room.players.length,
          players: room.players
        });
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else if (room.gameStarted) {
          room.foods = adjustFoodCount(room.foods, room.players.length);
        }
      }
    });
  });
});

// ... (이전 코드는 그대로 유지)

function getRandomDirection() {
  const directions = [
    { x: 1, y: 0 },   // 오른쪽
    { x: -1, y: 0 },  // 왼쪽
    { x: 0, y: 1 },   // 아래
    { x: 0, y: -1 }   // 위
  ];
  return directions[Math.floor(Math.random() * directions.length)];
}

function addPlayerToRoom(socket, roomCode) {
  const room = rooms.get(roomCode);
  const playerNumber = room.players.length + 1;
  const startPositions = [
    { x: Math.floor(gridWidth / 4), y: Math.floor(gridWidth / 4) },
    { x: Math.floor(gridWidth * 3 / 4), y: Math.floor(gridWidth / 4) },
    { x: Math.floor(gridWidth / 4), y: Math.floor(gridWidth * 3 / 4) },
    { x: Math.floor(gridWidth * 3 / 4), y: Math.floor(gridWidth * 3 / 4) },
    { x: Math.floor(gridWidth / 2), y: Math.floor(gridWidth / 4) },
    { x: Math.floor(gridWidth / 2), y: Math.floor(gridWidth * 3 / 4) }
  ];
  const player = {
    id: socket.id,
    number: playerNumber,
    segments: [{ 
      x: startPositions[playerNumber - 1].x, 
      y: startPositions[playerNumber - 1].y 
    }],
    color: ['white', 'green', 'blue', 'yellow', 'purple', 'orange'][playerNumber - 1],
    direction: getRandomDirection(),
    score: 0,
    alive: true
  };
  room.players.push(player);
  socket.emit('joinedRoom', { 
    roomCode, 
    playerNumber, 
    playerCount: room.players.length,
    players: room.players
  });
  io.to(roomCode).emit('playerJoined', {
    playerCount: room.players.length,
    players: room.players
  });
}

function generateFoods(count) {
  const foods = [];
  const maxFoods = Math.min(count * 2, gridWidth * gridWidth / 4); // 먹이 최대 개수 제한
  for (let i = 0; i < maxFoods; i++) {
    foods.push(generateFood());
  }
  return foods;
}

function generateFood() {
  return {
    x: Math.floor(Math.random() * gridWidth),
    y: Math.floor(Math.random() * gridWidth)
  };
}

function adjustFoodCount(foods, playerCount) {
  while (foods.length > playerCount) {
    foods.pop();
  }
  while (foods.length < playerCount) {
    foods.push(generateFood());
  }
  return foods;
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

    // Check collision with walls
    if (newHead.x < 0 || newHead.x >= gridWidth || newHead.y < 0 || newHead.y >= gridWidth) {
      player.alive = false;
      return;
    }

    // Check collision with other players
    room.players.forEach(otherPlayer => {
      if (otherPlayer.alive) {
        for (let segment of otherPlayer.segments) {
          if (newHead.x === segment.x && newHead.y === segment.y) {
            if (player !== otherPlayer) {
              player.alive = false;
            } else if (player.segments.length > 1) {
              player.alive = false;
            }
            return;
          }
        }
      }
    });

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

  // Check game over condition
  const alivePlayers = room.players.filter(p => p.alive);
  if (alivePlayers.length <= 1 && room.players.length > 1) {
    io.to(roomCode).emit('gameOver', room.players.map(p => ({ id: p.id, score: p.score })));
    rooms.delete(roomCode);
    return;
  }

  io.to(roomCode).emit('gameState', { players: room.players, foods: room.foods });

  setTimeout(() => gameLoop(roomCode), 120);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
