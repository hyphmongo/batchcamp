import { setAnalyticsEnabled, track } from "@/shared/analytics";
import { ConfigFieldList } from "@/shared/ConfigFieldList";
import { FieldLabel } from "@/shared/FieldLabel";
import { persistConfig } from "@/shared/persist-config";
import { SettingsCard, SettingsRow } from "@/shared/SettingsCard";
import { setCrashReportsEnabled } from "@/shared/sentry";
import { textLinkClass } from "@/shared/text-link";
import type { Configuration } from "@/storage";
import { useStore } from "@/tab/store";

const PRIVACY_POLICY_URL = "https://deejay.tools/batchcamp/privacy";

const SECTION_LABEL =
  "font-mono text-caption uppercase tracking-wider leading-none text-base-content/70";

type SettingsProps = {
  config: Configuration;
};

const Settings = ({ config }: SettingsProps) => {
  const setConfig = useStore((state) => state.setConfig);
  const historyCount = useStore((state) => state.downloadHistoryCount);
  const historyCleared = useStore((state) => state.historyCleared);
  const clearHistory = useStore((state) => state.clearDownloadHistory);

  const handleUpdate = (updates: Partial<Configuration>) => {
    for (const [setting, value] of Object.entries(updates)) {
      if (setting !== "filenameTemplate") {
        track("setting_changed", { setting, value });
      }
    }
    persistConfig(config, updates, setConfig);
  };

  const handleClearHistory = () => {
    track("download_history_cleared", { count: historyCount });
    clearHistory();
  };

  const handleAnalyticsToggle = (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    handleUpdate({ analyticsEnabled: enabled });
  };

  const handleCrashReportsToggle = (enabled: boolean) => {
    setCrashReportsEnabled(enabled);
    handleUpdate({ crashReportsEnabled: enabled });
  };

  const canClearHistory = !historyCleared && historyCount > 0;

  return (
    <div className="w-full space-y-9">
      <section>
        <h2 className={`${SECTION_LABEL} mb-3 px-4`}>General</h2>
        <ConfigFieldList
          config={config}
          idPrefix="st-"
          onUpdate={handleUpdate}
        />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3 px-4">
          <h2 className={SECTION_LABEL}>Data & privacy</h2>
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-caption ${textLinkClass}`}
          >
            Privacy policy
          </a>
        </div>

        <SettingsCard>
          <SettingsRow>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="st-analytics">
                Collect anonymous usage analytics
              </FieldLabel>
              <input
                id="st-analytics"
                type="checkbox"
                className="toggle toggle-sm"
                checked={config.analyticsEnabled}
                onChange={(e) => handleAnalyticsToggle(e.target.checked)}
              />
            </div>
          </SettingsRow>
          <SettingsRow>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="st-crash-reports">
                Send crash reports
              </FieldLabel>
              <input
                id="st-crash-reports"
                type="checkbox"
                className="toggle toggle-sm"
                checked={config.crashReportsEnabled}
                onChange={(e) => handleCrashReportsToggle(e.target.checked)}
              />
            </div>
          </SettingsRow>
        </SettingsCard>

        {(historyCount > 0 || historyCleared) && (
          <div className="mt-3 flex items-baseline justify-between gap-3 px-4 text-xs">
            <span className="text-base-content/70">
              <span className="font-mono tabular-nums text-base-content/75">
                {historyCount}
              </span>{" "}
              downloads remembered
            </span>
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={!canClearHistory}
              className={`${textLinkClass} disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline`}
            >
              {historyCleared ? "cleared" : "clear"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export { Settings };
