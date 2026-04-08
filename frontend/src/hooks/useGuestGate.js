import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const MAX_INTERACTIONS = 1000;
const MAX_SESSION_MS = 5 * 60 * 1000;

export const useGuestGate = () => {
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const interactionsRef = useRef(0);
  const startedRef = useRef(false);

  const redirectToLogin = useCallback(() => {
    const next = `${window.location.pathname}${window.location.search || ""}`;
    navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
  }, [navigate]);

  const startGate = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    timerRef.current = window.setTimeout(redirectToLogin, MAX_SESSION_MS);
  }, [redirectToLogin]);

  const registerInteraction = useCallback(() => {
    startGate();
    interactionsRef.current += 1;
    if (interactionsRef.current >= MAX_INTERACTIONS) {
      redirectToLogin();
    }
  }, [redirectToLogin, startGate]);

  useEffect(() => () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
  }, []);

  return { registerInteraction, startGate };
};
