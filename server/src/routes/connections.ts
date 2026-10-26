import { Router } from "express";
import { z } from "zod";
import { disconnectSession, openSession, testMongoConnection } from "../services/session.service.js";
export const connectionRouter=Router();
const uriSchema=z.string().trim().min(12).max(2048).refine(value=>value.startsWith("mongodb://")||value.startsWith("mongodb+srv://"),"Enter a MongoDB connection string beginning with mongodb:// or mongodb+srv://.");
const bodySchema=z.object({connectionString:uriSchema});
const sessionHeaderSchema=z.string().min(20).max(128).optional();
function safeError(error:unknown) {
  if(error instanceof Error&&/authentication failed|bad auth/i.test(error.message))return "Authentication failed. Check the database username and password.";
  if(error instanceof Error&&/ENOTFOUND|ECONNREFUSED|server selection|timed out/i.test(error.message))return "Could not reach the cluster. Check the cluster address, network access list, and try again.";
  return "Connection failed. Verify the URI, database user permissions, and Atlas network access settings.";
}
connectionRouter.post("/test",async(request,response)=>{
 const parsed=bodySchema.safeParse(request.body);
 if(!parsed.success){response.status(400).json({success:false,message:parsed.error.issues[0]?.message??"Invalid request."});return;}
 try{response.json(await testMongoConnection(parsed.data.connectionString));}catch(error){response.status(400).json({success:false,message:safeError(error)});}
});
connectionRouter.post("/",async(request,response)=>{
 const parsed=bodySchema.safeParse(request.body);
 if(!parsed.success){response.status(400).json({message:parsed.error.issues[0]?.message??"Invalid request."});return;}
 try{const session=await openSession(parsed.data.connectionString);response.status(201).json({sessionId:session.id,host:session.host,expiresAt:new Date(session.expiresAt).toISOString()});}catch(error){response.status(400).json({message:safeError(error)});}
});
connectionRouter.delete("/current",(request,response)=>{
 const parsed=sessionHeaderSchema.safeParse(request.header("X-Session-Id"));
 if(!parsed.success){response.status(400).json({message:"Invalid session identifier."});return;}
 disconnectSession(parsed.data);response.status(204).end();
});
