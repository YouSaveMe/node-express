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
let lastTouchTime = 0;
const touchThreshold = 30; // 픽셀 단위의 최소 스와이프 거리
const touchCooldown = 100; // 밀리초 단위의 연속 터치 사이의 최소 시간

function setup() {
  canvas = createCanvas(canvasSize, canvasSize);
  canvas.parent('gameCanvas');
  frameRate(10);
  
  canvas.elt.addEventListener('touchstart', handleTouchStart, false);
  canvas.elt.addEventListener('touchmove', handleTouchMove, false);
  canvas.elt.addEventListener('touchend', handleTouchEnd, false);
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
    textSize(12);
    textAlign(LEFT, TOP);
    players.forEach((player, index) => {
      text(`Player ${player.number}: ${player.score}`, 10, 10 + index * 15);
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

  const currentTime = new Date().getTime();
  if (currentTime - lastTouchTime < touchCooldown) {
    return;
  }

  if (Math.abs(xDiff) > touchThreshold || Math.abs(yDiff) > touchThreshold) {
    let direction = { x: 0, y: 0 };

    if (Math.abs(xDiff) > Math.abs(yDiff)) {
      direction.x = xDiff > 0 ? -1 : 1;
    } else {
      direction.y = yDiff > 0 ? -1 : 1;
    }

    if (gameStarted && myPlayerNumber !== -1 && players[myPlayerNumber - 1] && players[myPlayerNumber - 1].alive) {
      socket.emit('changeDirection', { roomCode, direction });
      lastTouchTime = currentTime;
    }

    // 터치 좌표 리셋
    xDown = null;
    yDown = null;
  }

  evt.preventDefault();
}

function handleTouchEnd(evt) {
  // 터치 종료 시 좌표 리셋
  xDown = null;
  yDown = null;
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
    socket.emit('getRoomList');
  } else {
    alert('You have already joined a room on this device.');
  }
});

socket.on('roomList', (roomList) => {
  const roomListElement = document.getElementById('roomList');
  roomListElement.innerHTML = '';
  
  if (roomList.length === 0) {
    roomListElement.innerHTML = '<p>No rooms available. Create a new room!</p>';
    return;
  }

  const selectElement = document.createElement('select');
  selectElement.id = 'roomSelect';

  roomList.forEach(room => {
    if (!room.gameStarted) {
      const option = document.createElement('option');
      option.value = room.code;
      option.textContent = `Room ${room.code} (${room.playerCount} players)`;
      selectElement.appendChild(option);
    }
  });

  const joinButton = document.createElement('button');
  joinButton.textContent = 'Join Selected Room';
  joinButton.onclick = () => {
    const selectedRoom = document.getElementById('roomSelect').value;
    if (selectedRoom) {
      socket.emit('joinRoom', selectedRoom);
    }
  };

  roomListElement.appendChild(selectElement);
  roomListElement.appendChild(joinButton);
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
  updateStartButton(data.playerCount);  // 새로운 함수 호출
});

socket.on('playerJoined', (data) => {
  console.log(`Players in room: ${data.playerCount}`);
  updatePlayerCount(data.playerCount);
  updatePlayerList(data.players);
  updateStartButton(data.playerCount);  // 새로운 함수 호출
});

socket.on('playerLeft', (data) => {
  console.log(`A player left. Players remaining: ${data.playerCount}`);
  updatePlayerCount(data.playerCount);
  updatePlayerList(data.players);
  updateStartButton(data.playerCount);  // 새로운 함수 호출
});

function updateStartButton(playerCount) {
  const startButton = document.getElementById('startGame');
  if (myPlayerNumber === 1) {
    if (playerCount >= 2) {
      startButton.disabled = false;
      startButton.textContent = 'Start Game';
    } else {
      startButton.disabled = true;
      startButton.textContent = 'Waiting for players...';
    }
  }
}

socket.on('notEnoughPlayers', () => {
  alert('Not enough players to start the game. Minimum 2 players required.');
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
    playerItem.style.color = player.color;
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
  const gameOverDiv = document.getElementById('gameOverDiv');
  gameOverDiv.innerHTML = '<h2>Game Over</h2><h3>Final Rankings:</h3>';
  rankings.forEach((player, index) => {
    gameOverDiv.innerHTML += `<p>${index + 1}. Player ${player.number}: ${player.score}</p>`;
  });
  gameOverDiv.innerHTML += '<button onclick="restartGame()">Play Again</button>';
  gameOverDiv.style.display = 'flex';
});

function restartGame() {
  const gameOverDiv = document.getElementById('gameOverDiv');
  gameOverDiv.style.display = 'none';
  location.reload();
}

function preventScroll(e) {
  e.preventDefault();
  e.stopPropagation();
  return false;
}
