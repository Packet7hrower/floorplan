import { Component, createElement } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary, LoadingShell } from "../src/components/AppErrorBoundary";

class StartupFailure extends Component {
  render(): never {
    throw new Error("Simulated startup failure");
  }
}

describe("startup recovery surfaces", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows a recoverable application surface instead of a blank page", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(createElement(AppErrorBoundary, null, createElement(StartupFailure)));
    expect(screen.getByRole("heading", { name: "Floorplan could not finish loading" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start without recovery" })).toBeInTheDocument();
    expect(screen.getByText("Simulated startup failure")).toBeInTheDocument();
  });

  it("renders a lightweight startup shell while deferred application code loads", () => {
    render(createElement(LoadingShell));
    expect(screen.getByRole("status")).toHaveTextContent("Preparing the 2D workspace");
  });
});
