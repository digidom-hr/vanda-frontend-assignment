import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("offers three labelled options with system selected by default", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Use system theme" })).toBeChecked();
  });

  it("pins and stores a chosen theme, and returns to the system theme", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("radio", { name: "Use dark theme" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("radio", { name: "Use dark theme" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Use system theme" }));
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("shows a stored preference", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(<ThemeToggle />);
    expect(screen.getByRole("radio", { name: "Use light theme" })).toBeChecked();
  });

  it("can be operated with the keyboard", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.tab();
    expect(screen.getByRole("radio", { name: "Use system theme" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{Enter}");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});
