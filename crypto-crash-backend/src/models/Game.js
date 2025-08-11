const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  usdAmount: {
    type: Number,
    required: true,
    min: 0.01
  },
  cryptoAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    enum: ['BTC', 'ETH', 'LTC', 'ADA', 'DOT']
  },
  priceAtTime: {
    type: Number,
    required: true
  },
  cashOutAt: {
    type: Number,
    default: null
  },
  autoCashOut: {
    type: Number,
    default: null
  },
  cashedOut: {
    type: Boolean,
    default: false
  },
  cashedOutAt: {
    type: Number,
    default: null
  },
  payout: {
    type: Number,
    default: 0
  },
  profit: {
    type: Number,
    default: 0
  },
  placedAt: {
    type: Date,
    default: Date.now
  }
});

const gameSchema = new mongoose.Schema({
  roundId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['waiting', 'running', 'crashed', 'completed'],
    default: 'waiting'
  },
  startedAt: {
    type: Date,
    default: null
  },
  crashedAt: {
    type: Date,
    default: null
  },
  crashPoint: {
    type: Number,
    default: null
  },
  seed: {
    type: String,
    required: true
  },
  hash: {
    type: String,
    required: true
  },
  currentMultiplier: {
    type: Number,
    default: 1.00
  },
  bets: [betSchema],
  totalBets: {
    type: Number,
    default: 0
  },
  totalPayout: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

gameSchema.index({ roundId: 1 });
gameSchema.index({ status: 1 });
gameSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Game', gameSchema);
                