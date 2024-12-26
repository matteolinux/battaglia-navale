const socket = io('http://192.168.0.6:3000');

const createGameButton = document.getElementById('createGame');
const joinGameButton = document.getElementById('joinGame');
const gameIdInput = document.getElementById('gameId');
const playerGrid = document.getElementById('playerGrid');
const enemyGrid = document.getElementById('enemyGrid');
const gameDiv = document.getElementById('game');
const turnStatus = document.getElementById('turnStatus');

let gameId = '';
let isServer = false;
let isClient = false;

// Variabili per il posizionamento navi
let totalClicks = 0;
const SHIPS = {
    carrier: { size: 5, color: '#2196F3' },    // Blu
    battleship: { size: 4, color: '#4CAF50' }, // Verde
    cruiser: { size: 3, color: '#FFC107' },    // Giallo
    destroyer: { size: 2, color: '#9C27B0' }   // Viola
};
let currentShip = 'carrier';
let currentShipClicks = 0;
let lastClickIndex = null;
let shipDirection = null; // 'horizontal' o 'vertical'

// Funzione per verificare se il click è contiguo
function isContiguousClick(currentIndex) {
    if (lastClickIndex === null) return true;
    
    const currentRow = Math.floor(currentIndex / 10);
    const currentCol = currentIndex % 10;
    const lastRow = Math.floor(lastClickIndex / 10);
    const lastCol = lastClickIndex % 10;

    if (currentShipClicks === 1) {
        // Secondo click: determina la direzione
        if (currentRow === lastRow && Math.abs(currentCol - lastCol) === 1) {
            shipDirection = 'horizontal';
            return true;
        }
        if (currentCol === lastCol && Math.abs(currentRow - lastRow) === 1) {
            shipDirection = 'vertical';
            return true;
        }
        return false;
    }

    // Click successivi: devono seguire la direzione
    if (shipDirection === 'horizontal') {
        return currentRow === lastRow && Math.abs(currentCol - lastCol) === 1;
    } else {
        return currentCol === lastCol && Math.abs(currentRow - lastRow) === 1;
    }
}

// Funzione base per creare la griglia
function createGrid(gridElement, isClickable = false) {
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        
        if (isClickable) {
            cell.addEventListener('click', () => {
                if ((isServer && gridElement === playerGrid) && totalClicks < 14) {
                    const index = parseInt(cell.dataset.index);
                    
                    if (!cell.classList.contains('ship') && isContiguousClick(index)) {
                        cell.classList.add('ship');
                        cell.style.backgroundColor = SHIPS[currentShip].color;
                        
                        currentShipClicks++;
                        totalClicks++;
                        lastClickIndex = index;

                        // Controlla se la nave corrente è completa
                        if (currentShipClicks === SHIPS[currentShip].size) {
                            // Passa alla prossima nave
                            if (currentShip === 'carrier') {
                                currentShip = 'battleship';
                            } else if (currentShip === 'battleship') {
                                currentShip = 'cruiser';
                            } else if (currentShip === 'cruiser') {
                                currentShip = 'destroyer';
                            }
                            
                            currentShipClicks = 0;
                            lastClickIndex = null;
                            shipDirection = null;
                            
                            if (totalClicks === 14) {
                                alert('Hai completato il posizionamento delle navi!');
                                // Qui aggiungeremo la logica per passare il turno
                            } else {
                                alert(`Posiziona la nave da ${SHIPS[currentShip].size} caselle`);
                            }
                        }
                    }
                }
            });
        }
        gridElement.appendChild(cell);
    }
}

// Event listeners base
createGameButton.addEventListener('click', () => {
    gameId = Math.random().toString(36).substring(2, 7);
    socket.emit('create-game', gameId);
    isServer = true;
    startGame();
});

joinGameButton.addEventListener('click', () => {
    gameId = gameIdInput.value;
    socket.emit('join-game', gameId);
    isClient = true;
    startGame();
});

// Funzione base per iniziare il gioco
function startGame() {
    document.getElementById('controls').style.display = 'none';
    gameDiv.style.display = 'block';
    
    if (isServer) {
        // Server: playerGrid cliccabile, enemyGrid non cliccabile
        createGrid(playerGrid, true);
        createGrid(enemyGrid, false);
    } else if (isClient) {
        // Client: entrambe le griglie non cliccabili all'inizio
        createGrid(playerGrid, false);
        createGrid(enemyGrid, false);
    }
}

// Socket events base
socket.on('game-created', (id) => {
    alert(`Partita creata con successo! ID: ${id}`);
});

socket.on('game-joined', () => {
    alert('Ti sei unito alla partita!');
});

socket.on('error', (message) => {
    alert(`Errore: ${message}`);
});