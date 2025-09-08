import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createClient as createRedisClient } from 'redis';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// Initialize Redis
const redis = createRedisClient({
  url: 'redis://127.0.0.1:6379'
});

redis.on('error', (err) => {
  console.log('Redis Client Error:', err);
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

// Connect to Redis
(async () => {
  try {
    await redis.connect();
  } catch (error) {
    console.log('Redis connection failed:', error.message);
  }
})();

// Middleware
app.use(cors());
app.use(express.json());

// Simple auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Check if user exists
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.trim())
      .single();

    let user;
    if (findError && findError.code === 'PGRST116') {
      // User doesn't exist, create new one
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            username: username.trim(),
            last_seen: new Date().toISOString(),
            is_active: true
          }
        ])
        .select()
        .single();

      if (createError) {
        throw createError;
      }
      user = newUser;
    } else if (findError) {
      throw findError;
    } else {
      // User exists, update last_seen and set active
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          last_seen: new Date().toISOString(),
          is_active: true
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }
      user = updatedUser;
    }

    res.json({
      user,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    // Set user as inactive
    await supabase
      .from('users')
      .update({
        is_active: false,
        last_seen: new Date().toISOString()
      })
      .eq('id', userId);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simple document routes
app.get('/api/documents', async (req, res) => {
  try {
    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .order('last_edited', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ documents: documents || [] });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/documents', async (req, res) => {
  try {
    const { title, userId } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ error: 'Title and userId are required' });
    }

    const { data: document, error } = await supabase
      .from('documents')
      .insert([
        {
          title: title.trim(),
          content: '',
          created_by: userId,
          last_edited: new Date().toISOString(),
          last_edited_by: userId
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({ document });
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific document
app.get('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError) {
      if (docError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Document not found' });
      }
      throw docError;
    }

    // Get chat messages for this document
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select(`
        *,
        user:users(username)
      `)
      .eq('document_id', id)
      .order('created_at', { ascending: true })
      .limit(50);

    res.json({
      document,
      messages: messages || []
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update document content
app.put('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, userId } = req.body;

    if (!content || !userId) {
      return res.status(400).json({ error: 'Content and userId are required' });
    }

    const { data: document, error } = await supabase
      .from('documents')
      .update({
        content,
        last_edited: new Date().toISOString(),
        last_edited_by: userId
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({ document });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.IO handlers
const documentRooms = new Map();
const userCursors = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('user:join', async (data) => {
    socket.userId = data.userId;
    socket.username = data.username;
    
    // Update user as active in database
    await supabase
      .from('users')
      .update({
        is_active: true,
        last_seen: new Date().toISOString()
      })
      .eq('id', data.userId);

    console.log(`User ${data.username} (${data.userId}) joined`);
  });

  socket.on('document:join', async (data) => {
    const { documentId } = data;
    
    if (!socket.userId || !socket.username) {
      socket.emit('error', { message: 'User not authenticated' });
      return;
    }

    const roomName = `doc:${documentId}`;
    socket.join(roomName);

    // Track users in document
    if (!documentRooms.has(documentId)) {
      documentRooms.set(documentId, new Set());
      userCursors.set(documentId, new Map());
    }
    documentRooms.get(documentId).add(socket.userId);

    // Notify others that user joined
    socket.to(roomName).emit('user:joined', {
      userId: socket.userId,
      username: socket.username
    });

    console.log(`User ${socket.username} joined document ${documentId}`);
  });

  // Handle document content changes
  socket.on('document:change', (data) => {
    if (!socket.userId) return;

    const roomName = `doc:${data.documentId}`;
    
    // Broadcast to others in the room
    socket.to(roomName).emit('document:changed', {
      content: data.content,
      userId: socket.userId,
      username: socket.username,
      timestamp: new Date().toISOString()
    });
  });

  // Handle chat messages
  socket.on('chat:message', async (data) => {
    if (!socket.userId || !socket.username) return;

    try {
      // Save message to database
      const { data: messageData, error } = await supabase
        .from('chat_messages')
        .insert([{
          document_id: data.documentId,
          user_id: socket.userId,
          message: data.message,
          created_at: new Date().toISOString()
        }])
        .select(`
          *,
          user:users(username)
        `)
        .single();

      if (error) throw error;

      const roomName = `doc:${data.documentId}`;
      
      // Broadcast message to all users in document
      io.to(roomName).emit('chat:new_message', messageData);
    } catch (error) {
      console.error('Chat message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);

    if (socket.userId) {
      // Update user as inactive in database
      await supabase
        .from('users')
        .update({
          is_active: false,
          last_seen: new Date().toISOString()
        })
        .eq('id', socket.userId);
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, 'localhost', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});