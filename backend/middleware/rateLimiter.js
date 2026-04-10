const rateLimit = require("express-rate-limit");

/**
 * Standardized rate limit message format
 */
const rateLimitMessage = {
  success: false,
  message: "Too many requests, please try again later"
};

/**
 * Auth Limiter (STRICT)
 * Apply to: /login, /register
 * Limit: 5 requests per minute
 */
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip logic: If we ever have admins logged in and trying to hit these, 
  // but usually login/register don't have req.user yet.
  skip: (req) => req.user?.role === "admin"
});

/**
 * Activity Limiter (MODERATE)
 * Apply to: /activity
 * Limit: 30 requests per minute
 */
const activityLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  // Important: Skip for organizers/admins managing their dashboard activity
  skip: (req) => req.user?.role === "admin" || req.user?.role === "organizer"
});

/**
 * General API Limiter (RELAXED)
 * Apply to: /api/*, /events
 * Limit: 100 requests per minute
 */
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip logic: Admin bypass and Health check bypass
  skip: (req) => {
    // Bypass health/debug routes
    if (req.path === "/redis-test") return true;

    // Bypass for admins and organizers
    return req.user?.role === "admin" || req.user?.role === "organizer";
  }
});

module.exports = {
  authLimiter,
  activityLimiter,
  generalLimiter
};
