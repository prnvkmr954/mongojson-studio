import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Database, FileJson, FileUp, History, LayoutDashboard, LoaderCircle, LockKeyhole, Menu, Plug, ShieldCheck, TriangleAlert, X } from "lucide-react";

type ApiStatus = "checking" | "online" | "offline";
type Notice = { kind: "success" | "error" | "info"; text: string } | null;
const steps = [
  { number: "01", title: "Connect", description: "Connect securely to Atlas" },
  { number: "02", title: "Destination", description: "Choose a database and collection" },
  { number: "03", title: "Import", description: "Preview and insert your JSON" },
];

export default function App() {
  const [page, setPage] = useState<"overview" | "import" | "history">("import");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [connectionString, setConnectionString] = useState("");
  const [showUri, setShowUri] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [sessionLabel, setSessionLabel] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/health").then((response) => {
      if (!response.ok) throw new Error("API is unavailable");
      return response.json() as Promise<{ status: string }>;
    }).then(() => active && setApiStatus("online")).catch(() => active && setApiStatus("offline"));
    return () => { active = false; };
  }, []);

  async function testConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setConnecting(true);
    try {
      const response = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });
      const result = await response.json() as { success?: boolean; message?: string; host?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "Could not connect to MongoDB Atlas.");
      setConnected(true);
      setSessionLabel(result.host || "Atlas cluster");
      setNotice({ kind: "success", text: "Connection verified. Your connection string is not saved." });
    } catch (error) {
      setConnected(false);
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Connection failed. Check the URI and try again." });
    } finally { setConnecting(false); }
  }

  function disconnect() {
    setConnected(false);
    setConnectionString("");
    setSessionLabel("");
    setNotice({ kind: "info", text: "Connection string cleared from the form. No persistent session was opened by this test." });
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("overview"); }}>
        <span className="brand-mark"><Database size={21} strokeWidth={2.4} /></span>
        <span className="brand-copy"><strong>MongoJSON</strong><small>STUDIO</small></span>
      </a>
      <div className="side-section-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Main navigation">
        <button className={page === "overview" ? "nav-item active" : "nav-item"} onClick={() => setPage("overview")}><LayoutDashboard size={18} /><span>Overview</span></button>
        <button className={page === "import" ? "nav-item active" : "nav-item"} onClick={() => setPage("import")}><FileUp size={18} /><span>Import JSON</span><span className="nav-count">01</span></button>
        <button className={page === "history" ? "nav-item active" : "nav-item"} onClick={() => setPage("history")}><History size={18} /><span>Import history</span></button>
      </nav>
      <div className="sidebar-bottom">
        <div className="side-section-label">CONNECTION</div>
        <div className="connection-state"><span className={connected ? "status-dot green" : "status-dot"} /><span>{connected ? "Connection verified" : "No active connection"}</span></div>
        {connected && <div className="session-host">{sessionLabel}</div>}
        <div className="sidebar-tip"><ShieldCheck size={17} /><span><strong>Private by design</strong><small>Credentials are never saved.</small></span></div>
        <div className="sidebar-footer"><span className={apiStatus === "online" ? "api-dot" : "status-dot"} /> API {apiStatus === "checking" ? "checking" : apiStatus === "online" ? "online" : "offline"} <span className="version">v0.1.0</span></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><ArrowRight size={14} /><strong>{page === "overview" ? "Overview" : page === "history" ? "Import history" : "Import JSON"}</strong></div>
        <div className="topbar-actions"><span className="environment"><span className="status-dot green" /> Local workspace</span><button className="icon-button" aria-label="Help" title="Help"><CircleHelp size={18} /></button><div className="avatar">MJ</div></div>
      </header>

      <div className="content">
        {page === "import" ? <>
          <div className="page-heading">
            <div><div className="eyebrow">DATA WORKSPACE <span>/</span> NEW IMPORT</div><h1>Import JSON</h1><p>Move your documents into MongoDB Atlas in a few simple steps.</p></div>
            <div className="heading-badge"><span className="live-pip" /> Guided workflow</div>
          </div>
          <div className="stepper" aria-label="Import progress">
            {steps.map((step, index) => {
              const done = index === 0 && connected;
              const current = index === (connected ? 1 : 0);
              return <div key={step.number} className={\`step \${current ? "current" : ""} \${done ? "done" : ""}\`}>
                <div className="step-number">{done ? <Check size={16} /> : step.number}</div>
                <div className="step-copy"><strong>{step.title}</strong><small>{step.description}</small></div>
                {index < steps.length - 1 && <div className="step-connector" />}
              </div>;
            })}
          </div>
          <div className="workspace-grid">
            <section className="panel connection-panel">
              <div className="panel-heading"><div className="panel-icon"><Plug size={19} /></div><div className="panel-title"><h2>Connect to Atlas</h2><p>Use a connection string from your Atlas cluster.</p></div>{connected && <span className="pill-success"><Check size={13} /> Verified</span>}</div>
              <form onSubmit={testConnection}>
                <label htmlFor="connection-string">MongoDB connection string <span className="required">*</span></label>
                <div className="input-wrap"><LockKeyhole size={17} className="input-leading" /><input id="connection-string" type={showUri ? "text" : "password"} autoComplete="off" spellCheck={false} placeholder="mongodb+srv://username:password@cluster..." value={connectionString} onChange={(event) => { setConnectionString(event.target.value); setConnected(false); setNotice(null); }} required minLength={12} aria-describedby="uri-help" /><button type="button" className="input-action" onClick={() => setShowUri(!showUri)}>{showUri ? "Hide" : "Show"}</button></div>
                <div id="uri-help" className="field-help"><LockKeyhole size={13} /> Used only for this test. Never stored in browser storage.</div>
                {notice && <div className={\`notice \${notice.kind}\`} role="status">{notice.kind === "error" ? <TriangleAlert size={16} /> : notice.kind === "success" ? <Check size={16} /> : <CircleHelp size={16} />}<span>{notice.text}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={14} /></button></div>}
                <div className="form-actions"><button type="submit" className="button-primary" disabled={connecting || !connectionString.trim()}>{connecting ? <><LoaderCircle className="spin" size={16} /> Testing connection…</> : <><Plug size={16} /> Test connection</>}</button>{connected && <button type="button" className="button-secondary" onClick={disconnect}>Clear connection</button>}</div>
              </form>
              <div className="connection-footnote"><ShieldCheck size={16} /><span><strong>Recommended:</strong> use a database user with only the permissions needed for your import.</span></div>
            </section>
            <aside className="panel next-panel">
              <div className="next-panel-heading"><div className="panel-icon muted"><Database size={18} /></div><div><h2>Next step</h2><p>Choose your destination</p></div></div>
              <div className={connected ? "destination-preview unlocked" : "destination-preview"}>
                <div className="preview-line"><span className="preview-glyph"><Database size={16} /></span><div><strong>Database</strong><small>Existing or create new</small></div><ChevronDown size={15} /></div>
                <div className="tree-branch" />
                <div className="preview-line"><span className="preview-glyph collection"><FileJson size={16} /></span><div><strong>Collection</strong><small>Existing or create new</small></div><ChevronDown size={15} /></div>
              </div>
              <div className="locked-note">{connected ? <Check size={15} /> : <LockKeyhole size={15} />}<span>{connected ? "Connection verified. Destination selection comes next." : "Test your connection to unlock destination selection."}</span></div>
              <button className="button-secondary full-width" disabled={!connected} onClick={() => setNotice({ kind: "info", text: "Destination selection is part of the next implementation milestone." })}>Continue to destination <ArrowRight size={15} /></button>
            </aside>
          </div>
          <section className="security-strip"><div className="security-icon"><ShieldCheck size={20} /></div><div><strong>Your database credentials stay yours</strong><p>The app uses your URI only for the current test. Disconnect when you finish. Never paste production credentials into an untrusted deployment.</p></div><div className="security-meta"><span><Check size={13} /> No saved profiles</span><span><Check size={13} /> TLS connection</span></div></section>
        </> : page === "overview" ? <div className="empty-page"><div className="large-icon"><LayoutDashboard size={28} /></div><div className="eyebrow">WORKSPACE</div><h1>Welcome to MongoJSON Studio</h1><p>Your guided workspace for importing JSON documents into MongoDB Atlas.</p><button className="button-primary" onClick={() => setPage("import")}><FileUp size={16} /> Start a new import</button><div className="overview-cards"><div className="mini-card"><Plug size={18} /><strong>Connect to Atlas</strong><span>Use a session-only connection</span></div><div className="mini-card"><FileJson size={18} /><strong>Preview JSON</strong><span>Validate before writing</span></div><div className="mini-card"><Database size={18} /><strong>Import documents</strong><span>See exactly what was inserted</span></div></div></div> : <div className="empty-page"><div className="large-icon"><Clock3 size={28} /></div><div className="eyebrow">WORKSPACE</div><h1>Import history</h1><p>Import results will be kept for the current session in a later milestone.</p><button className="button-secondary" onClick={() => setPage("import")}><FileUp size={16} /> Start an import</button></div>}
        <footer className="main-footer"><span>MongoJSON Studio <span className="footer-divider">·</span> Built for developers</span><span><span className="status-dot green" /> Your workflow, your data</span></footer>
      </div>
    </main>
    <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => document.body.classList.toggle("sidebar-open")}><Menu size={20} /></button>
    <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => document.body.classList.remove("sidebar-open")} />
  </div>;
}
