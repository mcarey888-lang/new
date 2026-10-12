import React, { useEffect, useState,useRef } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@clerk/expo";
import * as Location from "expo-location";
import { getActivityRoutes, type ActivityCommunityRoute } from "@workspace/api-client-react";
import { authenticatedHeaders,tokenBelongsToUser } from "@/utils/authRequest";
import { BASECAMP } from "@/constants/tokens";

export function CommunityRecordingLibrary({ saved=false }: { saved?: boolean }) {
  const { userId, getToken }=useAuth();
  const tokenRef=useRef(getToken);tokenRef.current=getToken;
  const ownerRef=useRef(userId);ownerRef.current=userId;
  const [query,setQuery]=useState(""), [page,setPage]=useState(0), [attempt,setAttempt]=useState(0);
  const [nearby,setNearby]=useState<{lat:number;lng:number}|null>(null);
  const [dataRaw,setData]=useState<ActivityCommunityRoute[]>([]),[more,setMore]=useState(false);
  const [dataOwner,setDataOwner]=useState<string|null>(null);
  const data=dataOwner===userId?dataRaw:[];
  const [loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
  useEffect(()=>{setPage(0);setData([]);setMore(false);setNearby(null);},[userId]);
  useEffect(()=>{
    let active=true; setLoading(true);setError(null);
    if (page===0) setData([]);
    const timer=setTimeout(()=>void (async()=>{
      if(!userId) throw new Error("Sign in to discover member recordings.");
      const token=await tokenRef.current({skipCache:true}); if(!token || !tokenBelongsToUser(token,userId)) throw new Error("Sign in again to load routes.");
      const result=await getActivityRoutes({q:query,page,...(saved?{saved:"1" as const}:{}),...nearby},
        {headers:authenticatedHeaders(token)});
      if(active && ownerRef.current===userId){setData(old=>page===0?result.routes:[...old,...result.routes]);setDataOwner(userId);setMore(result.hasMore);}
    })().catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);}),250);
    return()=>{active=false;clearTimeout(timer);};
  },[userId,query,page,nearby,saved,attempt]);
  async function findNearby() {
    const owner=userId;
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(!permission.granted)throw new Error("Location is not available. Search routes by name instead.");
      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      if(ownerRef.current!==owner)return;
      setPage(0);setNearby({lat:position.coords.latitude,lng:position.coords.longitude});
    }catch(e){setError(e instanceof Error?e.message:"Could not locate you.");}
  }
  return <View style={{padding:16,gap:12}}>
    <Text style={{color:BASECAMP.textStrong,fontSize:20}}>{saved?"Saved community routes":"Member recordings"}</Text>
    <Text style={{color:BASECAMP.textMuted}}>Real member activity · not verified trails. Saving a route awards no completion or elevation credit.</Text>
    <TextInput accessibilityLabel="Search community routes" placeholder="Search a route or summit name"
      placeholderTextColor={BASECAMP.textMuted} value={query} onChangeText={q=>{setQuery(q);setPage(0);}}
      style={{padding:14,minHeight:48,color:BASECAMP.textStrong,borderWidth:1,borderColor:BASECAMP.panelBorder}} />
    <Pressable accessibilityRole="button" style={{minHeight:48,padding:12}} onPress={nearby?()=>{setNearby(null);setPage(0);}:findNearby}>
      <Text style={{color:BASECAMP.accent}}>{nearby?"Clear nearby filter (25 km)":"Find recordings near me"}</Text>
    </Pressable>
    {loading?<ActivityIndicator color={BASECAMP.accent}/>:null}
    {error?<><Text accessibilityRole="alert" style={{color:BASECAMP.textStrong}}>{error}</Text>
      <Pressable accessibilityRole="button" style={{minHeight:48,padding:12}} onPress={()=>setAttempt(a=>a+1)}><Text style={{color:BASECAMP.accent}}>Retry routes</Text></Pressable></>:null}
    {!loading&&!error&&!data.length?<Text style={{color:BASECAMP.textMuted}}>No accessible recordings found. Private, reported or withdrawn routes do not appear here.</Text>:null}
    {data.map(route=><Pressable key={`${route.owner}:${route.hikeId}`} accessibilityRole="button"
      style={{padding:16,minHeight:64,borderWidth:1,borderColor:BASECAMP.panelBorder,borderRadius:8}}
      onPress={()=>router.push({pathname:"/community-route",params:{owner:route.owner,hikeId:route.hikeId}} as never)}>
      <Text style={{color:BASECAMP.textStrong,fontSize:16}}>{route.snapshot.name}</Text>
      <Text style={{color:BASECAMP.textMuted}}>{route.author.name} · {route.snapshot.distance} km · {route.snapshot.elevationGain} m recorded ascent</Text>
      <Text style={{color:BASECAMP.textMuted}}>Member activity · {route.audience==="followers"?"Followers only":route.audience==="private"?"Only you":"Public to members"}</Text>
    </Pressable>)}
    {more&&!loading?<Pressable accessibilityRole="button" style={{minHeight:48,padding:12}} onPress={()=>setPage(p=>p+1)}><Text style={{color:BASECAMP.accent}}>Load more</Text></Pressable>:null}
  </View>;
}
