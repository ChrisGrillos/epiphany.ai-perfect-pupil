import { createContext, useState, useContext, useEffect } from 'react';
import { localSession } from '@/api/pupilClient';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setError] = useState(null);
  const checkAppState = async () => {
    setLoading(true); setError(null);
    try { const session = await localSession(); setUser(session.user); }
    catch (error) { setError({ type: 'service_unavailable', message: error.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { checkAppState(); }, []);
  return <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isLoadingAuth: loading, isLoadingPublicSettings: false, authError, checkAppState }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
