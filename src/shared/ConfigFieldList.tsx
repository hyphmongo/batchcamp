import { SettingsCard, SettingsRow } from "@/shared/SettingsCard";
import type { Configuration } from "@/storage";
import { ConcurrencyField, CoverArtField, FormatField } from "./ConfigFields";
import { FilenameTemplate } from "./FilenameTemplate";

type ConfigFieldListProps = {
  config: Configuration;
  idPrefix: string;
  onUpdate: (updates: Partial<Configuration>) => void;
};

const ConfigFieldList = ({
  config,
  idPrefix,
  onUpdate,
}: ConfigFieldListProps) => (
  <SettingsCard>
    <SettingsRow>
      <FormatField config={config} onUpdate={onUpdate} idPrefix={idPrefix} />
    </SettingsRow>
    <SettingsRow>
      <FilenameTemplate
        config={config}
        onUpdate={onUpdate}
        idPrefix={idPrefix}
      />
    </SettingsRow>
    <SettingsRow>
      <CoverArtField config={config} onUpdate={onUpdate} idPrefix={idPrefix} />
    </SettingsRow>
    <SettingsRow>
      <ConcurrencyField
        config={config}
        onUpdate={onUpdate}
        idPrefix={idPrefix}
      />
    </SettingsRow>
  </SettingsCard>
);

export { ConfigFieldList };
