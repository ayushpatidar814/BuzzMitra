/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import api from "../api/axios";
import { fetchConnections, resetConnections } from "../features/connections/connectionsSlice";
import { clearUser, setUser } from "../features/user/userSlice";

const AuthContext = createContext(null);

const TOKEN_KEY = "buzzmitra_token";
const NEXT_PATH_KEY = "buzzmitra_next_path";

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [ready, setReady] = useState(false);
  const dispatch = useDispatch();

  const setToken = useCallback((value) => {
    if (value) {
      localStorage.setItem(TOKEN_KEY, value);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(value || "");
  }, []);

  const hydrate = useCallback(async (nextToken = token) => {
    if (!nextToken) {
      dispatch(clearUser());
      dispatch(resetConnections());
      setReady(true);
      return null;
    }

    try {
      const { data } = await api.get("/api/user/data", {
        headers: { Authorization: `Bearer ${nextToken}` },
      });
      if (!data.success) throw new Error(data.message);
      dispatch(setUser(data.user));
      dispatch(fetchConnections(nextToken));
      return data.user;
    } catch {
      setToken("");
      dispatch(clearUser());
      dispatch(resetConnections());
      return null;
    } finally {
      setReady(true);
    }
  }, [dispatch, token, setToken]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const login = useCallback(async (payload) => {
    const { data } = await api.post("/api/user/login", payload);
    if (!data.success) throw new Error(data.message);
    setToken(data.token);
    dispatch(setUser(data.user));
    dispatch(fetchConnections(data.token));
    return data.user;
  }, [dispatch, setToken]);

  const register = useCallback(async (payload) => {
    const { data } = await api.post("/api/user/register", payload);
    if (!data.success) throw new Error(data.message);
    setToken(data.token);
    dispatch(setUser(data.user));
    dispatch(fetchConnections(data.token));
    return data.user;
  }, [dispatch, setToken]);

  const logout = useCallback(() => {
    setToken("");
    dispatch(clearUser());
    dispatch(resetConnections());
  }, [dispatch, setToken]);

  const startOAuth = useCallback(async (provider, nextPath = "/app") => {
    sessionStorage.setItem(NEXT_PATH_KEY, nextPath);
    const { data } = await api.get(`/api/user/oauth/${provider}`);
    if (!data.success) throw new Error(data.message);
    window.location.href = data.url;
  }, []);

  const finishOAuth = useCallback(async (nextToken) => {
    setToken(nextToken);
    return hydrate(nextToken);
  }, [hydrate, setToken]);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      ready,
      authHeaders,
      getToken: async () => token,
      login,
      register,
      logout,
      hydrate,
      startOAuth,
      finishOAuth,
      consumeNextPath: () => {
        const nextPath = sessionStorage.getItem(NEXT_PATH_KEY) || "/app";
        sessionStorage.removeItem(NEXT_PATH_KEY);
        return nextPath;
      },
    }),
    [token, ready, authHeaders, login, register, logout, hydrate, startOAuth, finishOAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
