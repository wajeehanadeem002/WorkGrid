import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LandingPage from "./page";

describe("WorkGrid landing page", () => {
  it("presents the selected command-center hero and a meaningful product preview", () => {
    render(<LandingPage />);

    const heroHeading = screen.getByRole("heading", {
      level: 1,
      name: "Clarity for every project. Accountability for every task.",
    });
    expect(heroHeading).toBeInTheDocument();
    expect(heroHeading.querySelectorAll(".hero-heading__line")).toHaveLength(2);
    const workspaceLinks = screen.getAllByRole("link", {
      name: "Create your workspace",
    });
    expect(workspaceLinks).toHaveLength(3);
    workspaceLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/sign-up");
    });
    expect(
      screen.getByRole("link", { name: "Explore the product" }),
    ).toHaveAttribute("href", "#product");
    const preview = screen.getByRole("region", {
      name: "WorkGrid product preview",
    });
    expect(preview).toBeInTheDocument();
    expect(
      preview.querySelector(".command-preview__brand-mark img"),
    ).toHaveAttribute("src", "/brand/workgrid-mark.png");
    expect(screen.getByText("Project progress")).toBeInTheDocument();
    expect(screen.getByText("Recent tasks")).toBeInTheDocument();
    expect(screen.getByText("Private by default")).toBeInTheDocument();
    expect(screen.getByText("Built-in roles")).toBeInTheDocument();
    expect(screen.getByText("Complete audit trail")).toBeInTheDocument();
  });

  it("links the public navigation to real landing-page sections", () => {
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: "Product" })).toHaveAttribute(
      "href",
      "#product",
    );
    expect(screen.getByRole("link", { name: "Solutions" })).toHaveAttribute(
      "href",
      "#workflow",
    );
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute(
      "href",
      "#security",
    );
  });

  it("shows the core product areas and explains how teams start working", () => {
    render(<LandingPage />);

    const showcase = screen.getByRole("region", {
      name: "One workspace. Four clear views.",
    });
    const showcaseHeading = within(showcase).getByRole("heading", {
      level: 2,
      name: "One workspace. Four clear views.",
    });
    expect(
      showcaseHeading.querySelectorAll(".product-showcase-heading__line"),
    ).toHaveLength(2);
    const showcaseIntro = showcase.querySelector(".product-showcase__intro");
    expect(showcaseIntro).not.toBeNull();
    expect(showcaseIntro).toHaveTextContent(
      "Move from organization health to the next concrete action without stitching together disconnected tools.",
    );
    expect(showcaseIntro?.querySelectorAll("span")).toHaveLength(2);
    expect(
      within(showcase).getByRole("heading", { level: 3, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(
      within(showcase).getByRole("heading", { level: 3, name: "Projects" }),
    ).toBeInTheDocument();
    expect(
      within(showcase).getByRole("heading", { level: 3, name: "Tasks" }),
    ).toBeInTheDocument();
    expect(
      within(showcase).getByRole("heading", { level: 3, name: "Activity log" }),
    ).toBeInTheDocument();

    const workflow = screen.getByRole("region", {
      name: "From workspace to progress in three steps.",
    });
    expect(within(workflow).getAllByRole("listitem")).toHaveLength(3);
  });

  it("makes role boundaries clear and ends with working account actions", () => {
    render(<LandingPage />);

    const roles = screen.getByRole("region", {
      name: "The right control for every role.",
    });
    const rolesHeading = within(roles).getByRole("heading", {
      level: 2,
      name: "The right control for every role.",
    });
    expect(rolesHeading.querySelectorAll(".roles-heading__line")).toHaveLength(
      2,
    );
    const rolesIntro = roles.querySelector(".roles-section__intro");
    expect(rolesIntro).not.toBeNull();
    expect(rolesIntro).toHaveTextContent(
      "Responsibilities stay clear while sensitive organization controls remain with the people who should have them.",
    );
    expect(rolesIntro?.querySelectorAll("span")).toHaveLength(2);
    for (const role of ["Owner", "Admin", "Member"]) {
      expect(
        within(roles).getByRole("article", { name: role }),
      ).toBeInTheDocument();
    }

    const finalCta = screen.getByRole("region", {
      name: "Bring every project into one accountable workspace.",
    });
    expect(
      within(finalCta).getByRole("link", { name: "Create your workspace" }),
    ).toHaveAttribute("href", "/sign-up");
    expect(
      within(finalCta).getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/sign-in");
  });
});
