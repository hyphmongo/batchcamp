import { Info } from "@phosphor-icons/react";
import browser from "webextension-polyfill";
import { browserName, isFirefox } from "@/shared/browser-info";
import { captureError } from "@/shared/error-handler";
import { textLinkClass } from "@/shared/text-link";

const DOWNLOAD_SETTINGS_URL = "chrome://settings/downloads";

const openDownloadSettings = () => {
  browser.tabs
    .create({ url: DOWNLOAD_SETTINGS_URL })
    .catch((error: unknown) =>
      captureError(error, undefined, { operation: "open_download_settings" }),
    );
};

const SavePromptTip = ({ className = "" }: { className?: string }) =>
  isFirefox ? null : (
    <p
      className={`${className} flex items-start gap-2.5 bg-secondary/15 px-3.5 py-3 text-body text-base-content/80 leading-relaxed`}
    >
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

export { SavePromptTip };
