import { randomBytes } from "node:crypto";
import { MongoClient } from "mongodb";
import { config } from "../config.js";
type ConnectionSession = { client: MongoClient; expiresAt: number; host: string; timer: NodeJS.Timeout };
const sessions = new Map<string, ConnectionSession>();
function clearSession(id: string) { const session=sessions.get(id); if(!session)return; clearTimeout(session.timer); sessions.delete(id); void session.client.close().catch(()=>undefined); }
function scheduleExpiry(id:string,session:ConnectionSession) { clearTimeout(session.timer); session.expiresAt=Date.now()+config.SESSION_TTL_MINUTES*60_000; session.timer=setTimeout(()=>clearSession(id),config.SESSION_TTL_MINUTES*60_000); session.timer.unref(); }
export async function testMongoConnection(uri:string) {
  const client=new MongoClient(uri,{serverSelectionTimeoutMS:8000,connectTimeoutMS:8000,appName:"MongoJSON-Studio"});
  try { await client.connect(); await client.db("admin").command({ping:1}); return {success:true as const,host:client.options.hosts?.[0]?.host??"MongoDB Atlas"}; }
  finally { await client.close().catch(()=>undefined); }
}
export async function openSession(uri:string) {
  const client=new MongoClient(uri,{serverSelectionTimeoutMS:8000,connectTimeoutMS:8000,appName:"MongoJSON-Studio"});
  await client.connect();
  try { await client.db("admin").command({ping:1}); } catch(error) { await client.close(); throw error; }
  const id=randomBytes(32).toString("base64url");
  const session:ConnectionSession={client,host:client.options.hosts?.[0]?.host??"MongoDB Atlas",expiresAt:0,timer:setTimeout(()=>undefined,0)};
  scheduleExpiry(id,session); sessions.set(id,session);
  return {id,host:session.host,expiresAt:session.expiresAt};
}
export function getSession(id:string|undefined) { if(!id)return null; const session=sessions.get(id); if(!session)return null; if(session.expiresAt<=Date.now()){clearSession(id);return null;} scheduleExpiry(id,session); return session; }
export function disconnectSession(id:string|undefined) { if(id)clearSession(id); }
export async function closeAllSessions() { const all=[...sessions.values()]; for(const session of all)clearTimeout(session.timer); sessions.clear(); await Promise.allSettled(all.map(({client})=>client.close())); }
