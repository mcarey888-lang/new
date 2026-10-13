import React, { useEffect, useState, useRef } from "react";
import { View,Text,ScrollView,Pressable,TextInput,ActivityIndicator,AppState } from "react-native";
import { router,useLocalSearchParams,useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/expo";
import { getActivityRoute,actOnRecordedActivityRoute,followActivityAuthor,unfollowActivityAuthor,type ActivityCommunityRoute } from "@workspace/api-client-react";
import { authenticatedHeaders } from "@/utils/authRequest";
import { RecordedTracePreview } from "@/components/track/RecordedTracePreview";
import { TrackMap,type TrackMapHandle } from "@/components/track/TrackMap";
import { shareRecordedRoute } from "@/utils/recordedHikeExport";
import { BASECAMP } from "@/constants/tokens";
import { SRScreenHeader } from "@/components/ui";
import { RecordingElevationSpark } from "@/components/track/RecordingElevationSpark";

export default function CommunityRouteDetail() {
  const {owner,hikeId}=useLocalSearchParams<{owner:string;hikeId:string}>();
  const {userId,getToken}=useAuth();
  const [route,setRoute]=useState<ActivityCommunityRoute|null>(null),[followed,setFollowed]=useState(false);
  const [error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null),[reason,setReason]=useState("");
  const [attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false),[basemap,setBasemap]=useState(false);
  useFocusEffect(React.useCallback(()=>{
    setAttempt(a=>a+1);
    return()=>{setRoute(null);setBasemap(false);};
  },[owner,hikeId,userId]));
  useEffect(()=>{
    const sub=AppState.addEventListener("change",state=>{
      setRoute(null);setBasemap(false);
      if(state==="active")setAttempt(a=>a+1);
    });
    const timer=setInterval(()=>{setRoute(null);setBasemap(false);setAttempt(a=>a+1);},60_000);
    return()=>{sub.remove();clearInterval(timer);};
  },[]);
  const mapRef=useRef<TrackMapHandle|null>(null);
  useEffect(()=>{
    let active=true;setRoute(null);setError(null);
    void (async()=>{if(!userId)throw new Error("Sign in to view this member route.");
      const token=await getToken({skipCache:true});
      const result=await getActivityRoute(owner,hikeId,{headers:authenticatedHeaders(token)});
      if(active){setRoute(result.route);setFollowed(result.followed);}
    })().catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[owner,hikeId,userId,getToken,attempt]);
  async function action(kind:"save"|"unsave"|"report"|"suggest") {
    if(busy)return;setBusy(true);setError(null);
    try{
      const token=await getToken({skipCache:true}); if(!token)throw new Error("Sign in again to continue.");
      await actOnRecordedActivityRoute(owner,hikeId,{action:kind,...(kind==="report"?{reason}:{})},{headers:authenticatedHeaders(token)});
      setMessage(kind==="suggest"?"Suggested for trail review · pending, not approved or verified":kind==="report"?"Reported and hidden from your discovery feed":kind==="save"?"Route reference saved. No hike was recorded or credited.":"Route reference removed.");
    }catch(e){setRoute(null);setBasemap(false);setError(e instanceof Error?e.message:"This action could not be completed.");}finally{setBusy(false);}
  }
  const points=(route?.snapshot.trackPoints??[]) as Array<{lat:number;lon:number}>;
  const button=(label:string,onPress:()=>void)=><Pressable accessibilityRole="button" disabled={busy}
    onPress={onPress} style={{padding:14,minHeight:48,borderWidth:1,borderColor:BASECAMP.panelBorder,borderRadius:8}}>
    <Text style={{color:BASECAMP.accent}}>{label}</Text></Pressable>;
  return <ScrollView style={{flex:1,backgroundColor:BASECAMP.ink}} contentContainerStyle={{paddingTop:48,paddingBottom:80,paddingHorizontal:16,gap:14}}>
    <SRScreenHeader title="Member route" onBack={()=>router.canGoBack()?router.back():router.replace("/community-routes" as never)} />
    {!route&&!error?<ActivityIndicator color={BASECAMP.accent}/>:null}
    {error?<><Text accessibilityRole="alert" style={{color:BASECAMP.textStrong}}>{error}</Text>{button("Retry",()=>setAttempt(a=>a+1))}</>:null}
    {message?<Text accessibilityRole="alert" style={{color:BASECAMP.textStrong}}>{message}</Text>:null}
    {route?<><Text style={{color:BASECAMP.textStrong,fontSize:26}}>{route.snapshot.name}</Text>
      <Text style={{color:BASECAMP.textMuted}}>{route.author.name} · {route.snapshot.distance} km · {route.snapshot.elevationGain} m recorded ascent · {route.snapshot.timeTaken} min recording time</Text>
      <Text style={{color:BASECAMP.textMuted}}>Member recording, not a verified trail. {route.snapshot.date}</Text>
      {points.length>1?<RecordedTracePreview points={points}/>:<Text style={{color:BASECAMP.textMuted}}>No GPS route was recorded.</Text>}
      <Text style={{color:BASECAMP.textMuted}}>Recorded altitude profile · GPS readings, not a verified trail survey</Text>
      <RecordingElevationSpark samples={(route.snapshot.trackPoints??[]).flatMap(point=>
        typeof point.ts==="number" && Number.isFinite(point.ts) ? [{ts:point.ts,alt:point.alt??null}] : [])} />
      {points.length>1?button(basemap?"Hide online map":"View on online map",()=>setBasemap(v=>!v)):null}
      {basemap?<View style={{height:340}}><TrackMap mapRef={mapRef} recording={false} onMessage={msg=>{
        if(msg.type==="ready"){mapRef.current?.send({type:"recPlanned",points:points.map(p=>[p.lat,p.lon])});mapRef.current?.send({type:"locate",lat:points[0].lat,lng:points[0].lon,zoom:13});}
      }}/></View>:null}
      <Text style={{color:BASECAMP.textMuted}}>{route.snapshot.notes}</Text>
      {button("Save route reference",()=>void action("save"))}{button("Remove saved reference",()=>void action("unsave"))}
      {points.length>1?button("Follow route · new recording, no automatic completion",()=>router.push({pathname:"/hike-tracking",params:{trackingMode:"freehike",referenceRouteId:hikeId,communityOwner:owner,referenceRouteName:route.snapshot.name,autoStart:"1"}} as never)):null}
      {button("Share member-access link",()=>void shareRecordedRoute(owner,hikeId,()=>getToken({skipCache:true})).catch(e=>setError(e.message)))}
      {owner!==userId?button(followed?"Unfollow walker":"Follow walker",()=>{
        void (async()=>{const token=await getToken({skipCache:true});if(!token)throw new Error("Sign in again.");
          if(followed)await unfollowActivityAuthor(owner,{headers:authenticatedHeaders(token)});
          else await followActivityAuthor(owner,{headers:authenticatedHeaders(token)});
          setFollowed(!followed);
        })().catch(e=>setError(e.message));
      }):null}
      {owner===userId?button("Suggest this original route as a trail",()=>void action("suggest")):<>
        <TextInput accessibilityLabel="Reason for reporting this route" value={reason} onChangeText={setReason}
          placeholder="Report reason" placeholderTextColor={BASECAMP.textMuted} style={{minHeight:48,padding:12,color:BASECAMP.textStrong}}/>
        {button("Report route",()=>void action("report"))}</>}
    </>:null}
  </ScrollView>;
}
