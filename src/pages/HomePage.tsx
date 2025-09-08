import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Calendar, Edit3, LogOut, Search, Filter } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  created_at: string;
  last_edited: string;
}

const HomePage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchDocuments();
  }, [user, navigate]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim() || !user) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newDocTitle.trim(),
          userId: user.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments([data.document, ...documents]);
        setNewDocTitle('');
        navigate(`/document/${data.document.id}`);
      }
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Failed to create document');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const filteredDocuments = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">DocSpace</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden sm:block text-white/80">
                Welcome back, <span className="font-semibold text-white">{user?.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-white/80 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-12 fade-in">
          <h2 className="text-4xl font-bold text-white mb-4">
            Your Document Workspace
          </h2>
          <p className="text-xl text-white/80">
            Create, collaborate, and bring your ideas to life
          </p>
        </div>

        {/* Create Document Section */}
        <div className="mb-8 slide-up">
          <div className="card-glass rounded-2xl p-6 md:p-8">
            <div className="flex items-center space-x-3 mb-6">
              <Plus className="w-6 h-6 text-indigo-600" />
              <h3 className="text-2xl font-bold text-gray-900">Create New Document</h3>
            </div>
            
            <form onSubmit={createDocument} className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Give your document a title..."
                className="input-modern flex-1"
                required
                disabled={isCreating}
              />
              <button
                type="submit"
                disabled={isCreating || !newDocTitle.trim()}
                className="btn-primary shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isCreating ? (
                  <div className="flex items-center space-x-2">
                    <div className="loading-spinner w-4 h-4"></div>
                    <span>Creating...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Plus className="w-5 h-5" />
                    <span>Create Document</span>
                  </div>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Documents Section */}
        <div className="slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
            <h3 className="text-2xl font-bold text-white flex items-center space-x-3">
              <FileText className="w-6 h-6" />
              <span>Your Documents</span>
              {documents.length > 0 && (
                <span className="text-sm bg-white/20 text-white px-3 py-1 rounded-full">
                  {documents.length}
                </span>
              )}
            </h3>
            
            {documents.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-md"
                />
              </div>
            )}
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="card-glass rounded-2xl p-12 text-center">
              {documents.length === 0 ? (
                <>
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">No documents yet</h4>
                  <p className="text-gray-600 mb-6">Create your first document to get started with collaborative editing</p>
                  <button
                    onClick={() => document.querySelector('input[placeholder*="title"]')}
                    className="btn-primary"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create Your First Document
                  </button>
                </>
              ) : (
                <>
                  <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">No documents found</h4>
                  <p className="text-gray-600">Try adjusting your search terms</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocuments.map((doc, index) => (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/document/${doc.id}`)}
                  className="card-glass rounded-xl p-6 cursor-pointer transition-all duration-200 hover:scale-105 group"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Edit3 className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-xs text-gray-500 flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(doc.last_edited).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <h4 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {doc.title}
                  </h4>
                  
                  <p className="text-sm text-gray-600">
                    Last edited: {new Date(doc.last_edited).toLocaleString()}
                  </p>
                  
                  <div className="mt-4 flex items-center text-sm text-indigo-600 group-hover:text-indigo-700">
                    <span>Open document</span>
                    <Edit3 className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;