/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "buzzmitra-ui-settings";

const defaultSettings = {
  theme: "default",
  notifications: {
    desktopToasts: true,
    messageAlerts: true,
    activityAlerts: true,
    storyReplies: true,
    groupUpdates: true,
  },
  playback: {
    autoplayReels: true,
    muteVideosByDefault: true,
    reducedDataMode: false,
    reducedMotion: false,
  },
  privacy: {
    profileVisibility: "public",
    showActiveStatus: true,
    allowMessageRequests: true,
    readReceipts: true,
  },
};

const ThemeContext = createContext(null);

const mergeSettings = (incoming = {}) => ({
  ...defaultSettings,
  ...incoming,
  notifications: {
    ...defaultSettings.notifications,
    ...(incoming.notifications || {}),
  },
  playback: {
    ...defaultSettings.playback,
    ...(incoming.playback || {}),
  },
  privacy: {
    ...defaultSettings.privacy,
    ...(incoming.privacy || {}),
  },
});

export const ThemeProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? mergeSettings(JSON.parse(stored)) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const theme = settings.theme || "default";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
  }, [settings.theme]);

  const value = useMemo(() => ({
    settings,
    theme: settings.theme,
    setTheme: (theme) => setSettings((prev) => ({ ...prev, theme })),
    updateSection: (section, key, value) =>
      setSettings((prev) => ({
        ...prev,
        [section]: {
          ...(prev[section] || {}),
          [key]: value,
        },
      })),
    toggleSetting: (section, key) =>
      setSettings((prev) => ({
        ...prev,
        [section]: {
          ...(prev[section] || {}),
          [key]: !prev?.[section]?.[key],
        },
      })),
    resetSettings: () => setSettings(defaultSettings),
  }), [settings]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeSettings = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeSettings must be used within ThemeProvider");
  }
  return context;
};
