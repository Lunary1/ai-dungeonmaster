// Rate limiter for AI endpoints
const rateLimitMap = new Map();

/**
 * Simple in-memory rate limiter for AI narration requests
 * @param {string} key - Unique key for rate limiting (e.g., `${userId}-${campaignId}`)
 * @param {number} maxRequests - Maximum requests allowed (default: 12)
 * @param {number} windowMs - Time window in milliseconds (default: 1 hour)
 * @returns {object} - { allowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(
  key,
  maxRequests = 12,
  windowMs = 60 * 60 * 1000
) {
  const now = Date.now();

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, {
      requests: 1,
      resetTime: now + windowMs,
    });

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    };
  }

  const limit = rateLimitMap.get(key);

  // Reset window if expired
  if (now > limit.resetTime) {
    rateLimitMap.set(key, {
      requests: 1,
      resetTime: now + windowMs,
    });

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    };
  }

  // Check if under limit
  if (limit.requests < maxRequests) {
    limit.requests++;

    return {
      allowed: true,
      remaining: maxRequests - limit.requests,
      resetTime: limit.resetTime,
    };
  }

  // Rate limited
  return {
    allowed: false,
    remaining: 0,
    resetTime: limit.resetTime,
  };
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimit() {
  const now = Date.now();

  for (const [key, limit] of rateLimitMap.entries()) {
    if (now > limit.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

// Cleanup every 10 minutes
setInterval(cleanupRateLimit, 10 * 60 * 1000);

export default {
  checkRateLimit,
  cleanupRateLimit,
};
