const { redisClient, ensureRedisConnection } = require('../redisClient');

const PREFIX = 'eventflow:';

/**
 * Get cache with key prefix handling and safe JSON parsing
 */
const getCache = async (key) => {
  try {
    await ensureRedisConnection();
    if (!redisClient.isOpen) return null;
    
    const prefixedKey = `${PREFIX}${key}`;
    const data = await redisClient.get(prefixedKey);
    
    if (data) {
      console.log(`Cache HIT: ${prefixedKey}`);
      try {
        return JSON.parse(data);
      } catch (parseErr) {
        console.error(`Redis Cache CORRUPTED for key ${prefixedKey}:`, parseErr.message);
        return null; // Fail-safe for bad data
      }
    }
    
    console.log(`Cache MISS: ${prefixedKey}`);
    return null;
  } catch (err) {
    console.error('Redis getCache Error:', err.message);
    return null;
  }
};

/**
 * Set cache with mandatory TTL and key prefix handling
 */
const setCache = async (key, data, ttlSeconds) => {
  try {
    if (!ttlSeconds) {
      console.warn(`Attempted to set cache for ${key} without TTL. Skipping.`);
      return;
    }

    await ensureRedisConnection();
    if (!redisClient.isOpen) return;
    
    const prefixedKey = `${PREFIX}${key}`;
    const value = JSON.stringify(data);
    
    await redisClient.set(prefixedKey, value, {
      EX: ttlSeconds
    });
    
    console.log(`Cache SET: ${prefixedKey} (TTL: ${ttlSeconds}s)`);
  } catch (err) {
    console.error('Redis setCache Error:', err.message);
  }
};

/**
 * Delete a specific key
 */
const deleteCache = async (key) => {
  try {
    await ensureRedisConnection();
    if (!redisClient.isOpen) return;
    
    const prefixedKey = `${PREFIX}${key}`;
    await redisClient.del(prefixedKey);
    console.log(`Cache DELETE: ${prefixedKey}`);
  } catch (err) {
    console.error('Redis deleteCache Error:', err.message);
  }
};

/**
 * Delete multiple keys using pattern (uses SCAN to prevent blocking)
 */
const deleteByPattern = async (pattern) => {
  try {
    await ensureRedisConnection();
    if (!redisClient.isOpen) return;
    
    const prefixedPattern = `${PREFIX}${pattern}`;
    let cursor = 0;
    
    do {
      const reply = await redisClient.scan(cursor, {
        MATCH: prefixedPattern,
        COUNT: 100
      });
      
      cursor = reply.cursor;
      const keys = reply.keys;
      
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`Cache Pattern DELETE: Removed ${keys.length} keys matching ${prefixedPattern}`);
      }
    } while (cursor !== 0);
    
  } catch (err) {
    console.error('Redis deleteByPattern Error:', err.message);
  }
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  deleteByPattern
};
