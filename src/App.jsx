import { useEffect, useState } from "react";

const statusLabels = {
  todo: "Todo",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

const initialProjectForm = { name: "", description: "" };
const initialMemberForm = { projectId: "", userId: "", memberRole: "member" };
const initialTaskForm = {
  title: "",
  projectId: "",
  assigneeId: "",
  dueDate: "",
  priority: "medium",
  status: "todo",
  description: "",
};

async function api(path, options = {}) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

function empty(message) {
  return (
    <div className="empty">
      <p className="eyebrow">Nothing here yet</p>
      <strong>{message}</strong>
    </div>
  );
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "member" });
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      const result = await api(`/api/${mode}`, { method: "POST", body: form });
      onAuthenticated(result.user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="auth-shell">
      <div className="brand">
        <p className="eyebrow">Team delivery studio</p>
        <h1>Team Task Manager</h1>
        <span>Plan projects, assign accountable owners, and track progress from a cleaner MERN workspace.</span>
      </div>
      <form className="panel auth-card" onSubmit={handleSubmit}>
        <div className="tabs">
          <button type="button" className={`tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>
            Login
          </button>
          <button type="button" className={`tab ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>
            Signup
          </button>
        </div>
        {mode === "signup" ? (
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
        ) : null}
        <label>
          Email
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
            minLength={8}
          />
        </label>
        {mode === "signup" ? (
          <label>
            Role
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        ) : null}
        <button className="primary" type="submit">
          {mode === "login" ? "Login" : "Create account"}
        </button>
        <p className="form-error">{error}</p>
      </form>
    </section>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [dashboard, setDashboard] = useState({ summary: { total: 0, overdue: 0, done: 0, inProgress: 0 }, tasks: [] });
  const [loading, setLoading] = useState(true);
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [memberForm, setMemberForm] = useState(initialMemberForm);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    async function boot() {
      try {
        const { user: current } = await api("/api/me");
        if (current) {
          setUser(current);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    boot();
  }, []);

  useEffect(() => {
    if (!user) return;

    async function refreshData() {
      try {
        const [usersPayload, projectsPayload, tasksPayload, dashboardPayload] = await Promise.all([
          api("/api/users"),
          api("/api/projects"),
          api("/api/tasks"),
          api("/api/dashboard"),
        ]);

        setUsers(usersPayload.users);
        setProjects(projectsPayload.projects);
        setTasks(tasksPayload.tasks);
        setDashboard(dashboardPayload);

        setMemberForm((previous) => ({
          ...previous,
          projectId: previous.projectId || projectsPayload.projects[0]?.id || "",
          userId: previous.userId || usersPayload.users[0]?.id || "",
        }));

        setTaskForm((previous) => ({
          ...previous,
          projectId: previous.projectId || projectsPayload.projects[0]?.id || "",
        }));
      } catch (error) {
        if (error.status === 401) {
          handleLogout(true);
        }
      }
    }

    refreshData();
  }, [user]);

  async function handleLogout(skipRequest = false) {
    if (!skipRequest) {
      await api("/api/logout", { method: "POST" });
    }
    setUser(null);
    setUsers([]);
    setProjects([]);
    setTasks([]);
    setDashboard({ summary: { total: 0, overdue: 0, done: 0, inProgress: 0 }, tasks: [] });
    setView("dashboard");
  }

  async function refreshAll() {
    const [usersPayload, projectsPayload, tasksPayload, dashboardPayload] = await Promise.all([
      api("/api/users"),
      api("/api/projects"),
      api("/api/tasks"),
      api("/api/dashboard"),
    ]);
    setUsers(usersPayload.users);
    setProjects(projectsPayload.projects);
    setTasks(tasksPayload.tasks);
    setDashboard(dashboardPayload);
  }

  async function submitProject(event) {
    event.preventDefault();
    await api("/api/projects", { method: "POST", body: projectForm });
    setProjectForm(initialProjectForm);
    await refreshAll();
  }

  async function submitMember(event) {
    event.preventDefault();
    if (!memberForm.projectId || !memberForm.userId) {
      window.alert("Create a project and make sure a user is selected before adding a member.");
      return;
    }
    await api("/api/project-members", { method: "POST", body: memberForm });
    await refreshAll();
  }

  async function submitTask(event) {
    event.preventDefault();
    if (!taskForm.projectId) {
      window.alert("Create a project first, then create a task.");
      return;
    }
    await api("/api/tasks", { method: "POST", body: taskForm });
    setTaskForm((previous) => ({ ...initialTaskForm, projectId: previous.projectId }));
    await refreshAll();
  }

  async function updateTaskStatus(id, status) {
    await api(`/api/tasks/${id}`, { method: "PATCH", body: { status } });
    await refreshAll();
  }

  async function deleteTask(id) {
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    await refreshAll();
  }

  if (loading) {
    return <main className="loading-shell">Loading workspace...</main>;
  }

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />;
  }

  const summary = dashboard.summary;
  const visibleTasks = statusFilter ? tasks.filter((task) => task.status === statusFilter) : tasks;
  const completion = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;

  return (
    <section className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">Control center</p>
          <h2>Team Task Manager</h2>
          <small>
            {user.name} / {user.role}
          </small>
        </div>
        <nav className="nav">
          {["dashboard", "projects", "tasks", ...(user.role === "admin" ? ["admin"] : [])].map((item) => (
            <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>
              {item === "admin" ? "Admin" : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <button className="ghost" id="logout" onClick={() => handleLogout(false)}>
          Logout
        </button>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>{view === "admin" ? "Admin workspace" : view[0].toUpperCase() + view.slice(1)}</h1>
          </div>
          <span className="user-chip">{user.email}</span>
        </div>

        {view === "dashboard" ? (
          <>
            <section className="hero card">
              <div className="hero-copy">
                <p className="eyebrow">Live snapshot</p>
                <h2>{user.name}, your team is {completion}% through the visible workload.</h2>
                <p className="hero-text">Track delivery, rebalance assignments, and keep projects moving before deadlines slip.</p>
              </div>
              <div className="hero-metric">
                <span>Completion</span>
                <strong>{completion}%</strong>
                <small>
                  {summary.done} of {summary.total} tasks closed
                </small>
              </div>
            </section>

            <div className="stats">
              <article className="stat">
                <span>Total tasks</span>
                <strong>{summary.total}</strong>
                <small>Across every visible project</small>
              </article>
              <article className="stat">
                <span>In progress</span>
                <strong>{summary.inProgress}</strong>
                <small>Active items needing momentum</small>
              </article>
              <article className="stat">
                <span>Done</span>
                <strong>{summary.done}</strong>
                <small>Completed work ready to review</small>
              </article>
              <article className="stat">
                <span>Overdue</span>
                <strong>{summary.overdue}</strong>
                <small>Past due and still open</small>
              </article>
            </div>

            <div className="grid">
              <section className="stack">
                <div className="section-head">
                  <h2>Upcoming work</h2>
                </div>
                {dashboard.tasks.length ? dashboard.tasks.map((task) => <TaskCard key={task.id} task={task} user={user} onDelete={deleteTask} onStatus={updateTaskStatus} />) : empty("No visible tasks yet.")}
              </section>
              <section className="stack">
                <div className="section-head">
                  <h2>Project progress</h2>
                </div>
                {projects.length ? projects.map((project) => <ProjectCard key={project.id} project={project} tasks={tasks} />) : empty("No projects yet.")}
              </section>
            </div>
          </>
        ) : null}

        {view === "projects" ? (
          <>
            <section className="section-banner card">
              <div>
                <p className="eyebrow">Projects</p>
                <h2>Shared spaces for goals, ownership, and progress.</h2>
              </div>
              <p className="muted">Every project card surfaces role, membership, and completion in one glance.</p>
            </section>
            <div className="stack">
              {projects.length ? projects.map((project) => <ProjectCard key={project.id} project={project} tasks={tasks} />) : empty("No projects available. Admins can create one from Admin.")}
            </div>
          </>
        ) : null}

        {view === "tasks" ? (
          <>
            <section className="section-banner card">
              <div>
                <p className="eyebrow">Tasks</p>
                <h2>Filter active work and update status without leaving the board.</h2>
              </div>
              <div className="toolbar">
                <label className="toolbar-label">
                  Status
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="">All statuses</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
            <div className="stack">
              {visibleTasks.length ? visibleTasks.map((task) => <TaskCard key={task.id} task={task} user={user} onDelete={deleteTask} onStatus={updateTaskStatus} />) : empty("No tasks match this filter.")}
            </div>
          </>
        ) : null}

        {view === "admin" ? (
          user.role !== "admin" ? (
            empty("Admin access is required.")
          ) : (
            <>
              <section className="section-banner card">
                <div>
                  <p className="eyebrow">Admin workspace</p>
                  <h2>Create projects, add members, and launch tasks from one control panel.</h2>
                </div>
                <p className="muted">The forms are grouped to match the usual setup flow: project, members, then execution.</p>
              </section>
              <div className="grid">
                <form className="panel card stack form-panel" onSubmit={submitProject}>
                  <div className="section-head">
                    <h2>Create project</h2>
                  </div>
                  <label>
                    Project name
                    <input value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} required minLength={2} />
                  </label>
                  <label>
                    Description
                    <textarea value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} />
                  </label>
                  <button className="primary">Create project</button>
                </form>

                <form className="panel card stack form-panel" onSubmit={submitMember}>
                  <div className="section-head">
                    <h2>Add team member</h2>
                  </div>
                  <label>
                    Project
                    <select value={memberForm.projectId} onChange={(event) => setMemberForm({ ...memberForm, projectId: event.target.value })} required>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    User
                    <select value={memberForm.userId} onChange={(event) => setMemberForm({ ...memberForm, userId: event.target.value })} required>
                      {users.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name} ({entry.role})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Project role
                    <select value={memberForm.memberRole} onChange={(event) => setMemberForm({ ...memberForm, memberRole: event.target.value })}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <button className="primary">Save member</button>
                </form>

                <form className="panel card stack form-panel wide" onSubmit={submitTask}>
                  <div className="section-head">
                    <h2>Create task</h2>
                  </div>
                  <div className="form-grid">
                    <label>
                      Title
                      <input value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} required minLength={2} />
                    </label>
                    <label>
                      Project
                      <select value={taskForm.projectId} onChange={(event) => setTaskForm({ ...taskForm, projectId: event.target.value })} required>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Assignee
                      <select value={taskForm.assigneeId} onChange={(event) => setTaskForm({ ...taskForm, assigneeId: event.target.value })}>
                        <option value="">Unassigned</option>
                        {users.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} ({entry.role})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Due date
                      <input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} />
                    </label>
                    <label>
                      Priority
                      <select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })}>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="low">Low</option>
                      </select>
                    </label>
                    <label>
                      Status
                      <select value={taskForm.status} onChange={(event) => setTaskForm({ ...taskForm, status: event.target.value })}>
                        <option value="todo">Todo</option>
                        <option value="in_progress">In progress</option>
                        <option value="review">Review</option>
                        <option value="done">Done</option>
                      </select>
                    </label>
                    <label className="wide">
                      Description
                      <textarea value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} />
                    </label>
                  </div>
                  <button className="primary">Create task</button>
                </form>
              </div>
            </>
          )
        ) : null}
      </main>
    </section>
  );
}

function ProjectCard({ project, tasks }) {
  const projectTasks = tasks.filter((task) => task.project?.id === project.id);
  const done = projectTasks.filter((task) => task.status === "done").length;
  const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;

  return (
    <article className="card project-card">
      <div className="card-topline">
        <span className="badge badge-strong">{project.memberRole}</span>
        <span className="muted">{progress}% complete</span>
      </div>
      <h3>{project.name}</h3>
      <p className="muted">{project.description || "No description"}</p>
      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="badge-row">
        <span className="badge">{project.members.length} members</span>
        <span className="badge">
          {done}/{projectTasks.length} done
        </span>
      </div>
      <div className="badge-row">
        {project.members.map((member) => (
          <span key={member.id} className="badge">
            {member.name}
          </span>
        ))}
      </div>
    </article>
  );
}

function TaskCard({ task, user, onDelete, onStatus }) {
  return (
    <article className="card task-card">
      <div className="task-head">
        <div>
          <div className="card-topline">
            <span className={`badge ${task.status}`}>{statusLabels[task.status]}</span>
            <span className="muted">{task.project?.name || "No project"}</span>
          </div>
          <h3>{task.title}</h3>
          <span className="muted">{task.assignee?.name || "Unassigned"}</span>
        </div>
        <select value={task.status} onChange={(event) => onStatus(task.id, event.target.value)} aria-label="Task status">
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <p className="muted">{task.description || "No description"}</p>
      <div className="badge-row">
        <span className={`badge ${task.priority}`}>{task.priority} priority</span>
        <span className="badge">{task.dueDate || "No due date"}</span>
        {user.role === "admin" ? (
          <button className="danger" onClick={() => onDelete(task.id)} type="button">
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}
