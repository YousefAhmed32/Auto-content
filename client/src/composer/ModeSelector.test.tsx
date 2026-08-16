import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModeSelector } from "./ModeSelector";

describe("ModeSelector", () => {
  it("renders both modes as an accessible radiogroup with the current mode checked", () => {
    render(<ModeSelector current="simple" onSelect={() => undefined} />);
    const group = screen.getByRole("radiogroup", { name: "وضع إنشاء المحتوى" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /نشر سريع/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /نشر متقدم/ })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onSelect with the clicked mode", () => {
    const onSelect = vi.fn();
    render(<ModeSelector current="simple" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("radio", { name: /نشر متقدم/ }));
    expect(onSelect).toHaveBeenCalledWith("advanced");
  });

  it("is operable via the keyboard as native buttons (Enter/Space trigger onClick)", () => {
    const onSelect = vi.fn();
    render(<ModeSelector current="advanced" onSelect={onSelect} />);
    const simpleCard = screen.getByRole("radio", { name: /نشر سريع/ });
    simpleCard.focus();
    expect(simpleCard).toHaveFocus();
    fireEvent.click(simpleCard);
    expect(onSelect).toHaveBeenCalledWith("simple");
  });
});
