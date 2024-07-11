const socket = io();

let players = [];
let foods = [];
const gridSize = 20;
const canvasSize = 350;  // 캔버스 크기를 350으로 변경
let roomCode = '';
let gameStarted = false;
let myPlayerIndex = -1;
let canvas;

function setup() {
  canvas = createCanvas(canvasSize, canvasSize);
  canvas.parent('gameCanvas');
  frameRate(10);
  
  canvas.elt.addEventListener('touchstart', handleTouchStart, false);
  canvas.elt.addEventListener('touchmove', handleTouchMove, false);
}

function draw() {
  background(51);
  
  if (gameStarted) {
    for (let food of foods) {
      fill(255, 0, 0);
      rect(food.x * gridSize, food.y * gridSize, gridSize, gridSize);
    }
    
    for (let player of players) {
      if (player.alive) {
        fill(player.color);
        for (let segment of player.segments) {
          rect(segment.x * gridSize, segment.y * gridSize, gridSize, gridSize);
        }
      }
    }
    
    fill(255);
    textSize(16);
    textAlign(LEFT, TOP);
    players.forEach((player, index) => {
      text(`Player ${index + 1}: ${player.score}`, 10, 10 + index * 20);
    });
  }
}

function keyPressed() {
  if (!gameStarted || myPlayerIndex === -1 || !players[myPlayerIndex].alive) return;
  
  let direction = { x: 0, y: 0 };
  if (keyCode === LEFT_ARROW) direction = { x: -1, y: 0 };
  else if (keyCode === RIGHT_ARROW) direction = { x: 1, y: 0 };
  else if (keyCode === UP_ARROW) direction = { x: 0, y: -1 };
  else if (keyCode === DOWN_ARROW) direction = { x: 0, y: 1 };
  
  if (direction.x !== 0 || direction.y !== 0) {
    socket.emit('changeDirection', { roomCode, direction });
    return false;
  }
}

// 터치 이벤트 처리 함수들은 그대로 유지

document.getElementById('createRoom').addEventListener('click', () => {
  socket.emit('createRoom');
});

document.getElementById('joinRoom').addEventListener('click', () => {
  const roomCodeInput = document.getElementById('roomCodeInput');
  if (roomCodeInput.value) {
    socket.emit('joinRoom', roomCodeInput.value);
  }
});

document.getElementById('startGame').addEventListener('click', () => {
  socket.emit('startGame', roomCode);
});

socket.on('roomCreated', (code) => {
  roomCode = code;
  document.getElementById('roomCode').innerText = `Room Code: ${roomCode}`;
  document.getElementById('startGame').style.display = 'inline-block';
});

socket.on('joinedRoom', (data) => {
  roomCode = data.roomCode;
  myPlayerIndex = data.playerIndex;
  document.getElementById('roomCode').innerText = `Room Code: ${roomCode}`;
  if (myPlayerIndex === 0) {
    document.getElementById('startGame').style.display = 'inline-block';
  }
});

socket.on('playerJoined', (playerCount) => {
  console.log(`Players in room: ${playerCount}`);
});

socket.on('gameStarted', (data) => {
  gameStarted = true;
  players = data.players;
  foods = data.foods;
  document.getElementById('menu').style.display = 'none';
});

socket.on('gameState', (data) => {
  players = data.players;
  foods = data.foods;
});

socket.on('gameOver', (rankings) => {
  gameStarted = false;
  const gameOverDiv = document.createElement('div');
  gameOverDiv.innerHTML = '<h2>Game Over</h2><h3>Final Rankings:</h3>';
  rankings.forEach((player, index) => {
    gameOverDiv.innerHTML += `<p>${index + 1}. Player ${players.findIndex(p => p.id === player.id) + 1}: ${player.score}</p>`;
  });
  gameOverDiv.innerHTML += '<button onclick="location.reload()">Play Again</button>';
  document.body.appendChild(gameOverDiv);
});

socket.on('roomFull', () => {
  alert('The room is full or the game has already started.');
});

socket.on('roomNotFound', () => {
  alert('Room not found. Please check the room code.');
});

socket.on('playerLeft', (playerCount) => {
  console.log(`A player left. Players remaining: ${playerCount}`);
});

function preventScroll(e) {
  e.preventDefault();
  e.stopPropagation();
  return false;
}

socket.on('gameStarted', (data) => {
  gameStarted = true;
  players = data.players;
  foods = data.foods;
  document.getElementById('menu').style.display = 'none';
  
  canvas.elt.addEventListener('touchmove', preventScroll, { passive: false });
  canvas.elt.addEventListener('wheel', preventScroll, { passive: false });
});
