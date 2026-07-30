"use client";

import { useMemo, useState } from "react";

type UserRow = { id: string; email: string; username?: string | null; role?: string | null; status?: string | null; created_at?: string | null };
type ProjectRow = { id: string; slug: string; name?: string | null; title?: string | null };
type SongRow = { id: string; slug: string; title?: string | null; artist_name?: string | null; project_id?: string | null; source_app_slug?: string | null };
type AppRow = { id: string; slug: string; name?: string | null; title?: string | null };

function labelProject(project: ProjectRow) { return project.name || project.title || project.slug; }
function labelSong(song: SongRow) { return song.title || song.slug; }
function labelApp(app: AppRow) { return app.name || app.title || app.slug; }

export default function AdminAccountsClient({
  adminEmail,
  users,
  projects,
  songs,
  apps,
}: {
  adminEmail: string;
  users: UserRow[];
  projects: ProjectRow[];
  songs: SongRow[];
  apps: AppRow[];
}) {
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: "",
    username: "",
    role: "user",
    kiikuAmount: "25",
    kiikuReason: "Admin adjustment",
    projectId: projects[0]?.id || "",
    songId: songs[0]?.id || "",
    appId: apps[0]?.id || "",
    passKey: "all_access",
    inviteEmail: "",
    inviteRole: "user",
    blastSubject: "",
    blastBody: "",
  });

  const filteredUsers = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return users;
    return users.filter((user) => `${user.email} ${user.username || ""} ${user.role || ""}`.toLowerCase().includes(q));
  }, [users, query]);

  const selectedUser = users.find((user) => user.id === selectedUserId) || users[0] || null;

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function action(type: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage("");
    const result = await fetch("/api/admin/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: type, targetUserId: selectedUser?.id, ...payload }),
    }).then((res) => res.json()).catch(() => ({ ok: false, error: "Admin action failed." }));
    setBusy(false);
    setMessage(result.ok ? result.message || "Admin action complete." : result.error || "Admin action failed.");
  }

  return (
    <main className="admin-os-page">
      <section className="admin-os-shell">
        <header className="admin-os-topbar">
          <a href="/dashboard" className="admin-os-pill">‹ Dashboard</a>
          <a href="/home" className="admin-os-pill">Home</a>
        </header>

        <section className="admin-os-hero">
          <div>
            <p>Account Admin</p>
            <h1>Users</h1>
            <span>Create accounts, give access, add Kiiku, generate invites, and send platform messages. Admin: {adminEmail}</span>
          </div>
          <div className="admin-os-gear">👤</div>
        </section>

        {message ? <section className="admin-form-card"><strong>{message}</strong></section> : null}

        <section className="admin-control-grid">
          <aside className="admin-control-card">
            <h2>All accounts</h2>
            <input className="admin-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email, username, role" />
            <div className="admin-list">
              {filteredUsers.map((user) => (
                <button className="admin-row-card" key={user.id} onClick={() => setSelectedUserId(user.id)}>
                  <span>
                    <strong>{user.username || user.email}</strong>
                    <small>{user.email}</small>
                  </span>
                  <span className="admin-role-pill">{user.role || "user"}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="admin-control-card">
            <h2>{selectedUser ? selectedUser.email : "Select an account"}</h2>
            <p className="admin-muted">Use these controls to update the selected account. All sensitive actions are written to the admin audit log.</p>

            <div className="admin-form-card">
              <h2>Create account</h2>
              <input className="admin-input" placeholder="Email" value={form.email} onChange={(event) => update("email", event.target.value)} />
              <input className="admin-input" placeholder="Username" value={form.username} onChange={(event) => update("username", event.target.value)} />
              <select className="admin-select" value={form.role} onChange={(event) => update("role", event.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
              <button className="admin-btn" disabled={busy} onClick={() => action("create_account", { email: form.email, username: form.username, role: form.role })}>Create Account</button>
            </div>

            <div className="admin-form-card">
              <h2>Role + status</h2>
              <div className="admin-button-row">
                <button className="admin-btn secondary" disabled={busy || !selectedUser} onClick={() => action("set_role", { role: "user" })}>Make User</button>
                <button className="admin-btn secondary" disabled={busy || !selectedUser} onClick={() => action("set_role", { role: "admin" })}>Make Admin</button>
                <button className="admin-btn secondary" disabled={busy || !selectedUser} onClick={() => action("set_role", { role: "owner" })}>Make Owner</button>
                <button className="admin-btn secondary" disabled={busy || !selectedUser} onClick={() => action("set_status", { status: "active" })}>Activate</button>
                <button className="admin-btn secondary" disabled={busy || !selectedUser} onClick={() => action("set_status", { status: "disabled" })}>Disable</button>
              </div>
            </div>

            <div className="admin-form-card">
              <h2>Grant access</h2>
              <select className="admin-select" value={form.projectId} onChange={(event) => update("projectId", event.target.value)}>
                {projects.map((project) => <option key={project.id} value={project.id}>{labelProject(project)}</option>)}
              </select>
              <button className="admin-btn" disabled={busy || !selectedUser} onClick={() => action("grant_project", { projectId: form.projectId })}>Grant Project Access</button>

              <select className="admin-select" value={form.songId} onChange={(event) => update("songId", event.target.value)}>
                {songs.map((song) => <option key={song.id} value={song.id}>{labelSong(song)}</option>)}
              </select>
              <button className="admin-btn" disabled={busy || !selectedUser} onClick={() => action("grant_song", { songId: form.songId })}>Grant Song Access</button>

              <select className="admin-select" value={form.appId} onChange={(event) => update("appId", event.target.value)}>
                {apps.map((app) => <option key={app.id} value={app.id}>{labelApp(app)}</option>)}
              </select>
              <button className="admin-btn" disabled={busy || !selectedUser} onClick={() => action("grant_app", { appId: form.appId })}>Grant App Access</button>

              <select className="admin-select" value={form.passKey} onChange={(event) => update("passKey", event.target.value)}>
                <option value="all_access">Full OS Access</option>
                <option value="music_full">Music Full</option>
                <option value="founder">Founder</option>
              </select>
              <button className="admin-btn" disabled={busy || !selectedUser} onClick={() => action("grant_pass", { accessKey: form.passKey })}>Grant Pass</button>
            </div>

            <div className="admin-form-card">
              <h2>Kiiku adjustment</h2>
              <input className="admin-input" type="number" value={form.kiikuAmount} onChange={(event) => update("kiikuAmount", event.target.value)} />
              <input className="admin-input" value={form.kiikuReason} onChange={(event) => update("kiikuReason", event.target.value)} />
              <button className="admin-btn" disabled={busy || !selectedUser} onClick={() => action("add_kiiku", { amount: Number(form.kiikuAmount), reason: form.kiikuReason })}>Add Kiiku</button>
            </div>

            <div className="admin-form-card">
              <h2>Invite link</h2>
              <input className="admin-input" placeholder="Invite email, optional" value={form.inviteEmail} onChange={(event) => update("inviteEmail", event.target.value)} />
              <select className="admin-select" value={form.inviteRole} onChange={(event) => update("inviteRole", event.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button className="admin-btn" disabled={busy} onClick={() => action("create_invite", { email: form.inviteEmail, role: form.inviteRole })}>Create Invite Link</button>
            </div>

            <div className="admin-form-card">
              <h2>Blast email</h2>
              <input className="admin-input" placeholder="Subject" value={form.blastSubject} onChange={(event) => update("blastSubject", event.target.value)} />
              <textarea className="admin-textarea" placeholder="Message" value={form.blastBody} onChange={(event) => update("blastBody", event.target.value)} />
              <button className="admin-btn" disabled={busy} onClick={() => action("create_blast", { subject: form.blastSubject, body: form.blastBody })}>Create Blast</button>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
