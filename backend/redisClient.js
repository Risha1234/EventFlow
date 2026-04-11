const { createClient } = require('redis');
require('dotenv').config();

// Ensure we use the correct protocol for Upstash (prefer SSL/TLS)
let url = process.env.REDIS_URL || '';

if (!url) {
  console.warn("⚠️  REDIS_URL is NOT set. Caching will be disabled.");
}

const isSsl = url && url.startsWith('rediss://');

const redisClient = url 
  ? createClient({
      url: url,
      socket: {
        // Only apply TLS if the URL protocol is rediss://
        ...(isSsl ? { tls: true, rejectUnauthorized: false } : {}),
        // Disable internal auto-reconnect to prevent loops
        reconnectStrategy: false
      }
    })
  : {
      // Mock client or null if no URL
      on: () => {},
      connect: async () => {},
      isOpen: false,
      isMock: true
    };

let isConnecting = false;

/**
 * Ensures Redis is connected before any command execution.
 * Only connects when actually needed (Lazy Connection).
 * Never throws errors upward.
 */
async function ensureRedisConnection() {
  if (redisClient.isOpen || isConnecting) return;

  try {
    isConnecting = true;
    await redisClient.connect();
  } catch (err) {
    // Fail silently to prevent crashing the response
  } finally {
    isConnecting = false;
  }
}

let hasConnectedOnce = false;
let hasLoggedSocketClose = false;

redisClient.on('error', (err) => {
  const isExpectedClosure = err?.message?.includes('Socket closed unexpectedly');
  if (isExpectedClosure) {
    if (!hasLoggedSocketClose) {
      console.log('Redis connection closed (expected behavior for serverless instances)');
      hasLoggedSocketClose = true;
    }
    return;
  }
  
  // Real errors (like WRONGPASS) are logged
  console.error('Redis Client Error:', err.message);
});

redisClient.on('connect', () => {
  if (!hasConnectedOnce) {
    console.log('Redis connected successfully');
    hasConnectedOnce = true;
  }
  // DO NOT reset hasLoggedSocketClose here to keep logs silent after the first drop
});

module.exports = {
  redisClient,
  ensureRedisConnection
};
