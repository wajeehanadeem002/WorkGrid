import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./logo";

describe("Logo", () => {
  it("uses the WorkGrid connected-cells brand mark", () => {
    const { container } = render(<Logo />);
    const mark = container.querySelector<HTMLImageElement>(".logo__mark img");

    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute("src", "/brand/workgrid-mark.png");
    expect(mark).toHaveAttribute("alt", "");
    expect(container.querySelector(".logo__mark svg")).toBeNull();
  });
});
