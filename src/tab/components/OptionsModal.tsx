import React, { useRef } from "react";
import { useForm } from "react-hook-form";
import { FormatEnum } from "../../types";
import { useStore } from "../store";

type FormData = {
  format: keyof typeof FormatEnum;
  concurrency: string;
};

type FormProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const OptionsModal = ({ isOpen, onClose }: FormProps) => {
  const modal = useRef<HTMLDialogElement>(null);
  const config = useStore((state) => state.config);
  const setConfig = useStore((state) => state.setConfig);

  const { register, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      format: "mp3-320",
      concurrency: "3",
    },
  });

  const concurrency = watch("concurrency");

  if (isOpen) {
    modal.current?.showModal();
  } else {
    modal.current?.close();
  }

  const onSubmit = async (data: FormData) => {
    await setConfig({
      ...config,
      hasOnboarded: true,
      format: data.format,
      concurrency: parseInt(data.concurrency),
    });

    onClose();
  };

  return (
    <dialog className="modal" ref={modal}>
      <div className="modal-box">
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
                  min="1"
                  max="8"
                  className="range"
                  {...register("concurrency")}
                />
                <span className="ml-2 text-base font-semibold">
                  {concurrency}
                </span>
              </div>
            </div>

            <button className="btn btn-primary mt-4" type="submit">
              Save
            </button>
          </form>
        </div>
      </div>
      {config.hasOnboarded && (
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => onClose()}>close</button>
        </form>
      )}
    </dialog>
  );
};
