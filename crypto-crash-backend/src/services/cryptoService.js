const axios = require('axios');
const logger = require('../utils/logger');

class CryptoService {
  constructor() {
    this.priceCache = new Map();
    this.cacheTimeout = process.env.PRICE_CACHE_DURATION || 10000; // 10 seconds
    this.supportedCurrencies = ['bitcoin', 'ethereum', 'litecoin', 'cardano', 'polkadot'];
    this.currencyMap = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum', 
      'LTC': 'litecoin',
      'ADA': 'cardano',
      'DOT': 'polkadot'
    };
  }

  async getPrice(currency) {
    try {
      const coinGeckoId = this.currencyMap[currency.toUpperCase()];
      if (!coinGeckoId) {
        throw new Error(`Unsupported currency: ${currency}`);
      }

      // Check cache first
      const cacheKey = `price_${coinGeckoId}`;
      const cached = this.priceCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.price;
      }

      // Fetch from API
      const response = await axios.get(
        `${process.env.COINGECKO_API_URL}/simple/price`,
        {
          params: {
            ids: coinGeckoId,
            vs_currencies: 'usd'
          },
          timeout: 5000
        }
      );

      const price = response.data[coinGeckoId]?.usd;
      if (!price) {
        throw new Error(`Price not found for ${currency}`);
      }

      // Cache the price
      this.priceCache.set(cacheKey, {
        price,
        timestamp: Date.now()
      });

      logger.info(`Fetched ${currency} price: $${price}`);
      return price;

    } catch (error) {
      logger.error(`Error fetching ${currency} price: ${error.message}`);
      
      // Return cached price if available, even if expired
      const cacheKey = `price_${this.currencyMap[currency.toUpperCase()]}`;
      const cached = this.priceCache.get(cacheKey);
      
      if (cached) {
        logger.warn(`Using cached price for ${currency}: $${cached.price}`);
        return cached.price;
      }

      // Fallback prices
      const fallbackPrices = {
        'BTC': 45000,
        'ETH': 3000,
        'LTC': 100,
        'ADA': 0.5,
        'DOT': 7
      };

      logger.warn(`Using fallback price for ${currency}: $${fallbackPrices[currency.toUpperCase()]}`);
      return fallbackPrices[currency.toUpperCase()] || 100;
    }
  }

  async getAllPrices() {
    try {
      const currencies = Object.keys(this.currencyMap);
      const prices = {};

      await Promise.all(
        currencies.map(async (currency) => {
          try {
            prices[currency] = await this.getPrice(currency);
          } catch (error) {
            logger.error(`Error fetching price for ${currency}: ${error.message}`);
          }
        })
      );

      return prices;
    } catch (error) {
      logger.error(`Error fetching all prices: ${error.message}`);
      return {};
    }
  }

  convertUsdToCrypto(usdAmount, cryptoPrice) {
    return usdAmount / cryptoPrice;
  }

  convertCryptoToUsd(cryptoAmount, cryptoPrice) {
    return cryptoAmount * cryptoPrice;
  }

  // Get historical prices (mock implementation)
  async getHistoricalPrice(currency, timestamp) {
    try {
      // For demo purposes, return current price
      // In production, you'd fetch historical data
      return await this.getPrice(currency);
    } catch (error) {
      logger.error(`Error fetching historical price: ${error.message}`);
      return null;
    }
  }

  // Update wallet USD values
  async updateWalletValues(wallets) {
    try {
      const prices = await this.getAllPrices();
      
      wallets.forEach(wallet => {
        const price = prices[wallet.currency];
        if (price) {
          wallet.usdValue = wallet.balance * price;
        }
      });

      return wallets;
    } catch (error) {
      logger.error(`Error updating wallet values: ${error.message}`);
      return wallets;
    }
  }
}

module.exports = new CryptoService();
                