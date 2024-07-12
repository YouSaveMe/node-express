const socket = io();

let players = [];
let foods = [];
const gridSize = 20;
const canvasSize = 400;
let roomCode = '';
let gameStarted = false;
let myPlayerNumber = -1;
let canvas;
let joined = false;

// 터치 이벤트를 위한 변수
let xDown = null;
let yDown = null;

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
    players.forEach((player) => {
      text(`Player ${player.number}: ${player.score}`, 10, 10 + (player.number - 1) * 20);
    });
  }
}

function keyPressed() {
  if (!gameStarted || myPlayerNumber === -1 || !players[myPlayerNumber - 1].alive) return;
  
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

  if (gameStarted && myPlayerNumber !== -1 && players[myPlayerNumber - 1].alive) {
    if (direction.x !== 0 || direction.y !== 0) {
      socket.emit('changeDirection', { roomCode, direction });
    }
  }

  // 터치 이벤트 초기화
  xDown = null;
  yDown = null;
  
  // 이벤트의 기본 동작과 전파 방지
  evt.preventDefault();
}

document.getElementById('createRoom').addEventListener('click', () => {
  if (!joined) {
    socket.emit('createRoom');
  } else {
    alert('You have already joined a room on this device.');
  }
});

document.getElementById('joinRoom').addEventListener('click', () => {
  if (!joined) {
    const roomCodeInput = document.getElementById('roomCodeInput');
    if (roomCodeInput.value) {
      socket.emit('joinRoom', roomCodeInput.value);
    }
  } else {
    alert('You have already joined a room on this device.');
  }
});

document.getElementById('startGame').addEventListener('click', () => {
  socket.emit('startGame', roomCode);
});

socket.on('roomCreated', (code) => {
  roomCode = code;
  joined = true;
  document.getElementById('roomCode').innerText = `Room Code: ${roomCode}`;
  document.getElementById('startGame').style.display = 'inline-block';
});

socket.on('joinedRoom', (data) => {
  roomCode = data.roomCode;
  myPlayerNumber = data.playerNumber;
  joined = true;
  document.getElementById('roomCode').innerText = `Room Code: ${roomCode}`;
  document.getElementById('playerInfo').innerText = `You are Player ${myPlayerNumber}`;
  if (myPlayerNumber === 1) {
    document.getElementById('startGame').style.display = 'inline-block';
  }
  updatePlayerList(data.players);
  updatePlayerCount(data.playerCount);
});

socket.on('playerJoined', (data) => {
  console.log(`Players in room: ${data.playerCount}`);
  updatePlayerCount(data.playerCount);
  updatePlayerList(data.players);
});

socket.on('playerLeft', (data) => {
  console.log(`A player left. Players remaining: ${data.playerCount}`);
  updatePlayerCount(data.playerCount);
  updatePlayerList(data.players);
});

function updatePlayerCount(count) {
  document.getElementById('playerCount').innerText = `Players in room: ${count}`;
}

function updatePlayerList(playerList) {
  players = playerList;
  const playerListElement = document.getElementById('playerList');
  playerListElement.innerHTML = '';
  players.forEach(player => {
    const playerItem = document.createElement('li');
    playerItem.textContent = `Player ${player.number} (${player.color})`;
    playerListElement.appendChild(playerItem);
  });
}

socket.on('gameStarted', (data) => {
  gameStarted = true;
  players = data.players;
  foods = data.foods;
  document.getElementById('menu').style.display = 'none';
  
  canvas.elt.addEventListener('touchmove', preventScroll, { passive: false });
  canvas.elt.addEventListener('wheel', preventScroll, { passive: false });
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
    gameOverDiv.innerHTML += `<p>${index + 1}. Player ${player.number}: ${player.score}</p>`;
  });
  gameOverDiv.innerHTML += '<button onclick="location.reload()">Play Again</button>';
  document.body.appendChild(gameOverDiv);
});

function preventScroll(e) {
  e.preventDefault();
  e.stopPropagation();
  return false;
}
