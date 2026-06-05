import { ConfigFieldList } from "@/shared/ConfigFieldList";
import { Cta } from "@/shared/Cta";
import { persistConfig } from "@/shared/persist-config";
import type { Configuration } from "@/storage";
import { totalItemCountSelector } from "@/tab/selectors";
import { useStore } from "@/tab/store";

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
