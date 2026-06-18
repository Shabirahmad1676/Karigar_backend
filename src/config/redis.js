import { createClient } from "redis";

const redisClient = createClient({
    // Use the variable injected by docker-compose, fall back to localhost for local npm run dev
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis client initiating connection...'));
redisClient.on('ready', () => console.log('Redis Client Ready and Connected'));

export default redisClient;
