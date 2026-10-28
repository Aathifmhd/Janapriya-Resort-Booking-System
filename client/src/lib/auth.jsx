import { createContext, useContext, useEffect, useState } from 'react';
import { api, setSession, clearSession, getStoredUser, getToken } from './api';
import { setCurrencySymbol } from './format';

const AuthCtx = createContext(null);

// Mirror of server MODULE_ACCESS for hiding nav items (server still enforces).
export const MODULE_ACCESS = {
  frontdesk: ['frontdesk', 'housekeeping'],
  restaurant: ['restaurant', 'bar'],
  inventory: ['store', 'bar', 'restaurant', 'accounts'],
  hr: ['hr', 'accounts'],
  finance: ['accounts', 'frontdesk', 'restaurant', 'bar'],
  settings: [],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.get('/api/auth/me').then((u) => { setUser(u); }).catch(() => { clearSession(); setUser(null); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get('/api/settings').then((s) => { setSettings(s); setCurrencySymbol(s.currency_symbol); }).catch(() => {});
  }, [user]);

  const login = async (email, password) => {
    const r = await api.post('/api/auth/login', { email, password });
    setSession(r.token, r.user);
    setUser(r.user);
    return r.user;
  };
  const logout = () => { clearSession(); setUser(null); };
  const can = (moduleKey) => {
    if (!user) return false;
    if (['admin', 'manager'].includes(user.role)) return true;
    return (MODULE_ACCESS[moduleKey] || []).includes(user.role);
  };

  return <AuthCtx.Provider value={{ user, login, logout, can, loading, settings, setSettings }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
