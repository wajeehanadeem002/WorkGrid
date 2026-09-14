import { describe, expect, it } from "vitest";
import { parsePagination, totalPages } from "./pagination";

describe("parsePagination", () => {
  it("uses safe defaults for missing or malformed values", () => {
    expect(parsePagination({})).toEqual({
      page: 1,
      pageSize: 20,
      from: 0,
      to: 19,
    });
    expect(parsePagination({ page: "not-a-number", pageSize: "0" })).toEqual({
      page: 1,
      pageSize: 20,
      from: 0,
      to: 19,
    });
  });

  it("caps page size and page number to prevent abusive ranges", () => {
    expect(parsePagination({ page: "999999999", pageSize: "500" })).toEqual({
      page: 10_000,
      pageSize: 50,
      from: 499_950,
      to: 499_999,
    });
  });

  it("calculates inclusive database ranges", () => {
    expect(parsePagination({ page: "3", pageSize: "10" })).toEqual({
      page: 3,
      pageSize: 10,
      from: 20,
      to: 29,
    });
  });

  it("calculates total pages safely for empty and partial result sets", () => {
    expect(totalPages(0, 20)).toBe(1);
    expect(totalPages(41, 20)).toBe(3);
    expect(totalPages(-1, 0)).toBe(1);
  });
});
