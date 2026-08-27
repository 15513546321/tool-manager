import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { authApi } from '../services/authService';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    try {
      await authApi.login({ username, password });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const INPUT_STYLE = "w-full pl-10 pr-4 py-2.5 border border-blue-100 rounded-md bg-blue-50/40 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all text-slate-700 placeholder:text-slate-400";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-amber-50 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-blue-100 bg-white shadow-[0_24px_70px_rgba(30,64,175,0.16)]">
        <div className="h-1.5 bg-gradient-to-r from-blue-700 via-amber-400 to-emerald-500" />
        <div className="p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-blue-700 text-white shadow-[0_14px_28px_rgba(29,78,216,0.2)]">
            <Lock size={22} />
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-blue-950">公金开发辅助平台</h1>
          <p className="text-slate-500 text-sm mt-2">登录后进入研发效能与交付治理工作台</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3 text-blue-500" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={INPUT_STYLE}
                placeholder="请输入用户名"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-blue-500" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT_STYLE}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-md transition-colors shadow-lg shadow-blue-700/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>登录中...</span>
              </>
            ) : (
              <span>登录</span>
            )}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
};
