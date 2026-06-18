import redisClient from '../config/redis.js';

const rateLimiter = async (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const redisKey = `rate-limit:login:${ip}`;

    const LIMIT = 5; 
    const WINDOW_SIZE = 60; // 1 minute

    try {
        // Safe check: increment counter
        const current = await redisClient.incr(redisKey);

        // If it equals 1, it's a brand new key window. Set expiration safely.
        if (current === 1) {
            await redisClient.expire(redisKey, WINDOW_SIZE);
        } else {
            // Backup check: If for some reason the key has no expiry (due to a race condition), fix it.
            const ttl = await redisClient.ttl(redisKey);
            if (ttl === -1) {
                await redisClient.expire(redisKey, WINDOW_SIZE);
            }
        }

        // Block if limit exceeded
        if (current > LIMIT) {
            return res.status(429).json({
                status: 'fail',
                message: 'Too many login attempts. Please try again after 1 minute.',
            });
        }

        console.log(`IP ${ip} has made ${current} / ${LIMIT} attempts.`);
        return next();
    } catch (error) {
        console.error('Rate Limiter Error:', error);
        return next(); // Fail-safe
    }
};

export default rateLimiter;
