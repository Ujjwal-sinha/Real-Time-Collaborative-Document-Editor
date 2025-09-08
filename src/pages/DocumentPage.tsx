import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

interface Message {
  id: string;
  message: string;
  user: { username: string };
  created_at: string;
}

interface Document {
  id: string;
  title: string;
  content: string;
}

const DocumentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  
  const [document, setDocument] = useState<Document | null>(null);
  const [content, setContent] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [cursors, setCursors] = useState<any>({});
  
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    if (!id) {
      navigate('/home');
      return;
    }

    fetchDocument();
  }, [user, id, navigate]);

  useEffect(() => {
    if (socket && id && isConnected) {
      // Join document room
      socket.emit('document:join', { documentId: id });

      // Listen for document changes
      socket.on('document:changed', (data) => {
        if (data.userId !== user?.id) {
          setContent(data.content);
        }
      });

      // Listen for new chat messages
      socket.on('chat:new_message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      // Listen for user presence updates
      socket.on('user:joined', (userData) => {
        setActiveUsers(prev => [...prev.filter(u => u.id !== userData.userId), userData]);
      });

      socket.on('user:left', (userData) => {
        setActiveUsers((prev: any[]) => prev.filter(u => u.id !== userData.userId));
        setCursors((prev: any) => {
          const newCursors = { ...prev };
          delete newCursors[userData.userId];
          return newCursors;
        });
      });

      // Listen for cursor updates
      socket.on('cursor:updated', (cursorData) => {
        if (cursorData.userId !== user?.id) {
          setCursors((prev: any) => ({
            ...prev,
            [cursorData.userId]: cursorData
          }));
        }
      });

      // Listen for presence updates (includes cursors)
      socket.on('presence:update', (data) => {
        setActiveUsers(data.users || []);
        setCursors(data.cursors || {});
      });

      return () => {
        socket.off('document:changed');
        socket.off('chat:new_message');
        socket.off('user:joined');
        socket.off('user:left');
        socket.off('cursor:updated');
        socket.off('presence:update');
      };
    }
  }, [socket, id, isConnected, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchDocument = async () => {
    try {
      const response = await fetch(`/api/documents/${id}`);
      if (response.ok) {
        const data = await response.json();
        setDocument(data.document);
        setContent(data.document.content || '');
        setMessages(data.messages || []);
      } else {
        navigate('/home');
      }
    } catch (error) {
      console.error('Error fetching document:', error);
      navigate('/home');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Emit changes to other users
    if (socket && id) {
      socket.emit('document:change', {
        documentId: id,
        content: newContent,
      });
    }

    // Debounced save to backend
    saveContent(newContent);
  };

  const handleCursorChange = () => {
    if (!contentRef.current || !socket || !id || !user) return;

    const textarea = contentRef.current;
    const position = textarea.selectionStart;
    const selection = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd
    };

    // Emit cursor position to other users
    socket.emit('cursor:update', {
      documentId: id,
      position,
      selection
    });
  };

  const saveContent = useRef(
    debounce(async (content: string) => {
      if (!id || !user) return;
      
      try {
        await fetch(`/api/documents/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content,
            userId: user.id,
          }),
        });
      } catch (error) {
        console.error('Error saving document:', error);
      }
    }, 1000)
  ).current;

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !id) return;

    socket.emit('chat:message', {
      documentId: id,
      message: newMessage.trim(),
    });

    setNewMessage('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading document...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-red-600">Document not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/home')}
              className="text-blue-600 hover:text-blue-800"
            >
              ← Back to Documents
            </button>
            <h1 className="text-xl font-semibold">{document.title}</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <button
              onClick={() => setShowChat(!showChat)}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              {showChat ? 'Hide Chat' : 'Show Chat'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Editor */}
        <div className={`${showChat ? 'flex-1' : 'w-full'} p-6`}>
          <div className="bg-white rounded-lg shadow-md h-full">
            <div className="p-4 border-b">
              <h2 className="font-medium">Document Editor</h2>
              {activeUsers.length > 0 && (
                <div className="mt-2 flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Active users:</span>
                  {activeUsers.map((user, index) => (
                    <span key={user.id || index} className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {user.username}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="relative h-full">
              <textarea
                ref={contentRef}
                value={content}
                onChange={handleContentChange}
                onSelect={handleCursorChange}
                onKeyUp={handleCursorChange}
                onClick={handleCursorChange}
                className="w-full h-full p-4 border-none outline-none resize-none font-mono text-sm relative z-10"
                placeholder="Start writing your document..."
              />
              
              {/* Live Cursors Display */}
              <div className="absolute inset-0 p-4 pointer-events-none z-20">
                {Object.values(cursors).map((cursor: any) => {
                  if (!cursor || cursor.userId === user?.id) return null;
                  
                  // Calculate cursor position (simplified)
                  const lines = content.substring(0, cursor.position).split('\n');
                  const lineNumber = lines.length - 1;
                  const columnNumber = lines[lines.length - 1].length;
                  
                  const lineHeight = 20; // Approximate line height
                  const charWidth = 7; // Approximate character width for monospace
                  
                  const top = lineNumber * lineHeight;
                  const left = columnNumber * charWidth;
                  
                  return (
                    <div
                      key={cursor.userId}
                      className="absolute"
                      style={{
                        top: `${top}px`,
                        left: `${left}px`,
                      }}
                    >
                      <div className="w-0.5 h-5 bg-blue-500 animate-pulse"></div>
                      <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-1 rounded whitespace-nowrap">
                        {cursor.username}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-80 bg-white border-l shadow-sm flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-medium">Chat</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, index) => (
                <div key={msg.id || index} className="text-sm">
                  <div className="font-medium text-gray-800">{msg.user.username}</div>
                  <div className="text-gray-600">{msg.message}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

// Utility function for debouncing
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default DocumentPage;