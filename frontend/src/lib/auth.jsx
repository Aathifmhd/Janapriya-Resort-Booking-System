import { createContext, useContext, useEffect, useState } from 'react';
import { api, setSession, clearSession, getStoredUser, getToken } from './api';
import { setCurrencySymbol } from './format';

const AuthCtx = createContext(null);

// Which roles see each staff-portal menu section. Links inside a section are further limited to
// the modules the server allows for the user (user.modules), so no link leads to an access error.
export const SECTION_ACCESS = {
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
  // moduleKey is a key of MODULE_ACCESS in backend/src/auth.js
  const can = (moduleKey) => !!user?.modules?.includes(moduleKey);
  const canSection = (section) => !!user && (['admin', 'manager'].includes(user.role) || (SECTION_ACCESS[section] || []).includes(user.role));

  return <AuthCtx.Provider value={{ user, login, logout, can, canSection, loading, settings, setSettings }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
