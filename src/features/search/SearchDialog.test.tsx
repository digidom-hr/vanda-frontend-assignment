import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders, stubApi } from "@/test/render";
import { SearchDialog } from "./SearchDialog";

const emptySearch = () => stubApi(() => Response.json({ query: "", total: 0, results: [], services: [] }));

describe("SearchDialog", () => {
  it("opens from the header button with focus in the search field", async () => {
    emptySearch();
    const user = userEvent.setup();
    renderWithProviders(<SearchDialog />);
    await user.click(screen.getByRole("button", { name: "Search series" }));
    expect(screen.getByRole("dialog", { name: "Search series" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("searchbox")).toHaveFocus());
  });

  it.each(["{Control>}k{/Control}", "{Meta>}k{/Meta}", "/"])("opens with %s", async (keys) => {
    emptySearch();
    const user = userEvent.setup();
    renderWithProviders(<SearchDialog />);
    await user.keyboard(keys);
    expect(screen.getByRole("dialog", { name: "Search series" })).toBeInTheDocument();
  });

  it("does not hijack / while typing in another field", async () => {
    emptySearch();
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <input aria-label="Other field" />
        <SearchDialog />
      </>,
    );
    await user.type(screen.getByRole("textbox", { name: "Other field" }), "a/b");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Other field" })).toHaveValue("a/b");
  });

  it("clears the query on the first Escape and closes on the second", async () => {
    emptySearch();
    const user = userEvent.setup();
    renderWithProviders(<SearchDialog />);
    await user.keyboard("/");
    await user.type(screen.getByRole("searchbox"), "acme");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("searchbox")).toHaveValue("");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes with the Close button", async () => {
    emptySearch();
    const user = userEvent.setup();
    renderWithProviders(<SearchDialog />);
    await user.keyboard("/");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
