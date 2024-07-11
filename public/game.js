const socket = io();

let players = [];
let foods = [];
const gridSize = 20;
const canvasSize = 400;
let roomCode = '';
let gameStarted = false;
let myPlayerIndex = -1;
let canvas;

function setup() {
  canvas = createCanvas(canvasSize, canvasSize);
  canvas.parent('gameCanvas');
  frameRate(10);
  
  // 캔버스에 터치 이벤트 리스너 추가
  canvas.elt.addEventListener('touchstart', handleTouchStart, false);
  canvas.elt.addEventListener('touchmove', handleTouchMove, false);
}

function draw() {
  background(51);
  
  if (gameStarted) {
    for (let food of foods) {
      fill(255);
      rect(food.x, food.y, gridSize, gridSize);
    }
    
    for (let player of players) {
      if (player.alive) {
        fill(player.color);
        rect(player.x, player.y, gridSize, gridSize);
      }
    }
    
    // 점수 표시
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
    // 키 이벤트의 기본 동작 방지
    return false;
  }
}

// 터치 이벤트 처리를 위한 변수
let xDown = null;
let yDown = null;

function handleTouchStart(evt) {
  const firstTouch = evt.touches[0];
  xDown = firstTouch.clientX;
  yDown = firstTouch.clientY;
}

function handleTouchMove(evt) {
  if (!xDown || !yDown) {
    return;
  }

  const xUp = evt.touches[0].clientX;
  const yUp = evt.touches[0].clientY;

  const xDiff = xDown - xUp;
  const yDiff = yDown - yUp;

  let direction = { x: 0, y: 0 };

  if (Math.abs(xDiff) > Math.abs(yDiff)) {
    if (xDiff > 0) {
      direction = { x: -1, y: 0 }; // 왼쪽으로 스와이프
    } else {
      direction = { x: 1, y: 0 }; // 오른쪽으로 스와이프
    }
  } else {
    if (yDiff > 0) {
      direction = { x: 0, y: -1 }; // 위로 스와이프
    } else {
      direction = { x: 0, y: 1 }; // 아래로 스와이프
    }
  }

  if (direction.x !== 0 || direction.y !== 0) {
    socket.emit('changeDirection', { roomCode, direction });
  }

  // 터치 이벤트 초기화
  xDown = null;
  yDown = null;
  
  // 이벤트의 기본 동작과 전파 방지
  evt.preventDefault();
  evt.stopPropagation();
}

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

// 페이지 스크롤 방지
function preventScroll(e) {
  e.preventDefault();
  e.stopPropagation();
  return false;
}

// 게임이 시작되면 캔버스에 스크롤 방지 이벤트 리스너 추가
socket.on('gameStarted', (data) => {
  gameStarted = true;
  players = data.players;
  foods = data.foods;
  document.getElementById('menu').style.display = 'none';
  
  // 캔버스에 스크롤 방지 이벤트 리스너 추가
  canvas.elt.addEventListener('touchmove', preventScroll, { passive: false });
  canvas.elt.addEventListener('wheel', preventScroll, { passive: false });
});