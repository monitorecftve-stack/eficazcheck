import React, { useState } from 'react';
import { PackageCheck, LogIn, Key, User as UserIcon } from 'lucide-react';
import { login } from '../services/authService';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Preencha todos os campos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await login(username, password);
      if (user) {
        onLoginSuccess(user);
      } else {
        setError('Usuário ou senha incorretos.');
      }
    } catch (err) {
      setError('Erro ao tentar conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4">
      <div className="mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-brand-600 p-4 rounded-2xl inline-block shadow-2xl shadow-brand-500/20 mb-4">
          <PackageCheck size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Confere Eficaz</h1>
        <p className="text-gray-400 mt-2">Logística Inteligente & Conferência de Saída</p>
      </div>

      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in duration-300">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Acesso ao Sistema</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuário / Matricula</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition duration-150 ease-in-out"
                  placeholder="Seu usuário"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition duration-150 ease-in-out"
                  placeholder="Sua senha"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Autenticando...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <LogIn className="mr-2 h-5 w-5" />
                    Entrar
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
           <p className="text-xs text-gray-500">
             Senha padrão para teste: <span className="font-mono font-bold">1234</span>
           </p>
        </div>
      </div>
      
      <p className="mt-8 text-center text-xs text-gray-500">
        &copy; 2024 Confere Eficaz Logística. Todos os direitos reservados.
      </p>
    </div>
  );
};

export default Login;