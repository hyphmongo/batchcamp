import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { FilenameTemplate } from "@/shared/FilenameTemplate";
import type { Configuration } from "@/storage";
import { onboardedConfig } from "@/tab/__tests__/journey-fixtures";

const StatefulHarness = ({
  initialConfig,
  onChange,
}: {
  initialConfig: Configuration;
  onChange?: (config: Configuration) => void;
}) => {
  const [config, setConfig] = useState(initialConfig);
  return (
    <FilenameTemplate
      config={config}
      onUpdate={(updates) => {
        const next = { ...config, ...updates };
        setConfig(next);
        onChange?.(next);
      }}
    />
  );
};

const baseConfig: Configuration = onboardedConfig;

describe("FilenameTemplate", () => {
  it("renders the toggle in its off state when filenameTemplateEnabled is false", () => {
    render(<FilenameTemplate config={baseConfig} onUpdate={vi.fn()} />);

    expect(
      screen.getByRole("checkbox", { name: /customize filename/i }),
    ).not.toBeChecked();
  });

  it("renders the toggle in its on state when filenameTemplateEnabled is true", () => {
    render(
      <FilenameTemplate
        config={{ ...baseConfig, filenameTemplateEnabled: true }}
        onUpdate={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: /customize filename/i }),
    ).toBeChecked();
  });

  it("calls onUpdate with filenameTemplateEnabled: true when the user toggles on", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<FilenameTemplate config={baseConfig} onUpdate={onUpdate} />);

    await user.click(
      screen.getByRole("checkbox", { name: /customize filename/i }),
    );

    expect(onUpdate).toHaveBeenCalledWith({ filenameTemplateEnabled: true });
  });

  it("calls onUpdate with filenameTemplateEnabled: false when the user toggles off", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(
      <FilenameTemplate
        config={{ ...baseConfig, filenameTemplateEnabled: true }}
        onUpdate={onUpdate}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", { name: /customize filename/i }),
    );

    expect(onUpdate).toHaveBeenCalledWith({ filenameTemplateEnabled: false });
  });

  it("shows the current template and edit button only when enabled", () => {
    const { rerender } = render(
      <FilenameTemplate config={baseConfig} onUpdate={vi.fn()} />,
    );

    expect(
      screen.queryByRole("button", { name: /edit filename template/i }),
    ).not.toBeInTheDocument();

    rerender(
      <FilenameTemplate
        config={{ ...baseConfig, filenameTemplateEnabled: true }}
        onUpdate={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /edit filename template/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("{artist} - {title}")).toBeInTheDocument();
  });

  it("opens the edit modal when the user clicks the edit button", async () => {
    const user = userEvent.setup();
    render(
      <FilenameTemplate
        config={{ ...baseConfig, filenameTemplateEnabled: true }}
        onUpdate={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /edit filename template/i }),
    );

    expect(
      screen.getByRole("dialog", { name: /filename template/i }),
    ).toBeInTheDocument();
  });

  it("closes the modal when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FilenameTemplate
        config={{ ...baseConfig, filenameTemplateEnabled: true }}
        onUpdate={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /edit filename template/i }),
    );
    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(
      screen.getByRole("dialog", { name: /filename template/i }),
    ).toBeInTheDocument();
    await waitForElementToBeRemoved(() =>
      screen.queryByRole("dialog", { name: /filename template/i }),
    );
  });

  it("persists the edited template once when the editor closes, not per keystroke", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <StatefulHarness
        initialConfig={{ ...baseConfig, filenameTemplateEnabled: true }}
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /edit filename template/i }),
    );
    const input = screen.getByRole("textbox", { name: /filename template/i });
    await user.clear(input);
    await user.type(input, "{{artist}/{{title}");

    expect(input).toHaveValue("{artist}/{title}");
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ filenameTemplate: "{artist}/{title}" }),
    );
  });

  it("stays open after mounting under StrictMode (no self-close)", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <StatefulHarness
          initialConfig={{ ...baseConfig, filenameTemplateEnabled: true }}
        />
      </StrictMode>,
    );

    await user.click(
      screen.getByRole("button", { name: /edit filename template/i }),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(
      screen.getByRole("dialog", { name: /filename template/i }),
    ).toBeInTheDocument();
  });

  it("previews the raw format token that real downloads substitute", async () => {
    const user = userEvent.setup();
    render(
      <StatefulHarness
        initialConfig={{
          ...baseConfig,
          filenameTemplateEnabled: true,
          filenameTemplate: "{title}.{format}",
        }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /edit filename template/i }),
    );

    expect(screen.getByText(/Hyph Mngo\.mp3-320\.zip/)).toBeInTheDocument();
  });
});
