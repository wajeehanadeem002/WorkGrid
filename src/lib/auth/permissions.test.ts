import { describe, expect, it } from "vitest";
import {
  can,
  canChangeMemberRole,
  canRemoveMember,
  hasMinimumRole,
  isRole,
} from "./permissions";

describe("role permissions", () => {
  it("prevents members from performing organization administration", () => {
    expect(can("member", "organization:update")).toBe(false);
    expect(can("member", "member:invite")).toBe(false);
    expect(can("member", "audit:read")).toBe(false);
  });

  it("allows members to collaborate on tasks without deleting projects", () => {
    expect(can("member", "task:create")).toBe(true);
    expect(can("member", "task:update")).toBe(true);
    expect(can("member", "comment:create")).toBe(true);
    expect(can("member", "attachment:create")).toBe(true);
    expect(can("member", "project:delete")).toBe(false);
  });

  it("allows admins to manage work and activity without ownership powers", () => {
    expect(can("admin", "project:delete")).toBe(true);
    expect(can("admin", "member:invite")).toBe(true);
    expect(can("admin", "audit:read")).toBe(true);
    expect(can("admin", "organization:update")).toBe(false);
  });

  it("orders roles from member through owner", () => {
    expect(hasMinimumRole("owner", "admin")).toBe(true);
    expect(hasMinimumRole("admin", "member")).toBe(true);
    expect(hasMinimumRole("member", "admin")).toBe(false);
  });

  it("accepts only known role values at runtime boundaries", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("super_admin")).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});

describe("membership administration", () => {
  it("reserves role changes for owners", () => {
    expect(canChangeMemberRole("owner", "member", "admin", false)).toBe(true);
    expect(canChangeMemberRole("admin", "member", "admin", false)).toBe(false);
  });

  it("never allows changing an owner or assigning ownership", () => {
    expect(canChangeMemberRole("owner", "owner", "admin", false)).toBe(false);
    expect(canChangeMemberRole("owner", "member", "owner", false)).toBe(false);
  });

  it("prevents removing owners and prevents self-removal", () => {
    expect(canRemoveMember("owner", "owner", false)).toBe(false);
    expect(canRemoveMember("owner", "member", true)).toBe(false);
    expect(canRemoveMember("admin", "member", false)).toBe(true);
    expect(canRemoveMember("admin", "admin", false)).toBe(false);
  });
});
