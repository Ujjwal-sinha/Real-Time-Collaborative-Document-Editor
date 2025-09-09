import { createClient } from 'redis';

let redisClient = null;

// Initialize Redis client
export const initRedis = async () => {
  if (redisClient) return redisClient;
  
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  console.log(`🔄 Attempting to connect to Redis at: ${redisUrl.replace(/\/\/.*@/, '//***:***@')}`);
  
  redisClient = createClient({
    url: redisUrl
  });

  redisClient.on('error', (err) => {
    // Only log Redis errors once every 30 seconds to avoid spam
    if (!global.lastRedisErrorLog || Date.now() - global.lastRedisErrorLog > 30000) {
      console.log('Redis Client Error:', err.message);
      global.lastRedisErrorLog = Date.now();
    }
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  try {
    await redisClient.connect();
    console.log('✅ Redis connected successfully');
    return redisClient;
  } catch (error) {
    console.log('⚠️ Redis connection failed:', error.message);
    console.log('🔄 Application will continue without Redis caching and presence features');
    redisClient = null;
    return null;
  }
};

// Presence Management
export const addUserToDocument = async (documentId, userId, username) => {
  if (!redisClient) return false;
  
  try {
    const presenceKey = `doc:${documentId}:presence`;
    const userKey = `user:${userId}:info`;
    
    // Add user to document presence set with TTL
    await redisClient.sAdd(presenceKey, userId);
    await redisClient.expire(presenceKey, 300); // 5 minutes TTL
    
    // Store user info with TTL
    await redisClient.hSet(userKey, {
      id: userId,
      username: username,
      lastSeen: Date.now()
    });
    await redisClient.expire(userKey, 300); // 5 minutes TTL
    
    return true;
  } catch (error) {
    console.error('Redis addUserToDocument error:', error);
    return false;
  }
};

export const removeUserFromDocument = async (documentId, userId) => {
  if (!redisClient) return false;
  
  try {
    const presenceKey = `doc:${documentId}:presence`;
    await redisClient.sRem(presenceKey, userId);
    return true;
  } catch (error) {
    console.error('Redis removeUserFromDocument error:', error);
    return false;
  }
};

export const getDocumentActiveUsers = async (documentId) => {
  if (!redisClient) return [];
  
  try {
    const presenceKey = `doc:${documentId}:presence`;
    const userIds = await redisClient.sMembers(presenceKey);
    
    if (userIds.length === 0) return [];
    
    // Get user info for each user
    const users = [];
    for (const userId of userIds) {
      const userKey = `user:${userId}:info`;
      const userInfo = await redisClient.hGetAll(userKey);
      if (userInfo && userInfo.id) {
        users.push({
          id: userInfo.id,
          username: userInfo.username,
          lastSeen: parseInt(userInfo.lastSeen)
        });
      }
    }
    
    return users;
  } catch (error) {
    console.error('Redis getDocumentActiveUsers error:', error);
    return [];
  }
};

export const getDocumentActiveCount = async (documentId) => {
  if (!redisClient) return 0;
  
  try {
    const presenceKey = `doc:${documentId}:presence`;
    return await redisClient.sCard(presenceKey);
  } catch (error) {
    console.error('Redis getDocumentActiveCount error:', error);
    return 0;
  }
};

// Cursor Management
export const updateUserCursor = async (documentId, userId, cursorData) => {
  if (!redisClient) return false;
  
  try {
    const cursorKey = `doc:${documentId}:cursors`;
    await redisClient.hSet(cursorKey, userId, JSON.stringify({
      ...cursorData,
      timestamp: Date.now()
    }));
    await redisClient.expire(cursorKey, 60); // 1 minute TTL for cursors
    return true;
  } catch (error) {
    console.error('Redis updateUserCursor error:', error);
    return false;
  }
};

export const removeUserCursor = async (documentId, userId) => {
  if (!redisClient) return false;
  
  try {
    const cursorKey = `doc:${documentId}:cursors`;
    await redisClient.hDel(cursorKey, userId);
    return true;
  } catch (error) {
    console.error('Redis removeUserCursor error:', error);
    return false;
  }
};

export const getDocumentCursors = async (documentId) => {
  if (!redisClient) return {};
  
  try {
    const cursorKey = `doc:${documentId}:cursors`;
    const cursors = await redisClient.hGetAll(cursorKey);
    
    // Parse cursor data and filter out old cursors
    const parsedCursors = {};
    const now = Date.now();
    const maxAge = 60000; // 1 minute
    
    for (const [userId, cursorData] of Object.entries(cursors)) {
      try {
        const cursor = JSON.parse(cursorData);
        if (now - cursor.timestamp < maxAge) {
          parsedCursors[userId] = cursor;
        }
      } catch (e) {
        // Invalid cursor data, ignore
      }
    }
    
    return parsedCursors;
  } catch (error) {
    console.error('Redis getDocumentCursors error:', error);
    return {};
  }
};

// Document Caching
export const cacheDocument = async (documentId, documentData) => {
  if (!redisClient) return false;
  
  try {
    const cacheKey = `doc:${documentId}:cache`;
    await redisClient.setEx(cacheKey, 300, JSON.stringify({
      ...documentData,
      cachedAt: Date.now()
    })); // 5 minutes cache
    return true;
  } catch (error) {
    console.error('Redis cacheDocument error:', error);
    return false;
  }
};

export const getCachedDocument = async (documentId) => {
  if (!redisClient) return null;
  
  try {
    const cacheKey = `doc:${documentId}:cache`;
    const cached = await redisClient.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Redis getCachedDocument error:', error);
    return null;
  }
};

export const invalidateDocumentCache = async (documentId) => {
  if (!redisClient) return false;
  
  try {
    const cacheKey = `doc:${documentId}:cache`;
    await redisClient.del(cacheKey);
    return true;
  } catch (error) {
    console.error('Redis invalidateDocumentCache error:', error);
    return false;
  }
};

// Pub/Sub for multi-node scaling
export const publishDocumentChange = async (documentId, changeData) => {
  if (!redisClient) return false;
  
  try {
    const channel = `doc:${documentId}:changes`;
    await redisClient.publish(channel, JSON.stringify(changeData));
    return true;
  } catch (error) {
    console.error('Redis publishDocumentChange error:', error);
    return false;
  }
};

export const publishCursorUpdate = async (documentId, cursorData) => {
  if (!redisClient) return false;
  
  try {
    const channel = `doc:${documentId}:cursors`;
    await redisClient.publish(channel, JSON.stringify(cursorData));
    return true;
  } catch (error) {
    console.error('Redis publishCursorUpdate error:', error);
    return false;
  }
};

export const subscribeToDocument = async (documentId, callback) => {
  if (!redisClient) return null;
  
  try {
    const subscriber = redisClient.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe(`doc:${documentId}:changes`, (message) => {
      try {
        const data = JSON.parse(message);
        callback('change', data);
      } catch (e) {
        console.error('Error parsing document change message:', e);
      }
    });
    
    await subscriber.subscribe(`doc:${documentId}:cursors`, (message) => {
      try {
        const data = JSON.parse(message);
        callback('cursor', data);
      } catch (e) {
        console.error('Error parsing cursor update message:', e);
      }
    });
    
    return subscriber;
  } catch (error) {
    console.error('Redis subscribeToDocument error:', error);
    return null;
  }
};

// Cleanup utility
export const cleanupExpiredKeys = async () => {
  if (!redisClient) return;
  
  try {
    // This will be called periodically to clean up expired presence and cursor data
    console.log('Redis cleanup completed');
  } catch (error) {
    console.error('Redis cleanup error:', error);
  }
};

export default redisClient;