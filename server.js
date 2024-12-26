const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Mappa delle partite
const games = {};

// Servire file statici (HTML, CSS, JS) dalla cartella corretta
app.use(express.static(path.join(__dirname))); // Serve tutti i file dal percorso corrente

// Servire il file index.html alla root "/"
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Gestione delle connessioni Socket.io
io.on('connection', (socket) => {
    console.log('Un giocatore si è connesso:', socket.id);

    // Creazione di una partita
    socket.on('create-game', (gameId) => {
        if (!games[gameId]) {
            games[gameId] = {
                players: [socket.id],
                isPlayer1Turn: false,  // Inizialmente false
                isPlayer2Turn: false,
                player1Ready: false,
                player2Ready: false
            };
            socket.join(gameId);
            console.log(`Partita ${gameId} creata da Player1 (${socket.id})`);
            socket.emit('game-created', gameId);
        } else {
            socket.emit('error', 'ID partita già esistente.');
        }
    });

    // Unirsi a una partita
    socket.on('join-game', (gameId) => {
        if (games[gameId] && games[gameId].players.length < 2) {
            games[gameId].players.push(socket.id);
            socket.join(gameId);
            console.log(`Player2 (${socket.id}) si è unito alla partita ${gameId}`);
            
            // Imposta i turni iniziali
            games[gameId].isPlayer1Turn = true;  // Player1 (server) inizia
            games[gameId].isPlayer2Turn = false; // Player2 (client) aspetta
            
            // Notifica entrambi i giocatori
            const player1Id = games[gameId].players[0];
            socket.emit('game-joined', { isPlayer2: true }); // Notifica Player2
            io.to(player1Id).emit('player2-joined'); // Notifica Player1
            
            // Invia lo stato dei turni
            io.to(player1Id).emit('turn-update', true);  // Player1 può giocare
            io.to(socket.id).emit('turn-update', false); // Player2 deve aspettare
        } else {
            socket.emit('error', 'Partita non trovata o piena.');
        }
    });

    // Mossa fatta
    socket.on('make-move', ({ gameId, move }) => {
        if (games[gameId]) {
            // Alterna il turno
            const game = games[gameId];
            const currentPlayerIndex = game.turn;
            const nextPlayerIndex = (game.turn + 1) % 2;

            // Gestisci la mossa
            io.to(gameId).emit('move-made', move);
            game.turn = nextPlayerIndex;
            io.to(gameId).emit('turn-update', game.turn === 0); // Aggiorna chi è il prossimo giocatore
        }
    });

    // Gestione disconnessione
    socket.on('disconnect', () => {
        console.log(`Giocatore ${socket.id} disconnesso.`);
        for (const gameId in games) {
            const index = games[gameId].players.indexOf(socket.id);
            if (index !== -1) {
                games[gameId].players.splice(index, 1);
                if (games[gameId].players.length === 0) {
                    delete games[gameId];
                }
                break;
            }
        }
    });

    // Aggiungi l'handler per il posizionamento delle navi
    socket.on('ships-placed', () => {
        const game = Object.values(games).find(g => g.players.includes(socket.id));
        if (game) {
            if (game.players[0] === socket.id) {
                // Server ha finito
                game.player1Ready = true;
                game.isPlayer1Turn = false;
                game.isPlayer2Turn = true;
                
                // Invia un evento specifico al client per iniziare il suo turno
                io.to(game.players[1]).emit('your-turn-to-place-ships');
                
                // Aggiorna lo stato dei turni per entrambi
                io.to(game.players[0]).emit('turn-update', false);
                io.to(game.players[1]).emit('turn-update', true);
            } else {
                // Client ha finito
                game.player2Ready = true;
                
                // Inizia la fase di battaglia
                io.to(game.players[0]).emit('start-battle');
                io.to(game.players[1]).emit('start-battle');
            }
        }
    });

    // Aggiungi questo handler
    socket.on('server-finished-placement', () => {
        const game = Object.values(games).find(g => g.players.includes(socket.id));
        if (game) {
            // Notifica il client che può iniziare a posizionare le navi
            socket.broadcast.to(game.players[1]).emit('server-finished-placement');
        }
    });
});

// Avvio del server
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
});