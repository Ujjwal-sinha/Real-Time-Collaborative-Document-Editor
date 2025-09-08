import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Zap, ArrowRight } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    try {
      await login(username.trim());
      navigate('/home');
    } catch (error) {
      alert('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full opacity-20 animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Welcome Content */}
          <div className="text-center lg:text-left space-y-8 fade-in">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                <span className="gradient-text">Collaborate</span>
                <br />
                <span className="text-white">in Real-Time</span>
              </h1>
              <p className="text-xl text-white/80 max-w-lg mx-auto lg:mx-0">
                Create, edit, and share documents with your team instantly. Experience the future of collaborative writing.
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto backdrop-blur-sm">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white">Real-time Collaboration</h3>
                <p className="text-sm text-white/70">Work together seamlessly</p>
              </div>
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto backdrop-blur-sm">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white">Rich Text Editor</h3>
                <p className="text-sm text-white/70">Professional editing tools</p>
              </div>
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto backdrop-blur-sm">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white">Lightning Fast</h3>
                <p className="text-sm text-white/70">Instant updates and sync</p>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-md">
              <div className="card-glass rounded-2xl p-8 slide-up">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                  <p className="text-gray-600">Enter your username to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="input-modern"
                      placeholder="Enter your username"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !username.trim()}
                    className="btn-primary w-full flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? (
                      <>
                        <div className="loading-spinner w-5 h-5"></div>
                        <span>Joining...</span>
                      </>
                    ) : (
                      <>
                        <span>Join Collaboration</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-xs text-gray-500 text-center">
                    By joining, you agree to collaborate respectfully with other users
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;