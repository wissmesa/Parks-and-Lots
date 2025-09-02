export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER';
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse extends AuthTokens {
  user: User;
}

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

export class AuthManager {
  static getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  static getUser(): User | null {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  static setAuth(authResponse: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, authResponse.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, authResponse.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
  }

  static clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  static isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser();
  }

  static isAdmin(): boolean {
    const user = this.getUser();
    return user?.role === 'ADMIN';
  }

  static isManager(): boolean {
    const user = this.getUser();
    return user?.role === 'MANAGER';
  }

  static getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
