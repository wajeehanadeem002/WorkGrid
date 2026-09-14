import type { ProjectFilters as ProjectFilterValues } from "@/features/shared/schemas";

export function ProjectFilters({ values }: { values: ProjectFilterValues }) {
  return (
    <form className="filter-bar" role="search" method="get">
      <div className="field field--search">
        <label htmlFor="project-query">Search projects</label>
        <input
          id="project-query"
          name="query"
          type="search"
          defaultValue={values.query}
          placeholder="Name contains…"
        />
      </div>
      <div className="field">
        <label htmlFor="project-status">Project status</label>
        <select id="project-status" name="status" defaultValue={values.status}>
          <option value="ALL">All statuses</option>
          <option value="PLANNED">Planned</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_HOLD">On hold</option>
          <option value="COMPLETED">Completed</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="project-sort">Sort projects</label>
        <select id="project-sort" name="sort" defaultValue={values.sort}>
          <option value="updated_desc">Recently updated</option>
          <option value="updated_asc">Least recently updated</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
        </select>
      </div>
      <button
        className="button button--secondary filter-bar__submit"
        type="submit"
      >
        Apply filters
      </button>
    </form>
  );
}
