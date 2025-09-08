import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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

// Middleware
app.use(cors());
app.use(express.json());

// Import routes after supabase is initialized
const { authRouter } = await import('./routes/auth.js');
const { documentRouter } = await import('./routes/documents.js');
const { setupSocketHandlers } = await import('./socket/handlers.js');

// Routes
app.use('/api/auth', authRouter(supabase));
app.use('/api/documents', documentRouter(supabase));

// Socket.IO handlers
setupSocketHandlers(io, supabase);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, 'localhost', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export { app, io, supabase };