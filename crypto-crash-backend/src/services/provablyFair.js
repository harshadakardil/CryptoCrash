const crypto = require('crypto');
const logger = require('../utils/logger');

class ProvablyFair {
  
  // Generate a cryptographically secure seed
  static generateSeed() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create hash from seed
  static createHash(seed) {
    return crypto.createHash('sha256').update(seed).digest('hex');
  }

  // Generate crash point using provably fair algorithm
  static generateCrashPoint(seed, roundNumber) {
    try {
      // Combine seed with round number for uniqueness
      const data = seed + roundNumber.toString();
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      
      // Convert first 8 characters of hash to number
      const hexSubstring = hash.substring(0, 8);
      const intValue = parseInt(hexSubstring, 16);
      
      // Calculate crash point using house edge formula
      // This ensures the house edge while maintaining fairness
      const houseEdge = 0.04; // 4% house edge
      const result = (Math.pow(2, 32) - 1 - intValue) / (Math.pow(2, 32) - 1 - intValue * houseEdge);
      
      // Ensure minimum crash point and reasonable maximum
      const crashPoint = Math.max(1.01, Math.min(result, 1000));
      
      // Round to 2 decimal places
      return Math.floor(crashPoint * 100) / 100;
    } catch (error) {
      logger.error(`Error generating crash point: ${error.message}`);
      return 1.50; // Fallback crash point
    }
  }

  // Verify crash point using the same algorithm
  static verifyCrashPoint(seed, roundNumber, crashPoint) {
    const calculatedCrashPoint = this.generateCrashPoint(seed, roundNumber);
    return Math.abs(calculatedCrashPoint - crashPoint) < 0.01;
  }

  // Generate next round data
  static generateRoundData(roundNumber) {
    const seed = this.generateSeed();
    const hash = this.createHash(seed);
    const crashPoint = this.generateCrashPoint(seed, roundNumber);
    
    return {
      seed,
      hash,
      crashPoint,
      roundId: `round_${Date.now()}_${roundNumber}`
    };
  }

  // Validate fairness proof
  static validateProof(seed, hash, roundNumber, crashPoint) {
    try {
      // Verify hash matches seed
      const calculatedHash = this.createHash(seed);
      if (calculatedHash !== hash) {
        return { valid: false, reason: 'Hash does not match seed' };
      }

      // Verify crash point
      const calculatedCrashPoint = this.generateCrashPoint(seed, roundNumber);
      if (Math.abs(calculatedCrashPoint - crashPoint) > 0.01) {
        return { valid: false, reason: 'Crash point does not match calculation' };
      }

      return { valid: true, reason: 'Proof is valid' };
    } catch (error) {
      logger.error(`Error validating proof: ${error.message}`);
      return { valid: false, reason: 'Error during validation' };
    }
  }
}

module.exports = ProvablyFair;
                