import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Database, FileJson, FileUp, History, LayoutDashboard, LoaderCircle, LockKeyhole, Menu, Plug, ShieldCheck, TriangleAlert, X } from "lucide-react";

type ApiStatus = "checking" | "online" | "offline";
type Notice = { kind: "success" | "error" | "info"; text: string } | null;
type JsonDocument = Record<string, unknown>;
const steps = [{ number: "01", title: "Connect", description: "Connect securely to Atlas" }, { number: "02", title: "Destination", description: "Choose a database and collection" }, { number: "03", title: "Import", description: "Preview and insert your JSON" }];

export default function App() {
  const [page, setPage] = useState<"overview" | "import" | "history">("import");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [connectionString, setConnectionString] = useState("");
  const [showUri, setShowUri] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [sessionLabel, setSessionLabel] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [databases, setDatabases] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [newDatabase, setNewDatabase] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [previewDocuments, setPreviewDocuments] = useState<JsonDocument[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{insertedCount:number;database:string;collection:string}|null>(null);
  const [backupMode, setBackupMode] = useState<"collection"|"database">("collection");
  const [backupFiles, setBackupFiles] = useState<File[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupResult, setBackupResult] = useState<{insertedCount:number;filesProcessed:number;collections:Array<{file:string;collection:string;insertedCount:number}>}|null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/health").then(response => { if (!response.ok) throw new Error("API unavailable"); return response.json() as Promise<{status:string}>; }).then(() => active && setApiStatus("online")).catch(() => active && setApiStatus("offline"));
    return () => { active = false; };
  }, []);

  async function testConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null); setConnecting(true);
    try {
      const response = await fetch("/api/connections/test", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({connectionString}) });
      const responseText = await response.text();
      let result: {success?:boolean; message?:string; host?:string} = {};
      if (responseText.trim()) {
        try { result = JSON.parse(responseText) as {success?:boolean; message?:string; host?:string}; }
        catch { throw new Error("The API returned an invalid response. Check the terminal running the server for startup errors, then restart with: npm run dev"); }
      } else {
        throw new Error("The API returned an empty response. Check that the backend is running at http://127.0.0.1:4000. Stop the terminal with Ctrl+C, then run: npm run dev");
      }
      if (!response.ok || !result.success) throw new Error(result.message || "Could not connect to MongoDB Atlas.");
      setConnected(true); setSessionLabel(result.host || "Atlas cluster"); setNotice({kind:"success",text:"Connection verified. Your connection string is not saved."});
    } catch (error) { setConnected(false); setNotice({kind:"error",text:error instanceof Error ? error.message : "Connection failed. Check the URI and try again."}); }
    finally { setConnecting(false); }
  }
  async function openDestination() {
    setNotice(null); setDestinationLoading(true);
    try {
      const opened = await fetch("/api/connections", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({connectionString}) });
      const openedResult = await opened.json() as {sessionId?:string;message?:string};
      if (!opened.ok || !openedResult.sessionId) throw new Error(openedResult.message || "Could not open a temporary Atlas session.");
      const activeSession = openedResult.sessionId; setSessionId(activeSession);
      const response = await fetch("/api/destinations/databases", {headers:{"X-Session-Id":activeSession}});
      const result = await response.json() as {databases?:string[];message?:string};
      if (!response.ok) throw new Error(result.message || "Could not load databases.");
      setDatabases(result.databases || []); setSelectedDatabase(""); setCollections([]); setSelectedCollection("");
      setNotice({kind:"success",text:"Temporary Atlas session opened. Choose or create a database below."});
    } catch (error) { setNotice({kind:"error",text:error instanceof Error ? error.message : "Could not load destinations."}); }
    finally { setDestinationLoading(false); }
  }
  async function loadCollections(database: string) {
    setSelectedDatabase(database); setSelectedCollection(""); setCollections([]);
    if (!database || !sessionId) return;
    try {
      const response = await fetch("/api/destinations/collections?database="+encodeURIComponent(database), {headers:{"X-Session-Id":sessionId}});
      const result = await response.json() as {collections?:string[];message?:string};
      if (!response.ok) throw new Error(result.message || "Could not load collections.");
      setCollections(result.collections || []);
    } catch (error) { setNotice({kind:"error",text:error instanceof Error ? error.message : "Could not load collections."}); }
  }
  async function createDatabase() {
    const name = newDatabase.trim(); if (!name || !sessionId) return;
    try {
      const response = await fetch("/api/destinations/databases", {method:"POST",headers:{"Content-Type":"application/json","X-Session-Id":sessionId},body:JSON.stringify({database:name})});
      const result = await response.json() as {message?:string};
      if (!response.ok) throw new Error(result.message || "Could not create database.");
      setDatabases(items=>[...new Set([...items,name])].sort()); setSelectedDatabase(name); setNewDatabase(""); setCollections([]);
      setNotice({kind:"success",text:"Database prepared. Create a collection to persist it in MongoDB."});
    } catch (error) { setNotice({kind:"error",text:error instanceof Error ? error.message : "Could not create database."}); }
  }
  async function createCollection() {
    const name = newCollection.trim(); if (!name || !selectedDatabase || !sessionId) return;
    try {
      const response = await fetch("/api/destinations/collections", {method:"POST",headers:{"Content-Type":"application/json","X-Session-Id":sessionId},body:JSON.stringify({database:selectedDatabase,collection:name})});
      const result = await response.json() as {message?:string};
      if (!response.ok) throw new Error(result.message || "Could not create collection.");
      setCollections(items=>[...new Set([...items,name])].sort()); setSelectedCollection(name); setNewCollection("");
      setNotice({kind:"success",text:"Collection created. JSON upload and insertion are not implemented yet."});
    } catch (error) { setNotice({kind:"error",text:error instanceof Error ? error.message : "Could not create collection."}); }
  }
  async function readJsonFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setNotice(null); setImportResult(null); setPreviewDocuments([]); setSelectedFileName("");
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than 10 MB. Choose a smaller JSON file.");
      const parsed: unknown = JSON.parse(await file.text());
      const docs = Array.isArray(parsed) ? parsed : [parsed];
      if (!docs.length) throw new Error("The JSON file contains no documents.");
      if (!docs.every(item => item !== null && typeof item === "object" && !Array.isArray(item))) throw new Error("JSON must be an object or an array of objects.");
      setPreviewDocuments(docs as JsonDocument[]); setSelectedFileName(file.name);
      setNotice({kind:"success",text:"JSON parsed successfully. Review the preview before importing."});
    } catch (error) { setNotice({kind:"error",text:error instanceof Error ? error.message : "Could not read JSON file."}); event.target.value = ""; }
  }
  async function importDocuments() {
    if (!sessionId || !selectedDatabase || !selectedCollection || !previewDocuments.length) return;
    setImporting(true); setNotice(null); setImportResult(null);
    try {
      const response = await fetch("/api/imports", {method:"POST",headers:{"Content-Type":"application/json","X-Session-Id":sessionId},body:JSON.stringify({database:selectedDatabase,collection:selectedCollection,documents:previewDocuments})});
      const result = await response.json() as {insertedCount?:number;message?:string};
      if (!response.ok) throw new Error(result.message || "Import failed.");
      setImportResult({insertedCount:result.insertedCount || 0,database:selectedDatabase,collection:selectedCollection});
      setNotice({kind:"success",text:"Import completed successfully."});
    } catch (error) { setNotice({kind:"error",text:error instanceof Error ? error.message : "Import failed."}); }
    finally { setImporting(false); }
  }
  async function importBackupFiles() {
    if (!sessionId || !selectedDatabase || !backupFiles.length || (backupMode === "collection" && !selectedCollection)) return;
    setBackupBusy(true); setBackupResult(null); setNotice(null);
    try {
      const form = new FormData(); form.append("database", selectedDatabase); form.append("mode", backupMode);
      if (backupMode === "collection") form.append("collection", selectedCollection);
      backupFiles.forEach(file => form.append("files", file, file.name));
      const response = await fetch("/api/imports/backup", {method:"POST",headers:{"X-Session-Id":sessionId},body:form});
      const result = await response.json() as {insertedCount?:number;filesProcessed?:number;collections?:Array<{file:string;collection:string;insertedCount:number}>;message?:string;partialResults?:Array<{file:string;collection:string;insertedCount:number}>};
      if (!response.ok) throw new Error((result.message || "Backup import failed.") + (result.partialResults?.length ? " Partial progress: " + result.partialResults.map(item => item.collection + ": " + item.insertedCount).join(", ") : ""));
      setBackupResult({insertedCount:result.insertedCount||0,filesProcessed:result.filesProcessed||0,collections:result.collections||[]});
      setNotice({kind:"success",text:"Backup import completed: "+(result.insertedCount||0)+" documents across "+(result.filesProcessed||0)+" file(s)."});
    } catch (error) { setNotice({kind:"error",text:error instanceof Error ? error.message : "Backup import failed."}); }
    finally { setBackupBusy(false); }
  }
  async function disconnect() {
    if (sessionId) await fetch("/api/connections/current", {method:"DELETE",headers:{"X-Session-Id":sessionId}}).catch(()=>undefined);
    setSessionId(""); setDatabases([]); setCollections([]); setSelectedDatabase(""); setSelectedCollection("");
    setConnected(false); setConnectionString(""); setSessionLabel("");
    setNotice({kind:"info",text:"Connection cleared and temporary Atlas session closed."});
  }
  const cls = (...values: Array<string | false>) => values.filter(Boolean).join(" ");

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={event => {event.preventDefault();setPage("overview");}}><span className="brand-mark"><Database size={21} strokeWidth={2.4}/></span><span className="brand-copy"><strong>MongoJSON</strong><small>STUDIO</small></span></a>
      <div className="side-section-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Main navigation">
        <button className={cls("nav-item",page === "overview" && "active")} onClick={()=>setPage("overview")}><LayoutDashboard size={18}/><span>Overview</span></button>
        <button className={cls("nav-item",page === "import" && "active")} onClick={()=>setPage("import")}><FileUp size={18}/><span>Import JSON</span><span className="nav-count">01</span></button>
        <button className={cls("nav-item",page === "history" && "active")} onClick={()=>setPage("history")}><History size={18}/><span>Import history</span></button>
      </nav>
      <div className="sidebar-bottom"><div className="side-section-label">CONNECTION</div><div className="connection-state"><span className={cls("status-dot",connected && "green")}/><span>{connected ? "Connection verified" : "No active connection"}</span></div>{connected && <div className="session-host">{sessionLabel}</div>}<div className="sidebar-tip"><ShieldCheck size={17}/><span><strong>Private by design</strong><small>Credentials are never saved.</small></span></div><div className="sidebar-footer"><span className={apiStatus === "online" ? "api-dot" : "status-dot"}/> API {apiStatus === "checking" ? "checking" : apiStatus === "online" ? "online" : "offline"}<span className="version">v0.1.0</span></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ArrowRight size={14}/><strong>{page === "overview" ? "Overview" : page === "history" ? "Import history" : "Import JSON"}</strong></div><div className="topbar-actions"><span className="environment"><span className="status-dot green"/> Local workspace</span><button className="icon-button" aria-label="Help" title="Help"><CircleHelp size={18}/></button><div className="avatar">MJ</div></div></header>
      <div className="content">
        {page === "import" ? <>
          <div className="page-heading"><div><div className="eyebrow">DATA WORKSPACE <span>/</span> NEW IMPORT</div><h1>Import JSON</h1><p>Move your documents into MongoDB Atlas in a few simple steps.</p></div><div className="heading-badge"><span className="live-pip"/> Guided workflow</div></div>
          <div className="stepper" aria-label="Import progress">{steps.map((step,index)=>{const destinationReady=Boolean(selectedDatabase&&selectedCollection);const done=(index===0&&connected)||(index===1&&destinationReady);const activeStep=destinationReady?2:connected?1:0;const current=index===activeStep;return <div key={step.number} className={cls("step",current&&"current",done&&"done")} aria-current={current?"step":undefined}><div className="step-number">{done?<Check size={16}/>:step.number}</div><div className="step-copy"><strong>{step.title}</strong><small>{step.description}</small></div>{index<steps.length-1&&<div className="step-connector"/>}</div>;})}</div>
          <div className="workspace-grid">
            <section className="panel connection-panel"><div className="panel-heading"><div className="panel-icon"><Plug size={19}/></div><div className="panel-title"><h2>Connect to Atlas</h2><p>Use a connection string from your Atlas cluster.</p></div>{connected&&<span className="pill-success"><Check size={13}/> Verified</span>}</div>
              <form onSubmit={testConnection}><label htmlFor="connection-string">MongoDB connection string <span className="required">*</span></label><div className="input-wrap"><LockKeyhole size={17} className="input-leading"/><input id="connection-string" type={showUri?"text":"password"} autoComplete="off" spellCheck={false} placeholder="mongodb+srv://username:password@cluster..." value={connectionString} onChange={event=>{setConnectionString(event.target.value);setConnected(false);setNotice(null);}} required minLength={12} aria-describedby="uri-help"/><button type="button" className="input-action" onClick={()=>setShowUri(!showUri)}>{showUri?"Hide":"Show"}</button></div>
              <div id="uri-help" className="field-help"><LockKeyhole size={13}/> Used only for this test. Never stored in browser storage.</div>
              {notice&&<div className={cls("notice",notice.kind)} role="status">{notice.kind==="error"?<TriangleAlert size={16}/>:notice.kind==="success"?<Check size={16}/>:<CircleHelp size={16}/>}<span>{notice.text}</span><button type="button" aria-label="Dismiss message" onClick={()=>setNotice(null)}><X size={14}/></button></div>}
              <div className="form-actions"><button type="submit" className="button-primary" disabled={connecting||!connectionString.trim()}>{connecting?<><LoaderCircle className="spin" size={16}/> Testing connection…</>:<><Plug size={16}/> Test connection</>}</button>{connected&&<button type="button" className="button-secondary" onClick={disconnect}>Clear connection</button>}</div></form>
              <div className="connection-footnote"><ShieldCheck size={16}/><span><strong>Recommended:</strong> use a database user with only the permissions needed for your import.</span></div>
            </section>
            <aside className="panel next-panel"><div className="next-panel-heading"><div className="panel-icon muted"><Database size={18}/></div><div><h2>Next step</h2><p>Choose your destination</p></div></div>
              {!sessionId ? <><div className={cls("destination-preview",connected&&"unlocked")}><div className="preview-line"><span className="preview-glyph"><Database size={16}/></span><div><strong>Database</strong><small>Load existing or create new</small></div><ChevronDown size={15}/></div><div className="tree-branch"/><div className="preview-line"><span className="preview-glyph collection"><FileJson size={16}/></span><div><strong>Collection</strong><small>Load existing or create new</small></div><ChevronDown size={15}/></div></div><div className="locked-note">{connected?<Check size={15}/>:<LockKeyhole size={15}/>}<span>{connected?"Connection verified. Open a temporary session to load destinations.":"Test your connection to unlock destination selection."}</span></div><button className="button-secondary full-width" disabled={!connected||destinationLoading} onClick={openDestination}>{destinationLoading?<><LoaderCircle className="spin" size={15}/> Loading destinations…</> : <>Continue to destination <ArrowRight size={15}/></>}</button></> : <div className="destination-controls"><label htmlFor="database-select">Database</label><select id="database-select" value={selectedDatabase} onChange={event=>loadCollections(event.target.value)}><option value="">Choose database…</option>{databases.map(name=><option key={name} value={name}>{name}</option>)}</select><div className="create-row"><input aria-label="New database name" placeholder="New database name" value={newDatabase} onChange={event=>setNewDatabase(event.target.value)}/><button className="button-secondary" onClick={createDatabase} disabled={!newDatabase.trim()}>Create</button></div><label htmlFor="collection-select">Collection</label><select id="collection-select" value={selectedCollection} onChange={event=>setSelectedCollection(event.target.value)} disabled={!selectedDatabase}><option value="">Choose collection…</option>{collections.map(name=><option key={name} value={name}>{name}</option>)}</select><div className="create-row"><input aria-label="New collection name" placeholder="New collection name" value={newCollection} onChange={event=>setNewCollection(event.target.value)}/><button className="button-secondary" onClick={createCollection} disabled={!selectedDatabase||!newCollection.trim()}>Create</button></div><div className="locked-note"><Check size={15}/><span>{selectedDatabase&&selectedCollection?"Destination selected: "+selectedDatabase+"."+selectedCollection:"Select or create a database and collection."}</span></div>{selectedDatabase&&selectedCollection&&<div className="import-section"><label htmlFor="json-file">JSON file</label><input id="json-file" type="file" accept=".json,application/json" onChange={readJsonFile}/><small>Accepts a JSON object or an array of objects (max 10 MB).</small>{selectedFileName&&<div className="file-summary"><FileJson size={16}/><span>{selectedFileName}</span><strong>{previewDocuments.length} document{previewDocuments.length===1?"":"s"}</strong></div>}{previewDocuments.length>0&&<><div className="preview-heading">Preview (first {Math.min(5,previewDocuments.length)} of {previewDocuments.length})</div><pre className="json-preview">{JSON.stringify(previewDocuments.slice(0,5),null,2)}</pre><button className="button-primary full-width" disabled={importing} onClick={importDocuments}>{importing?<><LoaderCircle className="spin" size={15}/> Importing…</>:<><FileUp size={15}/> Import {previewDocuments.length} document{previewDocuments.length===1?"":"s"}</>}</button></>}{importResult&&<div className="import-result"><Check size={16}/><span>Inserted {importResult.insertedCount} documents into <strong>{importResult.database}.{importResult.collection}</strong>.</span></div>}</div>}<div className="backup-section"><div className="preview-heading">Collection / database backup</div><label htmlFor="backup-mode">Backup scope</label><select id="backup-mode" value={backupMode} onChange={event=>setBackupMode(event.target.value as "collection"|"database")}><option value="collection">Import files into selected collection</option><option value="database">Import multiple files as a database backup</option></select><label htmlFor="backup-files">Backup files (.json or .bson)</label><input id="backup-files" type="file" accept=".json,.bson,application/json,application/octet-stream" multiple onChange={event=>{setBackupFiles(Array.from(event.target.files||[]));setBackupResult(null);}}/><small>{backupMode==="collection"?"All selected files are inserted into "+selectedCollection+".":"Each file becomes a collection named after its filename (for example orders.bson → orders). Select the .json/.bson files from your dump folder."} Max 100 files, each up to 10 MB by default.</small>{backupFiles.length>0&&<div className="file-summary"><FileJson size={16}/><span>{backupFiles.length} backup file(s) selected</span></div>}<button className="button-secondary full-width" disabled={backupBusy||!backupFiles.length||(backupMode==="collection"&&!selectedCollection)} onClick={importBackupFiles}>{backupBusy?<><LoaderCircle className="spin" size={15}/> Importing backup…</>:<><FileUp size={15}/> Import backup files</>}</button>{backupResult&&<div className="import-result"><Check size={16}/><span>Imported {backupResult.insertedCount} documents from {backupResult.filesProcessed} files. {backupResult.collections.map(item=>item.collection+": "+item.insertedCount).join("; ")}</span></div>}<small>Supports plain JSON and concatenated BSON collection dump files. ZIP and mongodump .archive files, indexes, and collection options are not supported yet.</small></div><button className="button-secondary full-width" onClick={disconnect}>Close Atlas session</button></div>}
            </aside>
          </div>
          <section className="security-strip"><div className="security-icon"><ShieldCheck size={20}/></div><div><strong>Your database credentials stay yours</strong><p>The app uses your URI only for the current test. Disconnect when you finish. Never paste production credentials into an untrusted deployment.</p></div><div className="security-meta"><span><Check size={13}/> No saved profiles</span><span><Check size={13}/> TLS connection</span></div></section>
        </> : page === "overview" ? <div className="empty-page"><div className="large-icon"><LayoutDashboard size={28}/></div><div className="eyebrow">WORKSPACE</div><h1>Welcome to MongoJSON Studio</h1><p>Your guided workspace for importing JSON documents into MongoDB Atlas.</p><button className="button-primary" onClick={()=>setPage("import")}><FileUp size={16}/> Start a new import</button><div className="overview-cards"><div className="mini-card"><Plug size={18}/><strong>Connect to Atlas</strong><span>Use a session-only connection</span></div><div className="mini-card"><FileJson size={18}/><strong>Preview JSON</strong><span>Validate before writing</span></div><div className="mini-card"><Database size={18}/><strong>Import documents</strong><span>See exactly what was inserted</span></div></div></div> : <div className="empty-page"><div className="large-icon"><Clock3 size={28}/></div><div className="eyebrow">WORKSPACE</div><h1>Import history</h1><p>Import results will be kept for the current session in a later milestone.</p><button className="button-secondary" onClick={()=>setPage("import")}><FileUp size={16}/> Start an import</button></div>}
        <footer className="main-footer"><span>MongoJSON Studio <span className="footer-divider">·</span> Built for developers</span><span><span className="status-dot green"/> Your workflow, your data</span></footer>
      </div>
    </main>
    <button className="mobile-menu" aria-label="Toggle navigation" onClick={()=>document.body.classList.toggle("sidebar-open")}><Menu size={20}/></button><button className="sidebar-backdrop" aria-label="Close navigation" onClick={()=>document.body.classList.remove("sidebar-open")}/>
  </div>;
}
