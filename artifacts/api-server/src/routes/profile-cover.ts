import express, { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, activityPreferences } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import rateLimit from "express-rate-limit";
import { ObjectStorageService, objectStorageClient } from "../lib/objectStorage";
import { requireAuth } from "../middlewares/requireAuth";
import { privateObjectLocation, deleteCommunityPhoto } from "./community";
const router = Router();
const path="/activity-community/profile-cover";
const storage = new ObjectStorageService();
router.use(path,requireAuth({json:true}));
router.get(path,async(req,res)=>{
  const owner=getAuth(req).userId!;
  res.setHeader("Cache-Control","private, no-store");
  try{
    const [row]=await db.select().from(activityPreferences).where(eq(activityPreferences.owner,owner)).limit(1);
    if(!row?.coverPath){res.status(404).end();return;}
    const location=privateObjectLocation(row.coverPath);
    const [bytes]=await objectStorageClient.bucket(location.bucketName).file(location.objectName).download();
    res.type("image/webp").send(bytes);
  }catch(error){req.log.error({error},"Profile cover read failed");res.status(503).json({error:"Your cover could not be loaded"});}
});
router.put(path,rateLimit({windowMs:3600_000,limit:20,standardHeaders:true,legacyHeaders:false}),
  express.raw({type:["image/jpeg","image/png","image/webp"],limit:"5mb"}),async(req,res)=>{
    const owner=getAuth(req).userId!;
    if(!Buffer.isBuffer(req.body)||!req.body.length){res.status(400).json({error:"Choose a JPEG, PNG or WebP image under 5 MB"});return;}
    let newPath:string|null=null;
    try{
      const decoded=await sharp(req.body,{limitInputPixels:24_000_000}).rotate()
        .resize({width:1600,height:900,fit:"cover",withoutEnlargement:true}).webp({quality:82}).toBuffer();
      newPath=`${storage.getPrivateObjectDir().replace(/\/+$/,"")}/profile-covers/${owner}/${randomUUID()}.webp`;
      const location=privateObjectLocation(newPath);
      await objectStorageClient.bucket(location.bucketName).file(location.objectName).save(decoded,
        {metadata:{contentType:"image/webp"},resumable:false});
      const [previous]=await db.select().from(activityPreferences).where(eq(activityPreferences.owner,owner)).limit(1);
      await db.insert(activityPreferences).values({owner,coverPath:newPath}).onConflictDoUpdate({
        target:activityPreferences.owner,set:{coverPath:newPath},
      });
      if(previous?.coverPath) void deleteCommunityPhoto(previous.coverPath).catch(error=>req.log.warn({error},"Old profile cover cleanup pending"));
      res.setHeader("Cache-Control","private, no-store");res.json({ok:true});
    }catch(error){
      if(newPath)void deleteCommunityPhoto(newPath).catch(()=>{});
      req.log.error({error},"Profile cover upload failed");
      res.status(400).json({error:"Your cover could not be uploaded. Keep the selected image and retry."});
    }
  });
export default router;
