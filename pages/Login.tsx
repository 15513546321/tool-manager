import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon } from 'lucide-react';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate Login
    if (username && password) {
      const user = {
        username,
        role: username === 'admin' ? 'ADMIN' : 'USER',
        token: 'mock-jwt-token'
      };
      localStorage.setItem('user', JSON.stringify(user));
      navigate('/dashboard');
    }
  };

  const INPUT_STYLE = "w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all text-slate-700 placeholder:text-slate-400";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
          <p className="text-slate-500 text-sm mt-2">Sign in to manage interfaces</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={INPUT_STYLE}
                placeholder="Enter username"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT_STYLE}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-500/30"
          >
            Sign In
          </button>
        </form>
        
        <div className="mt-6 text-center text-xs text-slate-400">
          Hint: Use admin / 123456
        </div>
      </div>
    </div>
  );
};