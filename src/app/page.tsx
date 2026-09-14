import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleCheckBig,
  Crown,
  FolderKanban,
  FolderPlus,
  Gauge,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
import { Logo } from "@/components/logo";

const features = [
  {
    icon: FolderKanban,
    title: "Structured delivery",
    text: "Projects, tasks, ownership, due dates, and progress stay in one reliable operating view.",
  },
  {
    icon: Users,
    title: "Clear accountability",
    text: "Organization roles and assignments make responsibilities explicit without slowing the team down.",
  },
  {
    icon: Search,
    title: "Find work quickly",
    text: "Server-side search, focused filters, and pagination keep large workspaces responsive.",
  },
  {
    icon: Workflow,
    title: "Useful workflow",
    text: "Move work from to-do through review and completion with a concise, consistent status model.",
  },
  {
    icon: ShieldCheck,
    title: "Tenant-safe by design",
    text: "Application authorization and PostgreSQL Row Level Security independently enforce organization isolation.",
  },
  {
    icon: LockKeyhole,
    title: "Private attachments",
    text: "Validated files stay in private storage and are streamed only after an authorized request.",
  },
];

const previewNavigation = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: FolderKanban, label: "Projects" },
  { icon: ListTodo, label: "Tasks" },
  { icon: Activity, label: "Activity" },
  { icon: Settings, label: "Settings" },
];

const previewTasks = [
  {
    key: "WG-42",
    title: "Finalize release checklist",
    status: "In review",
    priority: "High",
  },
  {
    key: "WG-41",
    title: "Verify tenant policies",
    status: "In progress",
    priority: "Urgent",
  },
  {
    key: "WG-38",
    title: "Document storage lifecycle",
    status: "Done",
    priority: "Medium",
  },
];

const assurances = [
  { icon: LockKeyhole, label: "Private by default" },
  { icon: Users, label: "Built-in roles" },
  { icon: Activity, label: "Complete audit trail" },
];

const workflowSteps = [
  {
    icon: Building2,
    title: "Create your organization",
    text: "Set the secure workspace boundary, invite your team, and give each person the right role.",
  },
  {
    icon: FolderPlus,
    title: "Plan projects and tasks",
    text: "Turn outcomes into owned, prioritized work with clear due dates and shared project context.",
  },
  {
    icon: CircleCheckBig,
    title: "Deliver with accountability",
    text: "Follow progress, surface overdue work, and keep every important change in the activity history.",
  },
];

const roles = [
  {
    icon: Crown,
    name: "Owner",
    summary: "Full control over the organization and its security boundary.",
    permissions: [
      "Organization settings",
      "Members and roles",
      "All projects and audit history",
    ],
  },
  {
    icon: ShieldCheck,
    name: "Admin",
    summary: "Operational control without access to ownership transfer.",
    permissions: [
      "Member management",
      "Project administration",
      "Relevant organization activity",
    ],
  },
  {
    icon: UserRound,
    name: "Member",
    summary: "The tools to contribute work without unnecessary administration.",
    permissions: [
      "Permitted projects",
      "Tasks and assignments",
      "Comments and attachments",
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="public-header">
        <div className="public-header__inner container">
          <Logo />
          <nav
            className="public-nav public-nav--sections"
            aria-label="Public navigation"
          >
            <a href="#product">Product</a>
            <a href="#workflow">Solutions</a>
            <a href="#security">Security</a>
          </nav>
          <nav
            className="public-nav public-nav--actions"
            aria-label="Account navigation"
          >
            <Link className="button button--ghost" href="/sign-in">
              Sign in
            </Link>
            <Link className="button button--primary" href="/sign-up">
              Create your workspace <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="hero">
          <div className="hero__grid container">
            <div className="hero__copy">
              <p className="eyebrow">A calmer way to run complex work</p>
              <h1 aria-label="Clarity for every project. Accountability for every task.">
                <span className="hero-heading__line">
                  Clarity for every project.
                </span>{" "}
                <span className="hero-heading__line">
                  Accountability for every task.
                </span>
              </h1>
              <p className="hero__lead">
                WorkGrid gives engineering, product, and operations teams a
                secure, focused place to organize projects, assign work, and
                keep what matters moving.
              </p>
              <div className="hero__actions">
                <Link className="button button--primary" href="/sign-up">
                  Create your workspace{" "}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <a className="button button--secondary" href="#product">
                  Explore the product
                </a>
              </div>
              <ul
                className="hero__trust"
                aria-label="WorkGrid security highlights"
              >
                {assurances.map(({ icon: Icon, label }) => (
                  <li key={label}>
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <section
              className="command-preview"
              aria-label="WorkGrid product preview"
            >
              <aside
                className="command-preview__rail"
                aria-label="Preview navigation"
              >
                <div className="command-preview__brand">
                  <span
                    className="command-preview__brand-mark"
                    aria-hidden="true"
                  >
                    <Image
                      src="/brand/workgrid-mark.png"
                      alt=""
                      width={24}
                      height={24}
                      unoptimized
                    />
                  </span>
                  <span>WorkGrid</span>
                </div>
                <nav>
                  {previewNavigation.map(({ icon: Icon, label, active }) => (
                    <span
                      className={
                        active
                          ? "command-preview__nav-item is-active"
                          : "command-preview__nav-item"
                      }
                      key={label}
                    >
                      <Icon size={14} aria-hidden="true" />
                      {label}
                    </span>
                  ))}
                </nav>
                <div className="command-preview__team">
                  <span>Organization</span>
                  Northstar Studio
                </div>
              </aside>

              <div className="command-preview__main">
                <div className="command-preview__topbar">
                  <div>
                    <span className="command-preview__kicker">
                      Project overview
                    </span>
                    <strong>Platform revamp</strong>
                  </div>
                  <span className="preview-avatar" aria-label="Project lead AM">
                    AM
                  </span>
                </div>

                <div
                  className="command-preview__stats"
                  aria-label="Project summary"
                >
                  <div>
                    <span>Progress</span>
                    <strong>68%</strong>
                  </div>
                  <div>
                    <span>Open tasks</span>
                    <strong>14</strong>
                  </div>
                  <div>
                    <span>Due this week</span>
                    <strong>5</strong>
                  </div>
                </div>

                <div className="command-preview__progress">
                  <div className="command-preview__section-title">
                    <strong>Project progress</strong>
                    <span>68% complete</span>
                  </div>
                  <div className="preview-progress-track" aria-hidden="true">
                    <span />
                  </div>
                </div>

                <div className="command-preview__lower">
                  <div className="command-preview__tasks">
                    <div className="command-preview__section-title">
                      <strong>Recent tasks</strong>
                      <span>View all</span>
                    </div>
                    <div
                      className="preview-task-table"
                      role="table"
                      aria-label="Recent project tasks"
                    >
                      {previewTasks.map((task) => (
                        <div
                          className="preview-task-row"
                          role="row"
                          key={task.key}
                        >
                          <span className="preview-task-key" role="cell">
                            {task.key}
                          </span>
                          <span className="preview-task-name" role="cell">
                            {task.title}
                          </span>
                          <span
                            className={`preview-status preview-status--${task.status.toLowerCase().replace(" ", "-")}`}
                            role="cell"
                          >
                            {task.status}
                          </span>
                          <span className="preview-priority" role="cell">
                            {task.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <aside
                    className="command-preview__activity"
                    aria-label="Recent activity"
                  >
                    <div className="command-preview__section-title">
                      <strong>Recent activity</strong>
                    </div>
                    <div className="preview-activity-item">
                      <span className="preview-avatar preview-avatar--small">
                        SL
                      </span>
                      <p>
                        <strong>Sam Lee</strong> moved WG-42 to review.
                        <small>8 min ago</small>
                      </p>
                    </div>
                    <div className="preview-activity-item">
                      <span className="preview-avatar preview-avatar--small preview-avatar--mint">
                        JD
                      </span>
                      <p>
                        <strong>Jordan Diaz</strong> completed WG-38.
                        <small>32 min ago</small>
                      </p>
                    </div>
                  </aside>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section
          className="section section--white product-showcase"
          id="product"
          aria-labelledby="product-showcase-title"
        >
          <div className="container">
            <div className="section-heading product-showcase__heading">
              <p className="eyebrow">See the whole picture</p>
              <h2
                id="product-showcase-title"
                aria-label="One workspace. Four clear views."
              >
                <span className="product-showcase-heading__line">
                  One workspace.
                </span>{" "}
                <span className="product-showcase-heading__line">
                  Four clear views.
                </span>
              </h2>
              <p className="product-showcase__intro">
                <span>
                  Move from organization health to the next concrete action
                </span>{" "}
                <span>without stitching together disconnected tools.</span>
              </p>
            </div>

            <div className="product-showcase__grid">
              <article className="product-area product-area--dashboard">
                <div className="product-area__heading">
                  <span className="product-area__icon">
                    <Gauge size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>Dashboard</h3>
                    <p>Know what needs attention now.</p>
                  </div>
                </div>
                <dl className="showcase-metrics">
                  <div>
                    <dt>Active projects</dt>
                    <dd>8</dd>
                  </div>
                  <div>
                    <dt>Open tasks</dt>
                    <dd>42</dd>
                  </div>
                  <div>
                    <dt>Overdue</dt>
                    <dd>3</dd>
                  </div>
                </dl>
                <div className="showcase-progress">
                  <div>
                    <span>Platform revamp</span>
                    <strong>68%</strong>
                  </div>
                  <progress value="68" max="100">
                    68%
                  </progress>
                  <div>
                    <span>Client portal</span>
                    <strong>84%</strong>
                  </div>
                  <progress value="84" max="100">
                    84%
                  </progress>
                </div>
              </article>

              <article className="product-area">
                <div className="product-area__heading">
                  <span className="product-area__icon">
                    <FolderKanban size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>Projects</h3>
                    <p>Keep scope, status, and progress together.</p>
                  </div>
                </div>
                <ul className="showcase-list" aria-label="Example projects">
                  <li>
                    <span>
                      <strong>WG</strong> Platform revamp
                    </span>
                    <small>Active</small>
                  </li>
                  <li>
                    <span>
                      <strong>CP</strong> Client portal
                    </span>
                    <small>Active</small>
                  </li>
                  <li>
                    <span>
                      <strong>DX</strong> Developer experience
                    </span>
                    <small>Planned</small>
                  </li>
                </ul>
              </article>

              <article className="product-area">
                <div className="product-area__heading">
                  <span className="product-area__icon">
                    <ListTodo size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>Tasks</h3>
                    <p>Make priorities and ownership obvious.</p>
                  </div>
                </div>
                <ul
                  className="showcase-list showcase-list--tasks"
                  aria-label="Example tasks"
                >
                  <li>
                    <span>
                      <strong>WG-42</strong> Release checklist
                    </span>
                    <small>In review</small>
                  </li>
                  <li>
                    <span>
                      <strong>WG-41</strong> Verify tenant policies
                    </span>
                    <small>In progress</small>
                  </li>
                  <li>
                    <span>
                      <strong>WG-38</strong> Storage lifecycle
                    </span>
                    <small>Done</small>
                  </li>
                </ul>
              </article>

              <article className="product-area">
                <div className="product-area__heading">
                  <span className="product-area__icon">
                    <Activity size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>Activity log</h3>
                    <p>Understand what changed and who changed it.</p>
                  </div>
                </div>
                <ol className="showcase-activity" aria-label="Example activity">
                  <li>
                    <span aria-hidden="true" />
                    <p>
                      <strong>Sam</strong> moved WG-42 to review.
                      <small>8 min ago</small>
                    </p>
                  </li>
                  <li>
                    <span aria-hidden="true" />
                    <p>
                      <strong>Jordan</strong> completed WG-38.
                      <small>32 min ago</small>
                    </p>
                  </li>
                </ol>
              </article>
            </div>
          </div>
        </section>

        <section
          className="section workflow-section"
          id="workflow"
          aria-labelledby="workflow-title"
        >
          <div className="container">
            <div className="section-heading section-heading--centered">
              <p className="eyebrow">How WorkGrid works</p>
              <h2 id="workflow-title">
                From workspace to progress in three steps.
              </h2>
              <p>
                Start with a secure team boundary, then keep delivery moving
                with a workflow everyone can understand.
              </p>
            </div>
            <ol className="workflow-steps">
              {workflowSteps.map(({ icon: Icon, title, text }, index) => (
                <li key={title}>
                  <span className="workflow-step__number">0{index + 1}</span>
                  <span className="workflow-step__icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section section--white capabilities-section">
          <div className="container">
            <div className="section-heading">
              <p className="eyebrow">Built for cross-functional teams</p>
              <h2>Move work forward, together.</h2>
              <p>
                Enough structure to keep work reliable, without turning project
                management into a project of its own.
              </p>
            </div>
            <div className="feature-grid">
              {features.map(({ icon: Icon, title, text }) => (
                <article className="feature-card" key={title}>
                  <span className="feature-card__icon">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="section roles-section"
          aria-labelledby="roles-title"
        >
          <div className="container">
            <div className="section-heading roles-section__heading">
              <p className="eyebrow">Purposeful permissions</p>
              <h2
                id="roles-title"
                aria-label="The right control for every role."
              >
                <span className="roles-heading__line">The right control</span>{" "}
                <span className="roles-heading__line">for every role.</span>
              </h2>
              <p className="roles-section__intro">
                <span>
                  Responsibilities stay clear while sensitive organization
                  controls remain
                </span>{" "}
                <span>with the people who should have them.</span>
              </p>
            </div>
            <div className="role-grid">
              {roles.map(
                ({ icon: Icon, name, summary, permissions }, index) => {
                  const titleId = `role-${name.toLowerCase()}`;
                  return (
                    <article
                      className={
                        index === 0
                          ? "role-card role-card--featured"
                          : "role-card"
                      }
                      aria-labelledby={titleId}
                      key={name}
                    >
                      <div className="role-card__topline">
                        <span className="role-card__icon">
                          <Icon size={20} aria-hidden="true" />
                        </span>
                        <span className="role-card__label">
                          Organization role
                        </span>
                      </div>
                      <h3 id={titleId}>{name}</h3>
                      <p>{summary}</p>
                      <ul>
                        {permissions.map((permission) => (
                          <li key={permission}>
                            <CheckCircle2 size={16} aria-hidden="true" />
                            {permission}
                          </li>
                        ))}
                      </ul>
                    </article>
                  );
                },
              )}
            </div>
          </div>
        </section>

        <section className="section" id="security">
          <div className="container">
            <div className="security-panel">
              <div>
                <p className="eyebrow">Security model</p>
                <h2>Your organization is a hard boundary.</h2>
                <p>
                  WorkGrid checks identity and permissions in the application
                  and again at the database.
                </p>
              </div>
              <ul className="security-list">
                {[
                  "Every protected operation verifies membership and role.",
                  "Tenant relationships are enforced with composite database constraints.",
                  "Attachments remain private and require a freshly authorized application download.",
                  "Important administrative and work changes are recorded in an append-only audit history.",
                ].map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="closing-cta" aria-labelledby="closing-cta-title">
          <div className="closing-cta__inner container">
            <div>
              <p className="eyebrow">Ready when your team is</p>
              <h2 id="closing-cta-title">
                Bring every project into one accountable workspace.
              </h2>
              <p>
                Give your team one calm, secure place to plan the work and
                follow it through.
              </p>
            </div>
            <div className="closing-cta__actions">
              <Link className="button button--cta-light" href="/sign-up">
                Create your workspace{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="button button--cta-ghost" href="/sign-in">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="container">
          © {new Date().getFullYear()} WorkGrid. Secure project operations.
        </div>
      </footer>
    </div>
  );
}
