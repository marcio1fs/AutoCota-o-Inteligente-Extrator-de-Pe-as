const BACKEND_API_URL = (import.meta as any).env?.VITE_BACKEND_API_URL || '/api';
const AUTH_TOKEN_KEY = 'autoquote_auth_token_v1';

export interface LoginResponse {
  success: boolean;
  token: string;
  expiresInHours: number;
  user: {
    username: string;
  };
}

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY) || '';

export const setAuthToken = (token: string) => {
  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }

  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const getAuthHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${BACKEND_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || 'Falha ao autenticar.');
  }

  if (!payload?.token) {
    throw new Error('Resposta de login inválida.');
  }

  return payload as LoginResponse;
};

export const validateSession = async (): Promise<{ username: string }> => {
  const token = getAuthToken();
  if (!token) throw new Error('Token ausente.');

  const response = await fetch(`${BACKEND_API_URL}/auth/me`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.user?.username) {
    throw new Error(payload?.message || 'Sessão inválida.');
  }

  return { username: payload.user.username };
};
