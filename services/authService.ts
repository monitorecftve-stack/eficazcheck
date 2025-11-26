import { User } from '../types';

const MOCK_USERS: User[] = [
    { username: 'admin', name: 'Administrador Geral', role: 'admin' },
    { username: 'carlos', name: 'Carlos Silva', role: 'user' },
    { username: 'ana', name: 'Ana Pereira', role: 'user' },
    { username: 'joao', name: 'João Santos', role: 'user' },
    { username: 'mariana', name: 'Mariana Costa', role: 'user' },
];

const SEPARATORS_KEY = 'app_separators_list';
const SESSION_KEY = 'app_current_user';

export const login = async (username: string, password: string): Promise<User | null> => {
    // Simulação de delay de rede
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Lógica de senha simples para demonstração (senha = 1234 ou igual ao user)
    if (password === '1234' || password === username) { 
        const user = MOCK_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
        // Se usuário não existir no mock, cria um genérico para não bloquear o teste
        const loggedUser = user || { username, name: username.charAt(0).toUpperCase() + username.slice(1), role: 'user' };
        
        localStorage.setItem(SESSION_KEY, JSON.stringify(loggedUser));
        return loggedUser;
    }
    return null;
};

export const logout = () => {
    localStorage.removeItem(SESSION_KEY);
};

export const getCurrentUser = (): User | null => {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
};

export const getSeparators = (): string[] => {
    const stored = localStorage.getItem(SEPARATORS_KEY);
    return stored ? JSON.parse(stored) : ['Pedro Souza', 'Fernanda Lima', 'Lucas Mendes', 'Roberto Alves'];
};

export const addSeparator = (name: string) => {
    if (!name) return;
    const current = getSeparators();
    // Verifica se já existe (case insensitive)
    if (!current.some(s => s.toLowerCase() === name.toLowerCase())) {
        const updated = [...current, name].sort();
        localStorage.setItem(SEPARATORS_KEY, JSON.stringify(updated));
    }
};