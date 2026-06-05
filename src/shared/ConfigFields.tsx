import { FieldLabel } from "@/shared/FieldLabel";
import type { Configuration } from "@/storage";
import { FORMAT_LABELS, type Format } from "@/types";

type FieldProps = {
  config: Configuration;
  onUpdate: (updates: Partial<Configuration>) => void;
  idPrefix?: string;
};

const FormatField = ({ config, onUpdate, idPrefix = "" }: FieldProps) => {
  const id = `${idPrefix}format`;
  return (
    <div className="flex items-center justify-between gap-3">
      <FieldLabel htmlFor={id}>Format</FieldLabel>
      <select
        id={id}
        className="select-chevron text-sm px-3 py-2 border border-base-300 bg-base-100 text-base-content focus:outline-2 focus:outline-accent focus:outline-offset-1 shrink-0 max-w-[10rem]"
        value={config.format}
        onChange={(e) => {
          const value = e.target.value;
          if (value in FORMAT_LABELS) {
            onUpdate({ format: value as Format });
          }
        }}
      >
        {Object.entries(FORMAT_LABELS).map(([key, value]) => (
          <option key={key} value={key}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );
};

const ConcurrencyField = ({ config, onUpdate, idPrefix = "" }: FieldProps) => {
  const id = `${idPrefix}concurrency`;
  return (
    <div className="flex items-center justify-between gap-3">
      <FieldLabel htmlFor={id}>Concurrent downloads</FieldLabel>
      <div className="flex items-center gap-2 shrink-0">
        <input
          id={id}
          type="range"
          min={1}
          max={8}
          step={1}
          value={config.concurrency}
          onChange={(e) => onUpdate({ concurrency: Number(e.target.value) })}
          className="range range-xs w-24"
        />
        <span className="text-sm font-mono tabular-nums text-base-content/70 w-3 text-right">
          {config.concurrency}
        </span>
      </div>
    </div>
  );
};

const CoverArtField = ({ config, onUpdate, idPrefix = "" }: FieldProps) => {
  const id = `${idPrefix}artwork`;
  return (
    <div className="flex items-center justify-between gap-3">
      <FieldLabel htmlFor={id}>Download cover art</FieldLabel>
      <input
        id={id}
        type="checkbox"
        className="toggle toggle-sm"
        checked={config.downloadArtwork}
        onChange={(e) => onUpdate({ downloadArtwork: e.target.checked })}
      />
    </div>
  );
};

export { ConcurrencyField, CoverArtField, FormatField };
