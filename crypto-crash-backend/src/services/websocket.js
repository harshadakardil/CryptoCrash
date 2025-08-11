const socketIo = require('socket.io');
const { socketAuth } = require('../middleware/auth');
const GameService = require('./gameService');
const logger = require('../utils/logger');

class WebSocketService {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.gameService = new GameService(this.io);
    this.connectedUsers = new Map();
    
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(socketAuth);
    
    // Rate limiting
    this.io.use((socket, next) => {
      const userId = socket.user.id;
      const now = Date.now();
      
      if (!socket.rateLimiter) {
        socket.rateLimiter = { requests: [], userId };
      }
      
      // Clean old requests (last minute)
      socket.rateLimiter.requests = socket.rateLimiter.requests
        .filter(time => now - time < 60000);
      
      // Check rate limit (max 100 requests per minute)
      if (socket.rateLimiter.requests.length >= 100) {
        return next(new Error('Rate limit exceeded'));
      }
      
      socket.rateLimiter.requests.push(now);
      next();
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const user = socket.user;
      logger.info(`User connected: ${user.username} (${socket.id})`);
      
      // Store user connection
      this.connectedUsers.set(user.id, {
        socket: socket,
        user: user,
        connectedAt: new Date()
      });

      // Send current game state
      this.sendGameState(socket);
      
      // Handle place bet
      socket.on('place_bet', async (data) => {
        try {
          const { usdAmount, currency, autoCashOut } = data;
          
          // Validation
          if (!usdAmount || usdAmount < 0.01 || usdAmount > 10000) {
            socket.emit('error', { message: 'Invalid bet amount' });
            return;
          }
          
          if (!['BTC', 'ETH', 'LTC', 'ADA', 'DOT'].includes(currency)) {
            socket.emit('error', { message: 'Invalid currency' });
            return;
          }
          
          if (autoCashOut && (autoCashOut < 1.01 || autoCashOut > 1000)) {
            socket.emit('error', { message: 'Invalid auto cashout value' });
            return;
          }

          const result = await this.gameService.placeBet(
            user.id, 
            usdAmount, 
            currency, 
            autoCashOut
          );
          
          socket.emit('bet_placed_success', result);
          
        } catch (error) {
          logger.error(`Place bet error for ${user.username}: ${error.message}`);
          socket.emit('error', { message: error.message });
        }
      });

      // Handle cashout
      socket.on('cashout', async () => {
        try {
          const result = await this.gameService.processCashout(user.id);
          socket.emit('cashout_success', result);
          
        } catch (error) {
          logger.error(`Cashout error for ${user.username}: ${error.message}`);
          socket.emit('error', { message: error.message });
        }
      });

      // Handle game history request
      socket.on('get_game_history', async (data) => {
        try {
          const { limit = 50 } = data;
          const history = await this.gameService.getGameHistory(limit);
          socket.emit('game_history', history);
          
        } catch (error) {
          logger.error(`Game history error: ${error.message}`);
          socket.emit('error', { message: 'Failed to fetch game history' });
        }
      });

      // Handle user stats request
      socket.on('get_user_stats', async () => {
        try {
          const userStats = {
            totalBets: user.totalBets,
            totalWins: user.totalWins,
            totalProfit: user.totalProfit,
            wallets: user.wallets
          };
          socket.emit('user_stats', userStats);
          
        } catch (error) {
          logger.error(`User stats error: ${error.message}`);
          socket.emit('error', { message: 'Failed to fetch user stats' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        logger.info(`User disconnected: ${user.username} (${reason})`);
        this.connectedUsers.delete(user.id);
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  sendGameState(socket) {
    const currentGame = this.gameService.getCurrentGame();
    if (currentGame) {
      socket.emit('game_state', {
        roundId: currentGame.roundId,
        status: currentGame.status,
        currentMultiplier: currentGame.currentMultiplier,
        hash: currentGame.hash,
        startedAt: currentGame.startedAt,
        bets: currentGame.bets.map(bet => ({
          username: bet.username,
          usdAmount: bet.usdAmount,
          currency: bet.currency,
          autoCashOut: bet.autoCashOut,
          cashedOut: bet.cashedOut,
          cashedOutAt: bet.cashedOutAt
        }))
      });
    }
  }

  // Broadcast to all connected clients
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  // Send to specific user
  sendToUser(userId, event, data) {
    const connection = this.connectedUsers.get(userId);
    if (connection) {
      connection.socket.emit(event, data);
    }
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get connected users info
  getConnectedUsers() {
    return Array.from(this.connectedUsers.values()).map(conn => ({
      username: conn.user.username,
      connectedAt: conn.connectedAt
    }));
  }
}

module.exports = WebSocketService;
                