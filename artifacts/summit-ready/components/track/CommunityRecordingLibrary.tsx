import React, { useEffect, useState,useRef } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, AppState } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/expo";
import * as Location from "expo-location";
import { getActivityRoutes, type ActivityCommunityRoute } from "@workspace/api-client-react";
import { authenticatedHeaders,tokenBelongsToUser } from "@/utils/authRequest";
import { BASECAMP } from "@/constants/tokens";
import { TrackMap, type TrackMapHandle } from "./TrackMap";

export function CommunityRecordingLibrary({ saved=false, initialQuery="", mountainId, mountainName }:
  { saved?: boolean; initialQuery?: string; mountainId?: string; mountainName?: string }) {
  const scoped=!!mountainId;
  const { userId, getToken }=useAuth();
  const tokenRef=useRef(getToken);tokenRef.current=getToken;
  const ownerRef=useRef(userId);ownerRef.current=userId;
  const [query,setQuery]=useState(initialQuery.slice(0,120)), [page,setPage]=useState(0), [attempt,setAttempt]=useState(0);
  const [nearby,setNearby]=useState<{lat:number;lng:number}|null>(null);
  const [dataRaw,setData]=useState<ActivityCommunityRoute[]>([]),[more,setMore]=useState(false);
  const [dataOwner,setDataOwner]=useState<string|null>(null);
  const filterKey=`${userId}|${mountainId??""}|${saved}|${query}|${nearby?.lat},${nearby?.lng}`;
  const [dataKey,setDataKey]=useState("");
  const data=dataOwner===userId&&dataKey===filterKey?dataRaw:[];
  const [loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
  const [mapView,setMapView]=useState(false);
  const mapRef=useRef<TrackMapHandle|null>(null);
  const sendPins=()=>mapRef.current?.send({type:"communityPins",routes:data.map(route=>({
    owner:route.owner,hikeId:route.hikeId,name:route.snapshot.name,startPoint:route.startPoint,
  }))});
  useEffect(()=>{sendPins();},[dataRaw,dataOwner,dataKey,filterKey,userId,mapView]);
  useFocusEffect(React.useCallback(()=>{setPage(0);setAttempt(a=>a+1);},[userId]));
  useEffect(()=>{
    const sub=AppState.addEventListener("change",state=>{
      setData([]);setMore(false);
      if(state==="active"){setPage(0);setAttempt(a=>a+1);}
    });
    return()=>sub.remove();
  },[]);
  useEffect(()=>{setPage(0);setData([]);setMore(false);setNearby(null);},[userId]);
  useEffect(()=>{setQuery(initialQuery.trim().slice(0,120));setPage(0);setData([]);setMore(false);setNearby(null);},
    [initialQuery,mountainId,saved]);
  useEffect(()=>{
    let active=true; const ctl=new AbortController(); setLoading(true);setError(null);
    if (page===0) setData([]);
    if(!userId){setData([]);setMore(false);setLoading(false);return()=>{active=false;ctl.abort();};}
    const timer=setTimeout(()=>void (async()=>{
      const token=await tokenRef.current({skipCache:true}); if(!token || !tokenBelongsToUser(token,userId)) throw new Error("Sign in again to load routes.");
      if(!active || ownerRef.current!==userId)return;
      const result=await getActivityRoutes({q:query.trim().slice(0,120),page,...(mountainId?{mountainId}:{}),...(saved?{saved:"1" as const}:{}),...nearby},
        {headers:authenticatedHeaders(token),signal:ctl.signal});
      if(active && ownerRef.current===userId){setData(old=>page===0?result.routes:[...old,...result.routes]);setDataOwner(userId);setDataKey(filterKey);setMore(result.hasMore);}
    })().catch(e=>{if(active){setData([]);setMore(false);setError(e.message);}}).finally(()=>{if(active)setLoading(false);}),250);
    return()=>{active=false;ctl.abort();clearTimeout(timer);};
  },[userId,query,page,nearby,saved,attempt,mountainId,filterKey]);
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
  if(!userId)return <View style={{padding:16,gap:12}}>
    <Text style={{color:BASECAMP.textStrong,fontSize:20}}>{scoped?"Member routes":"Community routes"}</Text>
    <Text style={{color:BASECAMP.textMuted}}>Sign in to discover member recordings. These are not verified trails.</Text>
    <Pressable accessibilityRole="button" style={{minHeight:48,padding:12}}
      onPress={()=>router.push("/(auth)/sign-in")}>
      <Text style={{color:BASECAMP.accent}}>Sign in</Text>
    </Pressable>
  </View>;
  return <View style={{padding:16,gap:12}}>
    <Text style={{color:BASECAMP.textStrong,fontSize:20}}>{saved?"Saved community routes":scoped?"Member routes":"Member recordings"}</Text>
    <Text style={{color:BASECAMP.textMuted}}>Real member activity · not verified trails. Saving a route awards no completion or elevation credit.</Text>
    <TextInput accessibilityLabel={scoped?"Search this mountain's member routes":"Search community routes"}
      placeholder={scoped?"Search routes on this mountain":"Search a route or summit name"} maxLength={120}
      placeholderTextColor={BASECAMP.textMuted} value={query} onChangeText={q=>{setQuery(q);setPage(0);}}
      style={{padding:14,minHeight:48,color:BASECAMP.textStrong,borderWidth:1,borderColor:BASECAMP.panelBorder}} />
    {scoped?null:<Pressable accessibilityRole="button" style={{minHeight:48,padding:12}} onPress={nearby?()=>{setNearby(null);setPage(0);}:findNearby}>
      <Text style={{color:BASECAMP.accent}}>{nearby?"Clear nearby filter (25 km)":"Find recordings near me"}</Text>
    </Pressable>}
    <Pressable accessibilityRole="button" style={{minHeight:48,padding:12}} onPress={()=>setMapView(value=>!value)}>
      <Text style={{color:BASECAMP.accent}}>{mapView?"Hide member route map":"Show member recordings on map"}</Text>
    </Pressable>
    {mapView?<View style={{height:320}}>
      <TrackMap recording mapRef={mapRef} onReady={sendPins} onMessage={message=>{
        if(message.type!=="communityRouteSelected")return;
        const route=data.find(item=>item.owner===message.owner&&item.hikeId===message.hikeId);
        if(route)router.push({pathname:"/community-route",params:{owner:route.owner,hikeId:route.hikeId}} as never);
      }}/>
    </View>:null}
    {!userId?<Text style={{color:BASECAMP.textStrong}}>Sign in to discover member recordings.</Text>:null}
    {userId&&loading?<ActivityIndicator color={BASECAMP.accent}/>:null}
    {userId&&error?<><Text accessibilityRole="alert" style={{color:BASECAMP.textStrong}}>{error}</Text>
      <Pressable accessibilityRole="button" style={{minHeight:48,padding:12}} onPress={()=>setAttempt(a=>a+1)}><Text style={{color:BASECAMP.accent}}>Retry routes</Text></Pressable></>:null}
    {userId&&!loading&&!error&&!data.length?<Text style={{color:BASECAMP.textMuted}}>{scoped?`No shared recordings are linked to ${mountainName??"this mountain"} yet. Member recordings appear here only when linked to this exact mountain.`:"No accessible recordings found. Private, reported or withdrawn routes do not appear here."}</Text>:null}
    {data.map(route=><Pressable key={`${route.owner}:${route.hikeId}`} accessibilityRole="button"
      style={{padding:16,minHeight:64,borderWidth:1,borderColor:BASECAMP.panelBorder,borderRadius:8}}
      onPress={()=>router.push({pathname:"/community-route",params:{owner:route.owner,hikeId:route.hikeId}} as never)}>
      <Text style={{color:BASECAMP.textStrong,fontSize:16}}>{route.snapshot.name}</Text>
      <Text style={{color:BASECAMP.textMuted}}>{route.author.name} · {route.snapshot.distance} km · {route.snapshot.elevationGain} m recorded ascent</Text>
      <Text style={{color:BASECAMP.textMuted}}>Member activity · {route.audience==="followers"?"Followers only":route.audience==="private"?"Only you":"Public to members"}</Text>
    </Pressable>)}
    {dataKey===filterKey&&more&&!loading?<Pressable accessibilityRole="button" style={{minHeight:48,padding:12}} onPress={()=>setPage(p=>p+1)}><Text style={{color:BASECAMP.accent}}>Load more</Text></Pressable>:null}
  </View>;
}
