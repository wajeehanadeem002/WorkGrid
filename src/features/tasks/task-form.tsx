"use client";

import { useActionState } from "react";
import { FieldError } from "@/components/field-error";
import { FormFeedback } from "@/components/form-feedback";
import { SubmitButton } from "@/components/submit-button";
import { initialActionState, type ActionState } from "@/lib/security/errors";
import type { Task } from "@/types/domain";

interface ProjectOption {
  id: string;
  name: string;
  key: string;
}
interface MemberOption {
  userId: string;
  label: string;
}

export function TaskForm({
  action,
  task,
  projects,
  members,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  task?: Task;
  projects: ProjectOption[];
  members: MemberOption[];
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="form-card" noValidate>
      <FormFeedback state={state} />
      <div className="field">
        <label htmlFor="task-title">Task title</label>
        <input
          id="task-title"
          name="title"
          required
          minLength={2}
          maxLength={200}
          defaultValue={task?.title}
          aria-describedby="task-title-error"
          aria-invalid={Boolean(state.fieldErrors?.title)}
        />
        <FieldError id="task-title-error" errors={state.fieldErrors?.title} />
      </div>
      <div className="field">
        <label htmlFor="task-description">Description</label>
        <textarea
          id="task-description"
          name="description"
          rows={7}
          maxLength={20000}
          defaultValue={task?.description}
          aria-describedby="task-description-error"
          aria-invalid={Boolean(state.fieldErrors?.description)}
        />
        <FieldError
          id="task-description-error"
          errors={state.fieldErrors?.description}
        />
      </div>
      <div className="form-grid form-grid--two">
        <div className="field">
          <label htmlFor="task-project">Project</label>
          {task ? (
            <input type="hidden" name="projectId" value={task.project_id} />
          ) : null}
          <select
            id="task-project"
            name={task ? undefined : "projectId"}
            required
            disabled={Boolean(task)}
            defaultValue={task?.project_id ?? projects[0]?.id}
            aria-describedby="task-project-error"
            aria-invalid={Boolean(state.fieldErrors?.projectId)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.key ? `${project.key} · ` : ""}
                {project.name}
              </option>
            ))}
          </select>
          <FieldError
            id="task-project-error"
            errors={state.fieldErrors?.projectId}
          />
        </div>
        <div className="field">
          <label htmlFor="task-assignee">Assignee</label>
          <select
            id="task-assignee"
            name="assigneeId"
            defaultValue={task?.assignee_id ?? ""}
            aria-describedby="task-assignee-error"
            aria-invalid={Boolean(state.fieldErrors?.assigneeId)}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.label ?? member.userId}
              </option>
            ))}
          </select>
          <FieldError
            id="task-assignee-error"
            errors={state.fieldErrors?.assigneeId}
          />
        </div>
        <div className="field">
          <label htmlFor="task-status">Status</label>
          <select
            id="task-status"
            name="status"
            defaultValue={task?.status ?? "TODO"}
            aria-describedby="task-status-error"
            aria-invalid={Boolean(state.fieldErrors?.status)}
          >
            <option value="TODO">To do</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="IN_REVIEW">In review</option>
            <option value="DONE">Done</option>
          </select>
          <FieldError
            id="task-status-error"
            errors={state.fieldErrors?.status}
          />
        </div>
        <div className="field">
          <label htmlFor="task-priority">Priority</label>
          <select
            id="task-priority"
            name="priority"
            defaultValue={task?.priority ?? "MEDIUM"}
            aria-describedby="task-priority-error"
            aria-invalid={Boolean(state.fieldErrors?.priority)}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
          <FieldError
            id="task-priority-error"
            errors={state.fieldErrors?.priority}
          />
        </div>
        <div className="field">
          <label htmlFor="task-due-date">Due date</label>
          <input
            id="task-due-date"
            name="dueDate"
            type="date"
            defaultValue={task?.due_date ?? ""}
            aria-describedby="task-due-date-error"
            aria-invalid={Boolean(state.fieldErrors?.dueDate)}
          />
          <FieldError
            id="task-due-date-error"
            errors={state.fieldErrors?.dueDate}
          />
        </div>
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Saving task…">
          {task ? "Save changes" : "Create task"}
        </SubmitButton>
      </div>
    </form>
  );
}
