import { MoonStar, Shield, Sparkles, SunMedium, Volume2, BellRing, RotateCcw, Palette, MessageCircleMore } from "lucide-react";
import clsx from "clsx";
import { useThemeSettings } from "../theme/ThemeProvider";

const themeOptions = [
  {
    key: "default",
    title: "Default",
    subtitle: "Keep the current BuzzMitra look exactly as it is.",
    Icon: Sparkles,
  },
  {
    key: "light",
    title: "Light",
    subtitle: "Bright surfaces for a calmer daytime experience.",
    Icon: SunMedium,
  },
  {
    key: "dark",
    title: "Dark",
    subtitle: "A dark-first experience with the same strong contrast.",
    Icon: MoonStar,
  },
];

const settingsSections = [
  {
    id: "notifications",
    title: "Notifications",
    copy: "Choose which alerts feel useful while you are active on this device.",
    Icon: BellRing,
    fields: [
      ["desktopToasts", "Show live toast alerts", "Pop up quick alerts for new messages and activity."],
      ["messageAlerts", "Message alerts", "Keep direct and group conversations easy to catch."],
      ["activityAlerts", "Post and reel activity", "Get likes, comments, follows, and mentions faster."],
      ["storyReplies", "Story replies", "Highlight story replies as they arrive."],
      ["groupUpdates", "Group updates", "Show admin, member, and group changes."],
    ],
  },
  {
    id: "playback",
    title: "Playback",
    copy: "Control how reels and media behave when you are scrolling.",
    Icon: Volume2,
    fields: [
      ["autoplayReels", "Autoplay reels", "Start the active reel automatically when it becomes visible."],
      ["muteVideosByDefault", "Start videos muted", "Useful when you open the app in public places."],
      ["reducedDataMode", "Reduced data mode", "Prefer lighter media delivery where available."],
      ["reducedMotion", "Reduced motion", "Tone down movement and animated transitions."],
    ],
  },
  {
    id: "privacy",
    title: "Privacy & Messaging",
    copy: "Fine-tune how visible and reachable you feel across the app.",
    Icon: Shield,
    fields: [
      ["showActiveStatus", "Show active status", "Let others see when you are online."],
      ["allowMessageRequests", "Allow message requests", "Let people outside your circle start a conversation."],
      ["readReceipts", "Read receipts", "Show when messages have been read."],
    ],
  },
];

const ToggleRow = ({ checked, onChange, title, description, light }) => (
  <button
    type="button"
    onClick={onChange}
    className={clsx(
      "flex w-full items-center justify-between rounded-[1.6rem] border px-4 py-4 text-left transition",
      light ? "border-slate-200 bg-white hover:bg-slate-50" : "border-white/10 bg-white/5 hover:bg-white/8"
    )}
  >
    <div>
      <p className={clsx("font-medium", light ? "text-slate-900" : "text-white")}>{title}</p>
      <p className={clsx("mt-1 text-sm", light ? "text-slate-500" : "text-slate-300")}>{description}</p>
    </div>
    <span
      className={clsx(
        "relative h-7 w-12 rounded-full transition",
        checked ? "bg-lime-300" : (light ? "bg-slate-200" : "bg-slate-700")
      )}
    >
      <span
        className={clsx(
          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition",
          checked ? "left-6" : "left-1"
        )}
      />
    </span>
  </button>
);

const Settings = () => {
  const { settings, theme, setTheme, toggleSetting, updateSection, resetSettings } = useThemeSettings();
  const light = theme === "light";

  return (
    <div className="px-4 pb-12 pt-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className={clsx(
          "rounded-[2rem] border p-6 shadow-xl",
          light
            ? "border-slate-200 bg-white shadow-slate-200/40"
            : "border-white/10 bg-slate-950/85 text-white shadow-slate-950/30"
        )}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={clsx("text-sm uppercase tracking-[0.24em]", light ? "text-cyan-600" : "text-lime-300")}>Settings</p>
              <h1 className={clsx("mt-3 text-3xl font-semibold", light ? "text-slate-900" : "text-white")}>Make BuzzMitra feel right for you.</h1>
              <p className={clsx("mt-3 max-w-3xl text-sm leading-6", light ? "text-slate-600" : "text-slate-300")}>
                Appearance, notifications, privacy, and playback controls are saved on this device so your experience stays consistent every time you return.
              </p>
            </div>
            <button
              type="button"
              onClick={resetSettings}
              className={clsx(
                "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                light ? "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
              )}
            >
              <RotateCcw className="h-4 w-4" />
              Reset device settings
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
          <div className="space-y-6">
            <section className={clsx(
              "rounded-[2rem] border p-6 shadow-xl",
              light ? "border-slate-200 bg-white shadow-slate-200/40" : "border-white/10 bg-slate-950/70 text-white shadow-slate-950/20"
            )}>
              <div className="flex items-center gap-3">
                <span className={clsx("rounded-2xl p-3", light ? "bg-cyan-50 text-cyan-600" : "bg-white/8 text-lime-300")}><Palette className="h-5 w-5" /></span>
                <div>
                  <h2 className={clsx("text-xl font-semibold", light ? "text-slate-900" : "text-white")}>Appearance</h2>
                  <p className={clsx("mt-1 text-sm", light ? "text-slate-500" : "text-slate-300")}>Switch between your current brand look, a clean light mode, or an explicit dark mode.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {themeOptions.map((option) => {
                  const active = theme === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setTheme(option.key)}
                      className={clsx(
                        "rounded-[1.6rem] border p-4 text-left transition",
                        active
                          ? "border-lime-300 bg-gradient-to-br from-lime-300/15 via-cyan-300/10 to-fuchsia-300/10"
                          : light
                            ? "border-slate-200 bg-slate-50 hover:bg-white"
                            : "border-white/10 bg-white/5 hover:bg-white/8"
                      )}
                    >
                      <span className={clsx("inline-flex rounded-2xl p-3", active ? "bg-slate-950 text-white" : light ? "bg-white text-slate-800" : "bg-slate-900/80 text-lime-300")}>
                        <option.Icon className="h-5 w-5" />
                      </span>
                      <p className={clsx("mt-4 text-lg font-semibold", light ? "text-slate-900" : "text-white")}>{option.title}</p>
                      <p className={clsx("mt-2 text-sm leading-6", light ? "text-slate-500" : "text-slate-300")}>{option.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            {settingsSections.map((section) => (
              <section
                key={section.id}
                className={clsx(
                  "rounded-[2rem] border p-6 shadow-xl",
                  light ? "border-slate-200 bg-white shadow-slate-200/40" : "border-white/10 bg-slate-950/70 text-white shadow-slate-950/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={clsx("rounded-2xl p-3", light ? "bg-cyan-50 text-cyan-600" : "bg-white/8 text-cyan-300")}><section.Icon className="h-5 w-5" /></span>
                  <div>
                    <h2 className={clsx("text-xl font-semibold", light ? "text-slate-900" : "text-white")}>{section.title}</h2>
                    <p className={clsx("mt-1 text-sm", light ? "text-slate-500" : "text-slate-300")}>{section.copy}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {section.fields.map(([key, title, description]) => (
                    <ToggleRow
                      key={key}
                      checked={Boolean(settings[section.id]?.[key])}
                      onChange={() => toggleSetting(section.id, key)}
                      title={title}
                      description={description}
                      light={light}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="space-y-6">
            <section className={clsx(
              "rounded-[2rem] border p-6 shadow-xl",
              light ? "border-slate-200 bg-white shadow-slate-200/40" : "border-white/10 bg-slate-950/70 text-white shadow-slate-950/20"
            )}>
              <div className="flex items-center gap-3">
                <span className={clsx("rounded-2xl p-3", light ? "bg-cyan-50 text-cyan-600" : "bg-white/8 text-fuchsia-300")}><MessageCircleMore className="h-5 w-5" /></span>
                <div>
                  <h2 className={clsx("text-xl font-semibold", light ? "text-slate-900" : "text-white")}>Profile visibility</h2>
                  <p className={clsx("mt-1 text-sm", light ? "text-slate-500" : "text-slate-300")}>Control how open your profile feels from this device preference panel.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {[
                  ["public", "Public profile", "Anyone can discover and open your profile."],
                  ["followers", "Followers only", "Ideal when you want a smaller trusted circle."],
                  ["private", "Private profile", "Keep your account discoverable only after approval."],
                ].map(([value, title, description]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateSection("privacy", "profileVisibility", value)}
                    className={clsx(
                      "rounded-[1.4rem] border px-4 py-4 text-left transition",
                      settings.privacy.profileVisibility === value
                        ? "border-lime-300 bg-gradient-to-r from-lime-300/15 to-cyan-300/10"
                        : light ? "border-slate-200 bg-slate-50 hover:bg-white" : "border-white/10 bg-white/5 hover:bg-white/8"
                    )}
                  >
                    <p className={clsx("font-medium", light ? "text-slate-900" : "text-white")}>{title}</p>
                    <p className={clsx("mt-1 text-sm", light ? "text-slate-500" : "text-slate-300")}>{description}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className={clsx(
              "rounded-[2rem] border p-6 shadow-xl",
              light ? "border-slate-200 bg-white shadow-slate-200/40" : "border-white/10 bg-slate-950/70 text-white shadow-slate-950/20"
            )}>
              <p className={clsx("text-sm uppercase tracking-[0.22em]", light ? "text-cyan-600" : "text-lime-300")}>Quick note</p>
              <h3 className={clsx("mt-3 text-2xl font-semibold", light ? "text-slate-900" : "text-white")}>Your current default look is preserved.</h3>
              <p className={clsx("mt-3 text-sm leading-6", light ? "text-slate-600" : "text-slate-300")}>
                Choosing <strong>Default</strong> keeps the exact current BuzzMitra interface. The new light and dark modes sit beside it, so your existing styling stays untouched whenever you return to default.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
