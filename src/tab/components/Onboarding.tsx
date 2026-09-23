import { Info } from "@phosphor-icons/react";
import browser from "webextension-polyfill";
import { browserName, isFirefox } from "@/shared/browser-info";
import { ConfigFieldList } from "@/shared/ConfigFieldList";
import { Cta } from "@/shared/Cta";
import { captureError } from "@/shared/error-handler";
import { persistConfig } from "@/shared/persist-config";
import { textLinkClass } from "@/shared/text-link";
import type { Configuration } from "@/storage";
import { totalItemCountSelector } from "@/tab/selectors";
import { useStore } from "@/tab/store";

const DOWNLOAD_SETTINGS_URL = "chrome://settings/downloads";

const openDownloadSettings = () => {
  browser.tabs
    .create({ url: DOWNLOAD_SETTINGS_URL })
    .catch((error: unknown) =>
      captureError(error, undefined, { operation: "open_download_settings" }),
    );
};

const SavePromptTip = () => (
  <p className="mt-5 flex items-start gap-2.5 bg-secondary/15 px-3.5 py-3 text-body text-base-content/80 leading-relaxed">
    <Info
      size={16}
      className="mt-0.5 shrink-0 text-base-content/70"
      aria-hidden="true"
    />
    <span>
      To download smoothly in {browserName}, disable the{" "}
      <span className="font-semibold text-base-content">
        Ask where to save each file
      </span>{" "}
      option in your{" "}
      <button
        type="button"
        onClick={openDownloadSettings}
        className={textLinkClass}
      >
        download settings
      </button>
      .
    </span>
  </p>
);

interface OnboardingProps {
  config: Configuration;
  onStart: () => void;
}

const Onboarding = ({ config, onStart }: OnboardingProps) => {
  const setConfig = useStore((state) => state.setConfig);
  const totalCount = useStore(totalItemCountSelector);

  const handleUpdate = (updates: Partial<Configuration>) =>
    persistConfig(config, updates, setConfig);

  return (
    <div className="w-full">
      <header className="mb-8">
        <h2 className="text-display font-semibold tracking-tight leading-[1.05] text-base-content">
          Initial setup
        </h2>
        <p className="mt-3 text-title text-base-content/70 leading-relaxed">
          Confirm your download defaults. You can change them later in Settings.
        </p>
        {!isFirefox && <SavePromptTip />}
      </header>

      <ConfigFieldList config={config} idPrefix="ob-" onUpdate={handleUpdate} />

      <Cta
        onClick={onStart}
        className="mt-8 w-full px-4 py-3 text-title tracking-tight active:brightness-90 focus-visible:outline-offset-2"
      >
        {totalCount > 0
          ? `Start ${totalCount === 1 ? "download" : "downloads"}`
          : "Save defaults"}
      </Cta>
    </div>
  );
};

export { Onboarding };
