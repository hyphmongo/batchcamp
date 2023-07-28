import "../styles.css";

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import { Configuration, configurationStore as store } from "../storage";
import { FormatEnum } from "../types";

import browser from "webextension-polyfill";

const DEFAULT_STATE: Configuration = {
  format: "mp3-320",
  concurrency: 3,
};

const buildOptions = () =>
  Object.entries(FormatEnum).map(([key, value]) => (
    <option key={key} value={key}>
      {value}
    </option>
  ));

const Popup = () => {
  const [state, setState] = useState<Configuration>(DEFAULT_STATE);

  useEffect(() => {
    const loadStorage = async () => {
      const { format, concurrency } = await store.get();
      if (format && concurrency) {
        setState({
          format,
          concurrency,
        });
      }
    };
    loadStorage();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await store.set(state);

    await browser.runtime.sendMessage({
      type: "configuration-updated",
      configuration: state,
    });

    window.close();
  };

  return (
    <div className="container w-80 flex flex-col p-6">
      <span className="text-2xl font-bold leading-tight">Options</span>
      <form onSubmit={handleSubmit}>
        <div className="mt-2">
          <label className="label">
            <span className="label-text">Format</span>
          </label>
          <select
            className="select select-bordered w-full max-w-xs"
            value={state.format}
            onChange={(val) =>
              setState((state) => ({
                ...state,
                format: val.target.value as Configuration["format"],
              }))
            }
          >
            {buildOptions()}
          </select>
        </div>

        <div className="mt-2">
          <label className="label">
            <span className="label-text">Concurrent Downloads</span>
          </label>
          <div className="flex items-center">
            <input
              type="range"
              min="1"
              max="8"
              value={state.concurrency}
              className="range"
              onChange={(val) =>
                setState((state) => ({
                  ...state,
                  concurrency: val.target.valueAsNumber,
                }))
              }
            />
            <span className="ml-2 text-base font-semibold">
              {state.concurrency}
            </span>
          </div>
        </div>

        <button className="btn btn-primary mt-4" type="submit">
          Save
        </button>
      </form>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root") as Element).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
