import { Server, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';

interface UserSocket extends Socket {
  userId?: string;
  username?: string;
}

const documentRooms = new Map<string, Set<string>>();
const userCursors = new Map<string, Map<string, any>>();

export function setupSocketHandlers(io: Server, supabase: SupabaseClient) {
  io.on('connection', (socket: UserSocket) => {
    console.log(`User connected: ${socket.id}`);

    // User joins with authentication
    socket.on('user:join', async (data: { userId: string; username: string }) => {
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

    // Join document room
    socket.on('document:join', async (data: { documentId: string }) => {
      const { documentId } = data;
      
      if (!socket.userId || !socket.username) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }

      // Leave previous document room if any
      const rooms = Array.from(socket.rooms);
      const docRooms = rooms.filter(room => room.startsWith('doc:'));
      docRooms.forEach(room => {
        socket.leave(room);
        const oldDocId = room.substring(4);
        if (documentRooms.has(oldDocId)) {
          documentRooms.get(oldDocId)?.delete(socket.userId!);
          if (documentRooms.get(oldDocId)?.size === 0) {
            documentRooms.delete(oldDocId);
            userCursors.delete(oldDocId);
          }
        }
      });

      // Join new document room
      const roomName = `doc:${documentId}`;
      socket.join(roomName);

      // Track users in document
      if (!documentRooms.has(documentId)) {
        documentRooms.set(documentId, new Set());
        userCursors.set(documentId, new Map());
      }
      documentRooms.get(documentId)?.add(socket.userId);

      // Get current users in document
      const usersInDoc = Array.from(documentRooms.get(documentId) || []);
      const { data: users } = await supabase
        .from('users')
        .select('id, username')
        .in('id', usersInDoc);

      // Notify others that user joined
      socket.to(roomName).emit('user:joined', {
        userId: socket.userId,
        username: socket.username
      });

      // Send current presence to new user
      socket.emit('presence:update', {
        users: users || [],
        cursors: Object.fromEntries(userCursors.get(documentId) || [])
      });

      console.log(`User ${socket.username} joined document ${documentId}`);
    });

    // Handle document content changes
    socket.on('document:change', (data: {
      documentId: string;
      content: string;
      delta?: any;
      version?: number;
    }) => {
      if (!socket.userId) return;

      const roomName = `doc:${data.documentId}`;
      
      // Broadcast to others in the room
      socket.to(roomName).emit('document:changed', {
        content: data.content,
        delta: data.delta,
        version: data.version,
        userId: socket.userId,
        username: socket.username,
        timestamp: new Date().toISOString()
      });

      // Throttled save to database (in real app, implement proper throttling)
      setTimeout(async () => {
        await supabase
          .from('documents')
          .update({
            content: data.content,
            last_edited: new Date().toISOString(),
            last_edited_by: socket.userId
          })
          .eq('id', data.documentId);
      }, 1000);
    });

    // Handle cursor position updates
    socket.on('cursor:update', (data: {
      documentId: string;
      position: any;
      selection?: any;
    }) => {
      if (!socket.userId || !socket.username) return;

      const roomName = `doc:${data.documentId}`;
      const docCursors = userCursors.get(data.documentId);
      
      if (docCursors) {
        docCursors.set(socket.userId, {
          userId: socket.userId,
          username: socket.username,
          position: data.position,
          selection: data.selection,
          timestamp: Date.now()
        });

        // Broadcast cursor position to others
        socket.to(roomName).emit('cursor:updated', {
          userId: socket.userId,
          username: socket.username,
          position: data.position,
          selection: data.selection
        });
      }
    });

    // Handle chat messages
    socket.on('chat:message', async (data: {
      documentId: string;
      message: string;
    }) => {
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

    // Handle typing indicators
    socket.on('chat:typing', (data: {
      documentId: string;
      isTyping: boolean;
    }) => {
      if (!socket.userId || !socket.username) return;

      const roomName = `doc:${data.documentId}`;
      socket.to(roomName).emit('chat:user_typing', {
        userId: socket.userId,
        username: socket.username,
        isTyping: data.isTyping
      });
    });

    // Handle editor typing indicators
    socket.on('editor:typing', (data: {
      documentId: string;
      isTyping: boolean;
    }) => {
      if (!socket.userId || !socket.username) return;

      const roomName = `doc:${data.documentId}`;
      socket.to(roomName).emit('editor:user_typing', {
        userId: socket.userId,
        username: socket.username,
        isTyping: data.isTyping
      });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);

      if (socket.userId) {
        // Remove from all document rooms
        const rooms = Array.from(socket.rooms);
        const docRooms = rooms.filter(room => room.startsWith('doc:'));
        
        for (const room of docRooms) {
          const documentId = room.substring(4);
          
          // Remove user from document tracking
          if (documentRooms.has(documentId)) {
            documentRooms.get(documentId)?.delete(socket.userId);
            if (documentRooms.get(documentId)?.size === 0) {
              documentRooms.delete(documentId);
              userCursors.delete(documentId);
            }
          }

          // Remove cursor
          userCursors.get(documentId)?.delete(socket.userId);

          // Notify others that user left
          socket.to(room).emit('user:left', {
            userId: socket.userId,
            username: socket.username
          });
        }

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
}