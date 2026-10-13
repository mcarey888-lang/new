import React,{useState,useEffect} from "react";
import {ScrollView,Text,TextInput,Pressable,Image,ActivityIndicator} from "react-native";
import {useUser,useAuth} from "@clerk/expo";
import {tokenBelongsToUser} from "../utils/authRequest";
import {router} from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {SRScreenHeader} from "@/components/ui";
import {ActivityAudiencePicker} from "@/components/track/ActivityAudiencePicker";
import {loadActivityAudience,saveActivityAudience,activityApiBase,type ActivityAudience} from "@/utils/activityAudience";
import {BASECAMP} from "@/constants/tokens";
export default function EditProfile(){
  const{user}=useUser();const{userId,getToken}=useAuth();
  const[name,setName]=useState(user?.firstName??""),[avatar,setAvatar]=useState<ImagePicker.ImagePickerAsset|null>(null);
  const[cover,setCover]=useState<ImagePicker.ImagePickerAsset|null>(null),[busy,setBusy]=useState(false);
  const[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
  const[audience,setAudience]=useState<ActivityAudience|null>(null);
  useEffect(()=>{let active=true;
    setAvatar(null);setCover(null);setMessage(null);setError(null);
    if(userId)void loadActivityAudience(userId,()=>getToken({skipCache:true})).then(a=>{if(active)setAudience(a);});
    return()=>{active=false;};
  },[userId]);
  useEffect(()=>{if(user?.firstName)setName(user.firstName);},[user?.firstName]);
  async function pick(kind:"avatar"|"cover"){
    try{
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted)throw new Error("Allow photo access in Settings to choose a profile image.");
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,
        aspect:kind==="cover"?[16,9]:[1,1],quality:.8});
      if(result.canceled||!result.assets[0])return;
      if((result.assets[0].fileSize??0)>5*1024*1024)throw new Error("Crop this image or choose one under 5 MB.");
      if(kind==="avatar")setAvatar(result.assets[0]);else setCover(result.assets[0]);
    }catch(e){setError(e instanceof Error?e.message:"Image selection failed.");}
  }
  async function save(){
    if(!user||!userId||busy)return;setBusy(true);setError(null);setMessage(null);
    try{
      await user.update({firstName:name.trim()||null});
      if(avatar){
        // Clerk's user API owns the public identity avatar, not private photos.
        const file=await(await fetch(avatar.uri)).blob();
        await user.setProfileImage({file});setAvatar(null);
      }
      if(cover){
        const token=await getToken({skipCache:true});if(!token || !tokenBelongsToUser(token,userId))throw new Error("Your account changed; reopen profile editing in the correct account.");
        const file=await(await fetch(cover.uri)).blob();
        const res=await fetch(`${activityApiBase}/activity-community/profile-cover`,{method:"PUT",
          headers:{Authorization:`Bearer ${token}`,"Content-Type":file.type||cover.mimeType||"image/jpeg"},body:file});
        if(!res.ok)throw new Error("Name/avatar may have saved, but your private cover did not upload. Retry with the selected image.");
        setCover(null);
      }
      if(audience)await saveActivityAudience(userId,audience,()=>getToken({skipCache:true}));
      await user.reload();setMessage("Profile saved. Your cover is private; your name and avatar identify your member posts.");
    }catch(e){setError(e instanceof Error?e.message:"Profile save failed. Your selected images have been kept for retry.");}
    finally{setBusy(false);}
  }
  const button=(label:string,action:()=>void)=><Pressable accessibilityRole="button" onPress={action} disabled={busy}
    style={{minHeight:48,padding:14,borderWidth:1,borderColor:BASECAMP.panelBorder,borderRadius:8}}><Text style={{color:BASECAMP.accent}}>{label}</Text></Pressable>;
  return <ScrollView style={{backgroundColor:BASECAMP.ink}} contentContainerStyle={{padding:20,paddingTop:50,paddingBottom:80,gap:16}}>
    <SRScreenHeader title="Edit profile" onBack={()=>router.back()}/>
    <Text style={{color:BASECAMP.textMuted}}>Your name/avatar identify you to members. Your cover photo is private and synced only to your account.</Text>
    <TextInput accessibilityLabel="Profile display name" placeholder="Display name" value={name} onChangeText={setName} maxLength={80}
      style={{minHeight:48,padding:14,color:BASECAMP.textStrong,borderWidth:1,borderColor:BASECAMP.panelBorder}}/>
    {avatar?<Image source={{uri:avatar.uri}} style={{width:100,height:100,borderRadius:50}}/>:null}
    {button("Choose and crop avatar",()=>void pick("avatar"))}
    {cover?<Image source={{uri:cover.uri}} style={{width:"100%",height:160}}/>:null}
    {button("Choose and crop private cover",()=>void pick("cover"))}
    <ActivityAudiencePicker audience={audience} onChange={setAudience}/>
    {busy?<ActivityIndicator color={BASECAMP.accent}/>:null}
    {error?<Text accessibilityRole="alert" style={{color:BASECAMP.textStrong}}>{error}</Text>:null}
    {message?<Text accessibilityRole="alert" style={{color:BASECAMP.accent}}>{message}</Text>:null}
    {button("Save profile and recording default",()=>void save())}
  </ScrollView>;
}
