import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { 
  ArrowLeft, 
  MessageCircle, 
  Users, 
  Save, 
  Wifi, 
  WifiOff, 
  Send,
  X,
  FileText,
  EyeOff
} from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-white/60 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Document not found</h2>
          <p className="text-white/80 mb-6">The document you're looking for doesn't exist or has been deleted.</p>
          <button
            onClick={() => navigate('/home')}
            className="btn-primary"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-full mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/home')}
                className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white truncate max-w-xs sm:max-w-md">
                  {document.title}
                </h1>
                <p className="text-sm text-white/60">Collaborative Document</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-red-400">Disconnected</span>
                  </>
                )}
              </div>
              
              {/* Active Users */}
              {activeUsers.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white/80">{activeUsers.length}</span>
                </div>
              )}
              
              {/* Chat Toggle */}
              <button
                onClick={() => setShowChat(!showChat)}
                className="flex items-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
              >
                {showChat ? (
                  <>
                    <EyeOff className="w-4 h-4 text-white" />
                    <span className="hidden sm:inline text-white text-sm">Hide Chat</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 text-white" />
                    <span className="hidden sm:inline text-white text-sm">Show Chat</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className={`${showChat ? 'flex-1' : 'w-full'} flex flex-col`}>
          <div className="flex-1 m-4 card-glass rounded-2xl overflow-hidden">
            {/* Editor Header */}
            <div className="p-4 border-b border-gray-200 bg-white/50">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-semibold text-gray-900 flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Document Editor</span>
                  </h2>
                  {activeUsers.length > 0 && (
                    <div className="mt-2 flex items-center space-x-2 flex-wrap">
                      <span className="text-sm text-gray-600">Active users:</span>
                      {activeUsers.map((user, index) => (
                        <span key={user.id || index} className="text-xs bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1 rounded-full">
                          {user.username}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Save className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Auto-saved</span>
                </div>
              </div>
            </div>
            
            {/* Editor Content */}
            <div className="relative flex-1 overflow-hidden">
              <textarea
                ref={contentRef}
                value={content}
                onChange={handleContentChange}
                onSelect={handleCursorChange}
                onKeyUp={handleCursorChange}
                onClick={handleCursorChange}
                className="w-full h-full p-6 border-none outline-none resize-none bg-transparent relative z-10 text-gray-900 leading-relaxed"
                placeholder="Start writing your document..."
                style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '16px', lineHeight: '1.7' }}
              />
              
              {/* Live Cursors Display */}
              <div className="absolute inset-0 p-6 pointer-events-none z-20">
                {Object.values(cursors).map((cursor: any) => {
                  if (!cursor || cursor.userId === user?.id) return null;
                  
                  // Calculate cursor position (improved calculation)
                  const textarea = contentRef.current;
                  if (!textarea) return null;
                  
                  const lines = content.substring(0, cursor.position || 0).split('\n');
                  const lineNumber = lines.length - 1;
                  const columnNumber = lines[lines.length - 1]?.length || 0;
                  
                  // Get computed styles for accurate positioning
                  const computedStyle = window.getComputedStyle(textarea);
                  const lineHeight = parseFloat(computedStyle.lineHeight) || 27;
                  const fontSize = parseFloat(computedStyle.fontSize) || 16;
                  const charWidth = fontSize * 0.6; // Approximate character width
                  
                  const top = lineNumber * lineHeight + 4; // Add small offset
                  const left = columnNumber * charWidth + 2; // Add small offset
                  
                  // Generate a consistent color for each user
                  const userColorIndex = cursor.userId ? 
                    Math.abs(cursor.userId.split('').reduce((a: any, b: string) => a + b.charCodeAt(0), 0)) % 6 : 0;
                  const colors = [
                    'from-blue-500 to-blue-600',
                    'from-green-500 to-green-600', 
                    'from-purple-500 to-purple-600',
                    'from-pink-500 to-pink-600',
                    'from-yellow-500 to-yellow-600',
                    'from-red-500 to-red-600'
                  ];
                  const cursorColor = colors[userColorIndex];
                  
                  return (
                    <div
                      key={cursor.userId}
                      className="absolute transform transition-all duration-100"
                      style={{
                        top: `${Math.max(0, top)}px`,
                        left: `${Math.max(0, left)}px`,
                        zIndex: 25
                      }}
                    >
                      {/* Cursor line */}
                      <div className={`w-0.5 h-6 bg-gradient-to-b ${cursorColor} animate-pulse rounded-full shadow-sm`}></div>
                      
                      {/* Username label - FIXED: Always show username */}
                      <div 
                        className={`absolute -top-7 left-0 bg-gradient-to-r ${cursorColor} text-white text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap shadow-lg border border-white/20`}
                        style={{
                          transform: 'translateX(-50%)',
                          fontSize: '11px',
                          maxWidth: '120px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {cursor.username || 'Anonymous'}
                      </div>
                      
                      {/* Small dot indicator */}
                      <div className={`absolute -top-1 -left-1 w-2 h-2 bg-gradient-to-r ${cursorColor} rounded-full border border-white shadow-sm`}></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-80 lg:w-96 flex flex-col">
            <div className="m-4 mr-0 card-glass rounded-2xl flex flex-col h-full overflow-hidden">
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-white/50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                    <MessageCircle className="w-5 h-5" />
                    <span>Team Chat</span>
                  </h3>
                  <button
                    onClick={() => setShowChat(false)}
                    className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                {messages.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">{messages.length} messages</p>
                )}
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-white/30 to-white/10">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No messages yet</p>
                    <p className="text-gray-400 text-xs">Start a conversation with your team</p>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div key={msg.id || index} className="group">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-medium">
                            {msg.user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900 text-sm">{msg.user.username}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(msg.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-700 break-words">{msg.message}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Message Input */}
              <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 bg-white/50">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 bg-white/70 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
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