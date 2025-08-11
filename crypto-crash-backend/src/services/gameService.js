const Game = require('../models/Game');
const User = require('../models/User');
const ProvablyFair = require('./provablyFair');
const CryptoService = require('./cryptoService');
const logger = require('../utils/logger');

class GameService {
  constructor(io) {
    this.io = io;
    this.currentGame = null;
    this.gameInterval = null;
    this.roundNumber = 1;
    this.multiplierInterval = null;
    
    this.init();
  }

  async init() {
    try {
      // Start the first game
      await this.startNewRound();
      
      // Set up round interval (every 10 seconds + game duration)
      this.scheduleNextRound();
    } catch (error) {
      logger.error(`GameService initialization error: ${error.message}`);
    }
  }

  async startNewRound() {
    try {
      // Generate round data using provably fair algorithm
      const roundData = ProvablyFair.generateRoundData(this.roundNumber);
      
      // Create new game
      this.currentGame = new Game({
        roundId: roundData.roundId,
        seed: roundData.seed,
        hash: roundData.hash,
        crashPoint: roundData.crashPoint,
        status: 'waiting'
      });

      await this.currentGame.save();
      
      logger.info(`New round created: ${roundData.roundId}, Crash Point: ${roundData.crashPoint}x`);
      
      // Notify clients of new round
      this.io.emit('new_round', {
        roundId: this.currentGame.roundId,
        hash: this.currentGame.hash,
        status: 'waiting'
      });

      // Wait 5 seconds for bets
      setTimeout(() => {
        this.startGame();
      }, 5000);

    } catch (error) {
      logger.error(`Error starting new round: ${error.message}`);
    }
  }

  async startGame() {
    try {
      if (!this.currentGame) return;

      this.currentGame.status = 'running';
      this.currentGame.startedAt = new Date();
      await this.currentGame.save();

      this.io.emit('game_started', {
        roundId: this.currentGame.roundId,
        startedAt: this.currentGame.startedAt
      });

      logger.info(`Game started: ${this.currentGame.roundId}`);

      // Start multiplier updates
      this.startMultiplierUpdates();

    } catch (error) {
      logger.error(`Error starting game: ${error.message}`);
    }
  }

  startMultiplierUpdates() {
    const startTime = Date.now();
    const crashPoint = this.currentGame.crashPoint;
    
    this.multiplierInterval = setInterval(async () => {
      try {
        const elapsed = (Date.now() - startTime) / 1000;
        
        // Exponential growth formula
        const multiplier = Math.pow(Math.E, 0.00006 * elapsed);
        const currentMultiplier = Math.floor(multiplier * 100) / 100;
        
        // Check if we've reached the crash point
        if (currentMultiplier >= crashPoint) {
          await this.crashGame();
          return;
        }

        // Update current multiplier
        this.currentGame.currentMultiplier = currentMultiplier;
        
        // Check for auto cashouts
        await this.checkAutoCashouts(currentMultiplier);
        
        // Broadcast multiplier update
        this.io.emit('multiplier_update', {
          roundId: this.currentGame.roundId,
          multiplier: currentMultiplier,
          timestamp: Date.now()
        });

      } catch (error) {
        logger.error(`Error in multiplier update: ${error.message}`);
      }
    }, 100); // Update every 100ms
  }

  async checkAutoCashouts(currentMultiplier) {
    try {
      const activeBets = this.currentGame.bets.filter(bet => 
        !bet.cashedOut && 
        bet.autoCashOut && 
        currentMultiplier >= bet.autoCashOut
      );

      for (const bet of activeBets) {
        await this.processCashout(bet.userId, currentMultiplier, true);
      }
    } catch (error) {
      logger.error(`Error checking auto cashouts: ${error.message}`);
    }
  }

  async crashGame() {
    try {
      clearInterval(this.multiplierInterval);
      
      this.currentGame.status = 'crashed';
      this.currentGame.crashedAt = new Date();
      this.currentGame.currentMultiplier = this.currentGame.crashPoint;
      
      // Process losing bets
      const losingBets = this.currentGame.bets.filter(bet => !bet.cashedOut);
      for (const bet of losingBets) {
        bet.profit = -bet.usdAmount;
        
        // Update user statistics
        await User.findByIdAndUpdate(bet.userId, {
          $inc: { totalBets: 1, totalProfit: bet.profit }
        });
      }

      await this.currentGame.save();

      // Broadcast crash event
      this.io.emit('game_crashed', {
        roundId: this.currentGame.roundId,
        crashPoint: this.currentGame.crashPoint,
        timestamp: Date.now()
      });

      logger.info(`Game crashed: ${this.currentGame.roundId} at ${this.currentGame.crashPoint}x`);

      // Wait 5 seconds then start next round
      setTimeout(() => {
        this.scheduleNextRound();
      }, 5000);

    } catch (error) {
      logger.error(`Error crashing game: ${error.message}`);
    }
  }

  scheduleNextRound() {
    this.roundNumber++;
    setTimeout(() => {
      this.startNewRound();
    }, 1000);
  }

  async placeBet(userId, usdAmount, currency, autoCashOut = null) {
    try {
      if (!this.currentGame || this.currentGame.status !== 'waiting') {
        throw new Error('Cannot place bet at this time');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get current crypto price
      const cryptoPrice = await CryptoService.getPrice(currency);
      const cryptoAmount = usdAmount / cryptoPrice;

      // Check wallet balance
      const wallet = user.wallets.find(w => w.currency === currency);
      if (!wallet || wallet.balance < cryptoAmount) {
        throw new Error('Insufficient balance');
      }

      // Create bet
      const bet = {
        userId: user._id,
        username: user.username,
        usdAmount,
        cryptoAmount,
        currency,
        priceAtTime: cryptoPrice,
        autoCashOut: autoCashOut > 1 ? autoCashOut : null
      };

      this.currentGame.bets.push(bet);
      this.currentGame.totalBets += usdAmount;

      // Update user wallet
      wallet.balance -= cryptoAmount;
      await user.save();
      await this.currentGame.save();

      // Broadcast bet placed
      this.io.emit('bet_placed', {
        roundId: this.currentGame.roundId,
        username: user.username,
        usdAmount,
        currency,
        autoCashOut
      });

      logger.info(`Bet placed: ${user.username} - $${usdAmount} (${cryptoAmount} ${currency})`);

      return { success: true, bet };

    } catch (error) {
      logger.error(`Error placing bet: ${error.message}`);
      throw error;
    }
  }

  async processCashout(userId, multiplier = null, isAuto = false) {
    try {
      if (!this.currentGame || this.currentGame.status !== 'running') {
        throw new Error('Cannot cash out at this time');
      }

      const bet = this.currentGame.bets.find(b => 
        b.userId.toString() === userId.toString() && !b.cashedOut
      );

      if (!bet) {
        throw new Error('No active bet found');
      }

      const currentMultiplier = multiplier || this.currentGame.currentMultiplier;
      const cryptoPayout = bet.cryptoAmount * currentMultiplier;
      const usdPayout = cryptoPayout * bet.priceAtTime;
      const profit = usdPayout - bet.usdAmount;

      // Update bet
      bet.cashedOut = true;
      bet.cashedOutAt = currentMultiplier;
      bet.payout = usdPayout;
      bet.profit = profit;

      // Update user wallet and statistics
      const user = await User.findById(userId);
      const wallet = user.wallets.find(w => w.currency === bet.currency);
      wallet.balance += cryptoPayout;

      await user.updateOne({
        $inc: { 
          totalBets: 1, 
          totalWins: 1, 
          totalProfit: profit 
        }
      });

      await this.currentGame.save();

      // Broadcast cashout
      this.io.emit('player_cashout', {
        roundId: this.currentGame.roundId,
        username: user.username,
        multiplier: currentMultiplier,
        usdPayout,
        profit,
        isAuto
      });

      logger.info(`Cashout: ${user.username} - ${currentMultiplier}x ($${usdPayout})`);

      return { success: true, payout: usdPayout, profit };

    } catch (error) {
      logger.error(`Error processing cashout: ${error.message}`);
      throw error;
    }
  }

  async getGameHistory(limit = 50) {
    try {
      const games = await Game.find({ status: 'crashed' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('roundId crashPoint createdAt crashedAt totalBets bets');

      return games;
    } catch (error) {
      logger.error(`Error getting game history: ${error.message}`);
      return [];
    }
  }

  getCurrentGame() {
    return this.currentGame;
  }
}

module.exports = GameService;
                