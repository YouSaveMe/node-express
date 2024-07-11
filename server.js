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
    io.to(roomCode).emit('playerJoined', 1);
  });

  socket.on('joinRoom', (roomCode) => {
    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      if (room.players.length < 4 && !room.gameStarted) {
        socket.join(roomCode);
        const playerIndex = room.players.length;
        const startPositions = [
          { x: Math.floor((canvasSize / gridSize) / 4), y: Math.floor((canvasSize / gridSize) / 4) },
          { x: Math.floor((canvasSize / gridSize) * 3 / 4), y: Math.floor((canvasSize / gridSize) / 4) },
          { x: Math.floor((canvasSize / gridSize) / 4), y: Math.floor((canvasSize / gridSize) * 3 / 4) },
          { x: Math.floor((canvasSize / gridSize) * 3 / 4), y: Math.floor((canvasSize / gridSize) * 3 / 4) }
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
        socket.emit('joinedRoom', { roomCode, playerIndex, playerCount: room.players.length });
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
        // 반대 방향으로의 이동을 막습니다.
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
        io.to(roomCode).emit('playerLeft', room.players.length);
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else if (room.gameStarted) {
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
    x: Math.floor(Math.random() * (canvasSize / gridSize)),
    y: Math.floor(Math.random() * (canvasSize / gridSize))
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


    //
    벽과의 충돌 체크
    if (newHead.x < 0 || newHead.x >= canvasSize / gridSize || 
        newHead.y < 0 || newHead.y >= canvasSize / gridSize) {
      player.alive = false;
      return;
    }

    // 다른 플레이어와의 충돌 체크
    room.players.forEach(otherPlayer => {
      if (otherPlayer.alive) {
        for (let segment of otherPlayer.segments) {
          if (newHead.x === segment.x && newHead.y === segment.y) {
            if (player !== otherPlayer) {
              if (player.segments.length <= otherPlayer.segments.length) {
                player.alive = false;
              } else {
                otherPlayer.alive = false;
              }
            } else if (player === otherPlayer && player.segments.length > 1) {
              // 자기 자신과 충돌
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

  // 게임 종료 조건 확인
  // ...

  io.to(roomCode).emit('gameState', { players: room.players, foods: room.foods });

  setTimeout(() => gameLoop(roomCode), 100);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

