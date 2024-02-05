import "../styles.css";

import React from "react";
import { createRoot } from "react-dom/client";

import OptionsForm from "../shared/OptionsForm";
import { Configuration, configurationStore } from "../storage";

interface PopupProps {
  config: Configuration;
}

const Popup = (props: PopupProps) => {
  const onSubmit = async (data: Configuration) => {
    const update: Configuration = {
      ...data,
      hasOnboarded: true,
    };

    await configurationStore.set(update);

    window.close();
  };

  return <OptionsForm config={props.config} onSubmit={onSubmit} />;
};

(async () => {
  const app = document.getElementById("root") as Element;
  const root = createRoot(app);

  const config = await configurationStore.get({
    format: "mp3-320",
    concurrency: 3,
  });

  root.render(
    <React.StrictMode>
      <Popup config={config} />
    </React.StrictMode>
  );
})();
