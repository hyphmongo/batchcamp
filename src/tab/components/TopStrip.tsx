import {
  X as CloseIcon,
  CurrencyDollar as DonateIcon,
  Gear as SettingsIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import { track } from "@/shared/analytics";
import { DonateDialog } from "@/shared/DonateDialog";
import { IconButton } from "@/shared/IconButton";
import { APP_VERSION } from "@/shared/version";
import { Wordmark } from "@/shared/Wordmark";

const DONATE_URL = "https://donate.stripe.com/dRmeVd5rLgKp80kgxn2B200";

type TopStripProps = {
  mode: "onboarding" | "downloads" | "settings";
  showTabNotice?: boolean;
  onSettingsClick: () => void;
  onBackClick: () => void;
};

export const TopStrip = ({
  mode,
  showTabNotice,
  onSettingsClick,
  onBackClick,
}: TopStripProps) => {
  const [donateOpen, setDonateOpen] = useState(false);

  const handleDonateClick = () => {
    track("donate_opened");
    setDonateOpen(true);
  };

  return (
    <header className="shrink-0 min-h-12 px-4 border-b border-base-300 flex items-center justify-between bg-base-100">
      <h1 className="flex items-baseline gap-2 text-title font-semibold tracking-tight text-base-content lowercase shrink-0">
        <Wordmark size={22} variant="color" className="self-center -mt-px" />
        batchcamp
        <span className="text-caption font-normal text-base-content/70 font-mono">
          v{APP_VERSION}
        </span>
        {showTabNotice && (
          <span className="text-caption font-normal text-base-content/70 font-mono">
            · keep tab open to complete downloads
          </span>
        )}
      </h1>
      {mode === "downloads" && (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleDonateClick}
            className="inline-flex items-center gap-1 h-7 pl-1.5 pr-2.5 text-meta font-medium bg-secondary/15 text-base-content/80 hover:bg-secondary/25 hover:text-base-content transition-colors cursor-pointer focus-ring focus-visible:outline-offset-1"
            title="Donate to batchcamp"
          >
            <DonateIcon
              size={14}
              weight="regular"
              aria-hidden="true"
              className="text-secondary"
            />
            donate
          </button>
          <IconButton
            icon={SettingsIcon}
            label="Settings"
            onClick={onSettingsClick}
          />
        </div>
      )}
      {mode === "settings" && (
        <IconButton
          icon={CloseIcon}
          label="Close settings"
          variant="lg"
          onClick={onBackClick}
        />
      )}
      <DonateDialog
        open={donateOpen}
        href={DONATE_URL}
        onClose={() => setDonateOpen(false)}
      />
    </header>
  );
};
