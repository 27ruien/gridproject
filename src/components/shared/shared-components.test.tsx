import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./empty-state";
import { StatusBadge, priorityTone, statusTone } from "./status";

describe("shared components", () => {
  it("renders an actionable empty state", async () => {
    const onAction = vi.fn();
    render(<EmptyState title="暂无数据" description="稍后再试" action="刷新" onAction={onAction} />);

    expect(screen.getByText("暂无数据")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "刷新" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("maps priority and status tones consistently", () => {
    render(<StatusBadge label="P0" tone={priorityTone("P0")} />);

    expect(screen.getByText("P0")).toBeInTheDocument();
    expect(priorityTone("P1")).toBe("warn");
    expect(statusTone("APPROVED")).toBe("success");
    expect(statusTone("REJECTED")).toBe("warn");
  });
});
