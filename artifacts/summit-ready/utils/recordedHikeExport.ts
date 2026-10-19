import { Platform, Share } from "react-native";
import * as Linking from "expo-linking";
import { activityApiBase } from "./activityAudience";
import { cacheDirectory, writeAsStringAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { hasRecordedRoute } from "./recordedHikePresentation";
const escape = (v: string) => v.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" })[c]!);
export function recordedGpx(hike: { name: string; trackPoints?: Array<{ lat:number;lon:number;alt?:number|null;ts?:number }> }) {
  const points = (hike.trackPoints ?? []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (!hasRecordedRoute(points)) throw new Error("This activity has no recorded route to export.");
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="SummitReady" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${escape(hike.name)}</name><trkseg>${points.map(p=>`<trkpt lat="${p.lat}" lon="${p.lon}">${p.alt!=null&&Number.isFinite(p.alt)?`<ele>${p.alt}</ele>`:""}${p.ts!=null&&Number.isFinite(p.ts)?`<time>${new Date(p.ts).toISOString()}</time>`:""}</trkpt>`).join("")}</trkseg></trk></gpx>`;
}
export async function exportRecordedGpx(hike: Parameters<typeof recordedGpx>[0]) {
  const xml=recordedGpx(hike);
  if (Platform.OS==="web") {
    const url=URL.createObjectURL(new Blob([xml],{type:"application/gpx+xml"}));
    const a=document.createElement("a"); a.href=url; a.download="summitready-recording.gpx"; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000); return;
  }
  if (!cacheDirectory || !await Sharing.isAvailableAsync()) throw new Error("File sharing is unavailable on this device.");
  const path=`${cacheDirectory}summitready-recording-${Date.now()}.gpx`;
  await writeAsStringAsync(path,xml);
  await Sharing.shareAsync(path,{mimeType:"application/gpx+xml",UTI:"public.xml"});
}
export async function shareRecordedRoute(owner:string,hikeId:string,getToken:()=>Promise<string|null>) {
  const token=await getToken();if(!token)throw new Error("Sign in to share this route.");
  const response=await fetch(`${activityApiBase}/activity-community/${encodeURIComponent(owner)}/${encodeURIComponent(hikeId)}`,{headers:{Authorization:`Bearer ${token}`}});
  if(!response.ok)throw new Error("This route is not available to share. Sync your recording or check its audience.");
  const shared=await response.json() as {route?:{audience?:string}};
  if(!["public","followers"].includes(shared.route?.audience??""))throw new Error("Choose Public or Followers before sending a member-route link. Your own GPX export is still available.");
  // The installed app re-fetches under the recipient's identity. No GPS data
  // or authentication token is embedded in this revocable reference.
  const url=Platform.OS==="web"?new URL(`./community-route?owner=${encodeURIComponent(owner)}&hikeId=${encodeURIComponent(hikeId)}`,window.location.href).href:
    Linking.createURL("community-route",{scheme:"summit-ready",queryParams:{owner,hikeId}});
  return Share.share({message:`SummitReady member route (sign-in required): ${url}`});
}
