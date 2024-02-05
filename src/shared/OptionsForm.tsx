import React, { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Configuration } from "../storage";
import { FormatEnum } from "../types";

type OptionsMenuProps = {
  config: Configuration;
  onSubmit: (data: Configuration) => void;
};

const OptionsForm = ({ config, onSubmit }: OptionsMenuProps) => {
  const { register, handleSubmit, watch, setValue } = useForm<Configuration>({
    defaultValues: {
      format: "mp3-320",
      concurrency: 3,
    },
  });

  useEffect(() => {
    setValue("format", config.format);
    setValue("concurrency", config.concurrency);
  }, [config]);

  const concurrency = watch("concurrency");

  return (
    <div className="container flex flex-col p-6 w-80">
      <span className="text-2xl font-bold leading-tight">Options</span>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mt-2">
          <label className="label">
            <span className="label-text">Format</span>
          </label>
          <select
            className="select select-bordered w-full max-w-xs"
            {...register("format")}
          >
            {Object.entries(FormatEnum).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2">
          <label className="label">
            <span className="label-text">Number of active downloads</span>
          </label>
          <div className="flex items-center">
            <input
              type="range"
              min={1}
              max={8}
              className="range"
              {...register("concurrency", {
                valueAsNumber: true,
              })}
            />
            <span className="ml-2 text-base font-semibold">{concurrency}</span>
          </div>
        </div>

        <button className="btn btn-primary mt-4" type="submit">
          Save
        </button>
      </form>
    </div>
  );
};

export default OptionsForm;
