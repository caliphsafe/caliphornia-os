"use client";

import { useEffect, useMemo, useState } from "react";

type View = "overview" | "songs" | "experiences" | "accounts" | "invites" | "blasts";
type AnyRow = Record<string, any>;

type AdminData = {
  summary?: AnyRow;
  users?: AnyRow[];
  songs?: AnyRow[];
  projects?: AnyRow[];
  apps?: AnyRow[];
  invites?: AnyRow[];
  blasts?: AnyRow[];
  products?: AnyRow[];
};

const viewLabels: Array<[View, string]> = [
  ["overview", "Overview"],
  ["songs", "Songs"],
  ["experiences", "Apps"],
  ["accounts", "Accounts"],
  ["invites", "Invites"],
  ["blasts", "Blasts"],
];

function label(row: AnyRow) {
  return row.name || row.title || row.username || row.email || row.slug || row.id || "Untitled";
}

function fmtDate(value?: string | null) {
  if (!value) return "No date";
  try { return new Date(value).toLocaleDateString(); } catch { return "No date"; }
}

function endpointForView(view: View) {
  if (view === "overview") return "/api/admin/accounts?includeOverview=1";
  if (view === "accounts") return "/api/admin/accounts";
  if (view === "songs") return "/api/admin/songs";
  if (view === "experiences") return "/api/admin/experiences";
  if (view === "invites") return "/api/admin/invites";
  return "/api/admin/blasts";
}

export default function AdminControlCenter({ initialView = "overview" }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const [data, setData] = useState<AdminData>({});
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<AnyRow>({});

  async function load(nextView = view) {
    setStatus("");
    const res = await fetch(endpointForView(nextView), { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      setStatus(json.error || "Could not load admin data.");
      return;
    }
    setData(json);
  }

  useEffect(() => { void load(view); }, [view]);

  const summary = useMemo(() => {
    const users = data.users || [];
    const songs = data.songs || [];
    const projects = data.projects || [];
    const invites = data.invites || [];
    const blasts = data.blasts || [];
    return {
      users: data.summary?.users ?? users.length,
      songs: data.summary?.songs ?? songs.length,
      projects: data.summary?.projects ?? projects.length,
      invites: data.summary?.invites ?? invites.length,
      blasts: data.summary?.blasts ?? blasts.length,
    };
  }, [data]);

  async function post(url: string, body: AnyRow, success = "Saved.") {
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Admin action failed.");
      setStatus(success);
      setForm({});
      setSelected(null);
      await load(view);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Admin action failed.");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(row: AnyRow) {
    setSelected(row);
    setForm({ ...row });
  }

  function Overview() {
    return (
      <section className="admin-section">
        <div className="admin-hero-grid">
          <article className="admin-card"><span>Accounts</span><strong>{summary.users}</strong></article>
          <article className="admin-card"><span>Songs</span><strong>{summary.songs}</strong></article>
          <article className="admin-card"><span>Experiences</span><strong>{summary.projects}</strong></article>
          <article className="admin-card"><span>Invites</span><strong>{summary.invites}</strong></article>
        </div>
        <section className="admin-panel">
          <div className="admin-panel-head"><div><p>Command center</p><h2>What this admin controls</h2></div></div>
          <div className="admin-grid">
            <div className="admin-row-card"><strong>Songs</strong><span className="admin-muted">Create, edit, publish, lock, connect audio paths, assign projects, and enable sharing.</span></div>
            <div className="admin-row-card"><strong>Experiences</strong><span className="admin-muted">Manage project/app metadata, release states, app connections, and commerce products.</span></div>
            <div className="admin-row-card"><strong>Accounts</strong><span className="admin-muted">Create users, change roles, add Kiiku, grant access, and review status.</span></div>
            <div className="admin-row-card"><strong>Growth</strong><span className="admin-muted">Create invite links and blast email drafts or sends to the platform list.</span></div>
          </div>
        </section>
      </section>
    );
  }

  function Songs() {
    return (
      <section className="admin-section">
        <section className="admin-panel">
          <div className="admin-panel-head"><div><p>Song control</p><h2>{selected ? `Editing ${label(selected)}` : "Create or update a song"}</h2></div>{selected ? <button className="admin-ghost-button" onClick={() => { setSelected(null); setForm({}); }}>New</button> : null}</div>
          <div className="admin-form-grid">
            <input className="admin-input" placeholder="Title" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="admin-input" placeholder="Slug" value={form.slug || ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <input className="admin-input" placeholder="Artist" value={form.artist_name || form.artist || ""} onChange={(e) => setForm({ ...form, artist_name: e.target.value })} />
            <input className="admin-input" placeholder="Audio path, ex: fartherhood/storytime.mp3" value={form.audio_path || ""} onChange={(e) => setForm({ ...form, audio_path: e.target.value })} />
            <input className="admin-input" placeholder="Preview audio path" value={form.preview_audio_path || ""} onChange={(e) => setForm({ ...form, preview_audio_path: e.target.value })} />
            <select className="admin-select" value={form.status || "active"} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="draft">Draft</option><option value="hidden">Hidden</option><option value="archived">Archived</option></select>
            <select className="admin-select" value={String(form.is_locked ?? false)} onChange={(e) => setForm({ ...form, is_locked: e.target.value === "true" })}><option value="false">Open</option><option value="true">Locked</option></select>
            <select className="admin-select" value={String(form.is_shareable ?? true)} onChange={(e) => setForm({ ...form, is_shareable: e.target.value === "true" })}><option value="true">Shareable</option><option value="false">Not shareable</option></select>
            <select className="admin-select" value={form.project_id || ""} onChange={(e) => setForm({ ...form, project_id: e.target.value || null })}><option value="">No project</option>{(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name || p.slug}</option>)}</select>
          </div>
          <textarea className="admin-textarea" placeholder="Description" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="admin-button" disabled={busy} onClick={() => post("/api/admin/songs", { action: selected ? "updateSong" : "createSong", song: form }, selected ? "Song updated." : "Song created.")}>{selected ? "Save Song" : "Create Song"}</button>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-head"><div><p>Catalog</p><h2>{(data.songs || []).length} songs</h2></div></div>
          <div className="admin-row-list">{(data.songs || []).map((song) => <article className="admin-row-card" key={song.id || song.slug}><div className="admin-row-title"><div><strong>{song.title || song.slug}</strong><small>{song.slug} · {song.audio_path || "No audio path"}</small></div><button className="admin-ghost-button" onClick={() => openEdit(song)}>Edit</button></div><div className="admin-pill-row"><span className="admin-pill blue">{song.source_app_slug || song.project_slug || "app"}</span><span className={`admin-pill ${song.is_shareable === false ? "warn" : "ok"}`}>{song.is_shareable === false ? "Not shareable" : "Shareable"}</span><span className="admin-pill">{song.status || "active"}</span></div></article>)}</div>
        </section>
      </section>
    );
  }

  function Accounts() {
    return (
      <section className="admin-section">
        <section className="admin-panel">
          <div className="admin-panel-head"><div><p>Account admin</p><h2>Create users, roles, Kiiku, access</h2></div></div>
          <div className="admin-form-grid">
            <input className="admin-input" placeholder="Email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="admin-input" placeholder="Username" value={form.username || ""} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <select className="admin-select" value={form.role || "user"} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="user">User</option><option value="admin">Admin</option><option value="owner">Owner</option></select>
          </div>
          <div className="admin-pill-row">
            <button className="admin-button" disabled={busy} onClick={() => post("/api/admin/accounts", { action: "createAccount", email: form.email, username: form.username, role: form.role }, "Account created.")}>Create account</button>
            <button className="admin-button gold" disabled={busy || !form.email} onClick={() => post("/api/admin/accounts", { action: "grantKiiku", email: form.email, amount: Number(form.kiikuAmount || 25), reason: form.reason || "Admin Kiiku grant" }, "Kiiku added.")}>Add Kiiku</button>
            <input className="admin-input" style={{ maxWidth: 150 }} placeholder="Kiiku" type="number" value={form.kiikuAmount || ""} onChange={(e) => setForm({ ...form, kiikuAmount: e.target.value })} />
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-head"><div><p>Users</p><h2>{(data.users || []).length} accounts</h2></div></div>
          <div className="admin-row-list">{(data.users || []).map((user) => <article className="admin-row-card" key={user.id || user.email}><div className="admin-row-title"><div><strong>{user.username || user.email}</strong><small>{user.email}</small></div><button className="admin-ghost-button" onClick={() => setForm({ ...form, email: user.email, username: user.username, role: user.role || "user" })}>Use</button></div><div className="admin-pill-row"><span className="admin-pill blue">{user.role || "user"}</span><span className="admin-pill">{user.status || "active"}</span><button className="admin-ghost-button" onClick={() => post("/api/admin/accounts", { action: "setRole", email: user.email, role: user.role === "admin" ? "user" : "admin" }, "Role updated.")}>{user.role === "admin" ? "Make user" : "Make admin"}</button></div></article>)}</div>
        </section>
      </section>
    );
  }

  function Experiences() {
    return (
      <section className="admin-section">
        <section className="admin-panel"><div className="admin-panel-head"><div><p>Apps and projects</p><h2>Experience control</h2></div></div><div className="admin-grid">{(data.projects || []).map((project) => <article className="admin-row-card" key={project.id || project.slug}><strong>{project.name || project.slug}</strong><span className="admin-muted">/{project.slug}</span><div className="admin-pill-row"><span className="admin-pill">{project.status || "active"}</span><button className="admin-ghost-button" onClick={() => post("/api/admin/experiences", { action: "toggleProjectStatus", projectId: project.id, status: project.status === "active" ? "draft" : "active" }, "Project updated.")}>{project.status === "active" ? "Set draft" : "Activate"}</button></div></article>)}</div></section>
        <section className="admin-panel"><div className="admin-panel-head"><div><p>Connected apps</p><h2>{(data.apps || []).length} app records</h2></div></div><div className="admin-row-list">{(data.apps || []).map((app) => <article className="admin-row-card" key={app.id || app.slug}><strong>{app.name || app.slug}</strong><span className="admin-muted">{app.slug}</span><div className="admin-pill-row"><span className="admin-pill blue">{app.status || "active"}</span></div></article>)}</div></section>
      </section>
    );
  }

  function Invites() {
    return <section className="admin-section"><section className="admin-panel"><div className="admin-panel-head"><div><p>Invite links</p><h2>Create access links</h2></div></div><div className="admin-form-grid"><input className="admin-input" placeholder="Invite name" value={form.inviteName || ""} onChange={(e) => setForm({ ...form, inviteName: e.target.value })} /><select className="admin-select" value={form.inviteRole || "user"} onChange={(e) => setForm({ ...form, inviteRole: e.target.value })}><option value="user">User</option><option value="admin">Admin</option></select><input className="admin-input" type="number" placeholder="Max uses" value={form.maxUses || ""} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} /></div><button className="admin-button" onClick={() => post("/api/admin/invites", { action: "createInvite", name: form.inviteName, role: form.inviteRole, maxUses: Number(form.maxUses || 1) }, "Invite created.")}>Create invite</button></section><section className="admin-panel"><div className="admin-row-list">{(data.invites || []).map((invite) => <article className="admin-row-card" key={invite.id || invite.token_hash}><strong>{invite.name || invite.invite_code || "Invite"}</strong><span className="admin-muted">/{invite.invite_code ? `invite/${invite.invite_code}` : "invite"}</span><div className="admin-pill-row"><span className="admin-pill">{invite.status || "active"}</span><span className="admin-pill blue">{invite.uses || 0}/{invite.max_uses || 1} uses</span></div></article>)}</div></section></section>;
  }

  function Blasts() {
    return <section className="admin-section"><section className="admin-panel"><div className="admin-panel-head"><div><p>Email blast</p><h2>Send to platform users</h2></div></div><input className="admin-input" placeholder="Subject" value={form.subject || ""} onChange={(e) => setForm({ ...form, subject: e.target.value })} /><textarea className="admin-textarea" placeholder="Message" value={form.body || ""} onChange={(e) => setForm({ ...form, body: e.target.value })} /><div className="admin-pill-row"><button className="admin-button" onClick={() => post("/api/admin/blasts", { action: "draftBlast", subject: form.subject, body: form.body }, "Blast draft saved.")}>Save draft</button><button className="admin-button gold" onClick={() => post("/api/admin/blasts", { action: "sendBlast", subject: form.subject, body: form.body }, "Blast queued or sent.")}>Send blast</button></div><p className="admin-muted">If EMAIL_PROVIDER_WEBHOOK_URL is configured, this sends through that provider. Otherwise it creates an auditable draft/queue record.</p></section><section className="admin-panel"><div className="admin-row-list">{(data.blasts || []).map((blast) => <article className="admin-row-card" key={blast.id || blast.subject}><strong>{blast.subject}</strong><span className="admin-muted">{blast.status || "draft"} · {fmtDate(blast.created_at)}</span></article>)}</div></section></section>;
  }

  return (
    <section className="admin-section">
      <div className="admin-tabs">{viewLabels.map(([key, text]) => <button key={key} className={view === key ? "active" : ""} onClick={() => { setView(key); setSelected(null); setForm({}); }}>{text}</button>)}</div>
      {status ? <div className="admin-status">{status}</div> : null}
      {view === "overview" ? <Overview /> : null}
      {view === "songs" ? <Songs /> : null}
      {view === "accounts" ? <Accounts /> : null}
      {view === "experiences" ? <Experiences /> : null}
      {view === "invites" ? <Invites /> : null}
      {view === "blasts" ? <Blasts /> : null}
    </section>
  );
}
