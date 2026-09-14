import { describe, expect, it } from "vitest";
import { buildDashboardMetrics } from "./dashboard";

describe("dashboard metric mapping", () => {
  it("calculates completion progress from grouped counts", () => {
    expect(
      buildDashboardMetrics({
        projects: 3,
        all: 8,
        todo: 2,
        inProgress: 2,
        inReview: 1,
        done: 3,
        overdue: 2,
        assigned: 4,
      }),
    ).toEqual({
      projectCount: 3,
      totalTasks: 8,
      completedTasks: 3,
      overdueTasks: 2,
      assignedTasks: 4,
      progressPercent: 38,
      statusCounts: { TODO: 2, IN_PROGRESS: 2, IN_REVIEW: 1, DONE: 3 },
    });
  });

  it("returns zero progress for an empty workspace", () => {
    expect(
      buildDashboardMetrics({
        projects: 0,
        all: 0,
        todo: 0,
        inProgress: 0,
        inReview: 0,
        done: 0,
        overdue: 0,
        assigned: 0,
      }).progressPercent,
    ).toBe(0);
  });
});
