import React, { useRef } from "react";

import OptionsForm from "../../shared/OptionsForm";
import { Configuration, configurationStore } from "../../storage";
import { useStore } from "../store";

type FormProps = {
  showModal: boolean;
  onClose: () => void;
};

export const OptionsModal = ({ showModal, onClose }: FormProps) => {
  const modal = useRef<HTMLDialogElement>(null);
  const config = useStore((state) => state.config);
  const setConfig = useStore((state) => state.setConfig);
  const isOpen = modal.current?.open;

  if (showModal && !isOpen) {
    modal.current?.showModal();
  } else if (!showModal && isOpen) {
    modal.current?.close();
  }

  const onSubmit = async (data: Configuration) => {
    const updated = {
      ...config,
      hasOnboarded: true,
      format: data.format,
      concurrency: data.concurrency,
    };

    setConfig(updated);

    await configurationStore.set(updated);

    onClose();
  };

  return (
    <dialog className="modal" ref={modal}>
      <div className="modal-box">
        <OptionsForm config={config} onSubmit={onSubmit} />
      </div>

      {config.hasOnboarded && (
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => onClose()}>close</button>
        </form>
      )}
    </dialog>
  );
};
