import { Engine } from './engine.js';
import { buildHub } from './rooms/hub.js';
import { buildMirrorRoom } from './rooms/mirrorRoom.js';
import { buildPressureRoom } from './rooms/pressureRoom.js';
import { buildDecodeRoom } from './rooms/decodeRoom.js';

// ─── Game State ───────────────────────────────────────────────────────
const gameState = {
  currentRoom: null,
  completedRooms: new Set(),
  completedPuzzles: new Set()
};

// ─── Game Setup ───────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const engine = new Engine(canvas);

const loadingScreen = document.getElementById('loading-screen');
const loadingFill = document.getElementById('loading-fill');
const loadingText = document.getElementById('loading-text');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');

// ─── Build Rooms ───────────────────────────────��──────────────────────
let rooms = {};
let hub, mirrorRoom, pressureRoom, decodeRoom;

function loadRooms() {
  try {
    loadingText.textContent = 'Building control room...';
    loadingFill.style.width = '20%';
    hub = buildHub(engine, gameState);
    rooms.hub = hub;

    loadingText.textContent = 'Calibrating mirrors...';
    loadingFill.style.width = '40%';
    mirrorRoom = buildMirrorRoom(engine, gameState);
    rooms.mirror = mirrorRoom;

    loadingText.textContent = 'Pressurizing chambers...';
    loadingFill.style.width = '60%';
    pressureRoom = buildPressureRoom(engine, gameState);
    rooms.pressure = pressureRoom;

    loadingText.textContent = 'Decrypting archives...';
    loadingFill.style.width = '80%';
    decodeRoom = buildDecodeRoom(engine, gameState);
    rooms.decode = decodeRoom;

    loadingText.textContent = 'Systems ready.';
    loadingFill.style.width = '100%';
  } catch (err) {
    console.error('Room build failed:', err);
    loadingText.textContent = `Error: ${err.message}`;
    loadingText.style.color = '#e63946';
    throw err;
  }
}

// ─── Room Transitions ───────────────────���─────────────────────────────
function enterRoom(roomName) {
  // Exit current room
  if (gameState.currentRoom && rooms[gameState.currentRoom]) {
    const current = rooms[gameState.currentRoom];
    current.exit();
    engine.scene.remove(current.group);
    engine.clearParticles();
    engine.stopAmbient();
    engine.hideObjective();
    engine.hidePrompt();
  }

  // Enter new room
  const room = rooms[roomName];
  if (!room) return;

  gameState.currentRoom = roomName;
  engine.scene.add(room.group);
  room.enter();
}

// Wire up door transitions
function wireDoors() {
  // Hub doors → rooms
  hub.doors.mirror.onInteract = () => enterRoom('mirror');
  hub.doors.pressure.onInteract = () => enterRoom('pressure');
  hub.doors.archive.onInteract = () => {
    if (gameState.completedRooms.has('mirror') && gameState.completedRooms.has('pressure')) {
      enterRoom('decode');
    } else {
      engine.showObjective('Restore Mirror and Pressure systems first');
      setTimeout(() => engine.hideObjective(), 3000);
    }
  };

  // Room doors → back to hub
  mirrorRoom.doors.back.onInteract = () => {
    if (mirrorRoom.isComplete && !gameState.completedRooms.has('mirror')) {
      gameState.completedRooms.add('mirror');
      hub.onRoomComplete('mirror');
    }
    enterRoom('hub');
  };

  pressureRoom.doors.back.onInteract = () => {
    if (pressureRoom.isComplete && !gameState.completedRooms.has('pressure')) {
      gameState.completedRooms.add('pressure');
      hub.onRoomComplete('pressure');
    }
    enterRoom('hub');
  };

  decodeRoom.doors.back.onInteract = () => {
    if (decodeRoom.isComplete && !gameState.completedRooms.has('decode')) {
      gameState.completedRooms.add('decode');
      hub.onRoomComplete('archive');
    }
    enterRoom('hub');
  };
}

// ─── Victory Sequence ──────────────────���──────────────────────────────
function checkVictory() {
  if (gameState.completedRooms.has('mirror') &&
      gameState.completedRooms.has('pressure') &&
      gameState.completedRooms.has('decode')) {
    // Final victory!
    setTimeout(() => {
      engine.showCompletion('STATION LUMIÈRE — SYSTEMS RESTORED');
      engine.playEffect('success');
      setTimeout(() => {
        engine.playEffect('powerup');
        engine.showNarrative('MISSION COMPLETE', `
          <p class="emphasis">All three systems have been restored.</p>
          <p>The emergency beacon is now transmitting. Rescue teams have been notified.</p>
          <p class="french">"Mission accomplie. Les secours sont en route."</p>
          <p>— Station Lumière AI</p>
          <br>
          <p class="emphasis">Congratulations! You've escaped Station Lumière!</p>
          <p>You used optics and angles to restore communications, pressure physics and rate reasoning to fix life support, and codebreaking with French and history to activate the beacon.</p>
          <p class="french">Bien joué!</p>
        `);
      }, 3000);
    }, 1000);
  }
}

// Watch for room completions
const originalEnterRoom = enterRoom;

// ─── Game Loop ────────────────────────────────────────────────────────
function gameLoop() {
  requestAnimationFrame(gameLoop);

  const delta = engine.update();

  // Update current room
  if (gameState.currentRoom && rooms[gameState.currentRoom]) {
    rooms[gameState.currentRoom].update(delta);
  }

  // Check for room completions returning to hub
  if (gameState.currentRoom === 'hub') {
    checkVictory();
  }
}

// ─── Initialization ─────────────────────────────────��─────────────────
function init() {
  // Build all rooms
  loadRooms();

  // Wire door transitions
  wireDoors();

  // Transition from loading to start screen
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
  }, 800);

  // Start button
  startBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    engine.showHUD();
    engine._ensureAudio();

    // Enter the hub
    enterRoom('hub');

    // Lock controls
    engine.lockControls();

    // Re-lock on click if unlocked (after pointer lock exit)
    document.addEventListener('click', () => {
      if (!engine.isLocked && !engine.narrativeOpen && gameState.currentRoom) {
        engine.lockControls();
      }
    });
  });

  // Start game loop
  gameLoop();
}

// Go!
init();
