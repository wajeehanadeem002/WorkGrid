import type { Project } from "@/types/domain";
import type { TaskFilters as TaskFilterValues } from "@/features/shared/schemas";

export function TaskFilters({
  values,
  projects,
  members,
}: {
  values: TaskFilterValues;
  projects: Pick<Project, "id" | "name" | "key">[];
  members: Array<{ userId: string; label: string }>;
}) {
  return (
    <form className="filter-bar filter-bar--tasks" role="search" method="get">
      <div className="field field--search">
        <label htmlFor="task-query">Search tasks</label>
        <input
          id="task-query"
          name="query"
          type="search"
          defaultValue={values.query}
          placeholder="Title contains…"
        />
      </div>
      <div className="field">
        <label htmlFor="filter-status">Status</label>
        <select id="filter-status" name="status" defaultValue={values.status}>
          <option value="ALL">All statuses</option>
          <option value="TODO">To do</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="IN_REVIEW">In review</option>
          <option value="DONE">Done</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="filter-priority">Priority</label>
        <select
          id="filter-priority"
          name="priority"
          defaultValue={values.priority}
        >
          <option value="ALL">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="filter-project">Project</label>
        <select
          id="filter-project"
          name="project"
          defaultValue={values.project}
        >
          <option value="ALL">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.key} · {project.name}
            </option>
          ))}
        </select>
      </div>
      <details className="filter-more">
        <summary className="button button--secondary">More filters</summary>
        <div className="card filter-more__panel">
          <div className="field">
            <label htmlFor="filter-assignee">Assignee</label>
            <select
              id="filter-assignee"
              name="assignee"
              defaultValue={values.assignee}
            >
              <option value="ALL">Anyone</option>
              <option value="UNASSIGNED">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-due">Due</label>
            <select id="filter-due" name="due" defaultValue={values.due}>
              <option value="ALL">Any date</option>
              <option value="OVERDUE">Overdue</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="NONE">No due date</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-sort">Sort</label>
            <select id="filter-sort" name="sort" defaultValue={values.sort}>
              <option value="updated_desc">Recently updated</option>
              <option value="updated_asc">Least recently updated</option>
              <option value="due_asc">Due date</option>
              <option value="priority_desc">Priority</option>
            </select>
          </div>
        </div>
      </details>
      <button
        className="button button--primary filter-bar__submit"
        type="submit"
      >
        Apply filters
      </button>
    </form>
  );
}
