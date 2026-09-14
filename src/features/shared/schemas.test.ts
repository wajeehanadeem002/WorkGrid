import { describe, expect, it } from "vitest";
import {
  commentSchema,
  invitationSchema,
  organizationSchema,
  projectSchema,
  taskSchema,
  normalizeProjectFilters,
  normalizeTaskFilters,
} from "./schemas";

describe("organizationSchema", () => {
  it("normalizes a valid organization name and slug", () => {
    expect(
      organizationSchema.parse({
        name: "  Northstar Team ",
        slug: " Northstar-Team ",
      }),
    ).toEqual({
      name: "Northstar Team",
      slug: "northstar-team",
    });
  });

  it("rejects slugs with separators other than hyphens", () => {
    expect(
      organizationSchema.safeParse({
        name: "Northstar",
        slug: "northstar_team",
      }).success,
    ).toBe(false);
  });
});

describe("URL filters", () => {
  it("falls back safely when project filters are manipulated", () => {
    expect(
      normalizeProjectFilters({
        query: "x".repeat(200),
        status: "DROP TABLE",
        sort: "random",
      }),
    ).toEqual({
      query: "",
      status: "ALL",
      sort: "updated_desc",
    });
  });

  it("falls back safely when task filters are manipulated", () => {
    expect(
      normalizeTaskFilters({ project: "not-an-id", status: "ADMIN" }),
    ).toEqual({
      query: "",
      status: "ALL",
      priority: "ALL",
      assignee: "ALL",
      project: "ALL",
      due: "ALL",
      sort: "updated_desc",
    });
  });
});

describe("projectSchema", () => {
  it("normalizes project keys to uppercase", () => {
    expect(
      projectSchema.parse({
        name: "Website launch",
        key: " web ",
        description: "",
        status: "ACTIVE",
      }),
    ).toMatchObject({ key: "WEB", status: "ACTIVE" });
  });

  it("rejects unknown status values", () => {
    expect(
      projectSchema.safeParse({
        name: "Website",
        key: "WEB",
        description: "",
        status: "OPEN",
      }).success,
    ).toBe(false);
  });
});

describe("taskSchema", () => {
  it("converts blank optional values to null", () => {
    expect(
      taskSchema.parse({
        projectId: "22222222-2222-4222-8222-222222222222",
        title: " Prepare release ",
        description: "",
        status: "TODO",
        priority: "HIGH",
        assigneeId: "",
        dueDate: "",
      }),
    ).toEqual({
      projectId: "22222222-2222-4222-8222-222222222222",
      title: "Prepare release",
      description: "",
      status: "TODO",
      priority: "HIGH",
      assigneeId: null,
      dueDate: null,
    });
  });

  it("rejects malformed resource identifiers", () => {
    expect(
      taskSchema.safeParse({
        projectId: "another-tenant-project",
        title: "Prepare release",
        status: "TODO",
        priority: "HIGH",
      }).success,
    ).toBe(false);
  });
});

describe("collaboration schemas", () => {
  it("rejects blank comments after trimming", () => {
    expect(commentSchema.safeParse({ body: "   " }).success).toBe(false);
  });

  it("never permits an invitation to grant ownership", () => {
    expect(
      invitationSchema.safeParse({ email: "person@example.com", role: "owner" })
        .success,
    ).toBe(false);
    expect(
      invitationSchema.parse({ email: "PERSON@example.com", role: "member" }),
    ).toEqual({
      email: "person@example.com",
      role: "member",
    });
  });
});
