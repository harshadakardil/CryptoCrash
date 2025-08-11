const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const walletSchema = new mongoose.Schema({
  currency: {
    type: String,
    required: true,
    enum: ['BTC', 'ETH', 'LTC', 'ADA', 'DOT']
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  usdValue: {
    type: Number,
    default: 0
  }
});

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  wallets: [walletSchema],
  totalBets: {
    type: Number,
    default: 0
  },
  totalWins: {
    type: Number,
    default: 0
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Initialize default wallets
userSchema.methods.initializeWallets = function() {
  const currencies = ['BTC', 'ETH', 'LTC', 'ADA', 'DOT'];
  this.wallets = currencies.map(currency => ({
    currency,
    balance: currency === 'BTC' ? 0.001 : currency === 'ETH' ? 0.01 : 1, // Demo balances
    usdValue: 0
  }));
};

userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

module.exports = mongoose.model('User', userSchema);
                