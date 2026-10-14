import React,{useState,useEffect,useRef} from "react";
import {ScrollView,Text,TextInput,Pressable,Image,ActivityIndicator,Platform} from "react-native";
import {useUser,useAuth} from "@clerk/expo";
import {tokenBelongsToUser} from "../utils/authRequest";
import {router,useLocalSearchParams} from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import {profileAvatarFile,uploadProfileCover} from "@/utils/profileImageTransfer";
import {SRScreenHeader} from "@/components/ui";
import {ActivityAudiencePicker} from "@/components/track/ActivityAudiencePicker";
import {loadActivityAudience,saveActivityAudience,activityApiBase,type ActivityAudience} from "@/utils/activityAudience";
import {BASECAMP} from "@/constants/tokens";
export default function EditProfile(){
  const{user}=useUser();const{userId,getToken}=useAuth();
  const{image:requestedImage}=useLocalSearchParams<{image?:string}>();
  const ownerRef=useRef(userId);ownerRef.current=userId;
  const saveInFlight=useRef(false);
  const[name,setName]=useState(user?.firstName??""),[avatar,setAvatar]=useState<ImagePicker.ImagePickerAsset|null>(null);
  const[cover,setCover]=useState<ImagePicker.ImagePickerAsset|null>(null),[busy,setBusy]=useState(false);
  const[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
  const[audience,setAudience]=useState<ActivityAudience|null>(null);
  useEffect(()=>{let active=true;
    setAvatar(null);setCover(null);setMessage(null);setError(null);setAudience(null);
    if(userId)void loadActivityAudience(userId,()=>getToken({skipCache:true})).then(a=>{if(active)setAudience(a);});
    return()=>{active=false;};
  },[userId]);
  useEffect(()=>{if(user?.firstName)setName(user.firstName);},[user?.firstName]);
  async function pick(kind:"avatar"|"cover"){
    const owner=userId;setError(null);setMessage(null);
    try{
      if(Platform.OS!=="web"){
        const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
        if(!permission.granted)throw new Error("Allow photo access in Settings to choose a profile image.");
      }
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,
        aspect:kind==="cover"?[16,9]:[1,1],quality:.8});
      if(result.canceled||!result.assets[0]||ownerRef.current!==owner)return;
      if((result.assets[0].fileSize??0)>5*1024*1024)throw new Error("Crop this image or choose one under 5 MB.");
      if(kind==="avatar")setAvatar(result.assets[0]);else setCover(result.assets[0]);
    }catch(e){if(ownerRef.current===owner)setError(e instanceof Error?e.message:"Image selection failed.");}
  }
  async function save(){
    if(!user||!userId||saveInFlight.current)return;
    const owner=userId;saveInFlight.current=true;setBusy(true);setError(null);setMessage(null);
    const assertOwner=()=>{if(ownerRef.current!==owner)throw new Error("Your account changed. Reopen profile editing.");};
    const transport={
      platform:Platform.OS,
      fetchFile:(uri:string)=>fetch(uri),
      readBase64:(uri:string)=>FileSystem.readAsStringAsync(uri,{encoding:FileSystem.EncodingType.Base64}),
      uploadNative:(url:string,uri:string,headers:Record<string,string>)=>FileSystem.uploadAsync(url,uri,{
        httpMethod:"PUT",uploadType:FileSystem.FileSystemUploadType.BINARY_CONTENT,headers,
      }),
    };
    try{
      assertOwner();
      await user.update({firstName:name.trim()||null});
      if(avatar){
        // Clerk's user API owns the public identity avatar, not private photos.
        const file=await profileAvatarFile(avatar,transport);assertOwner();
        await user.setProfileImage({file});assertOwner();setAvatar(null);
      }
      if(cover){
        assertOwner();
        const token=await getToken({skipCache:true});assertOwner();
        if(!token || !tokenBelongsToUser(token,owner))throw new Error("Your account changed; reopen profile editing in the correct account.");
        await uploadProfileCover(cover,token,`${activityApiBase}/activity-community/profile-cover`,transport);
        assertOwner();setCover(null);
      }
      assertOwner();if(audience)await saveActivityAudience(owner,audience,()=>getToken({skipCache:true}));
      await user.reload();assertOwner();setMessage("Profile saved. Your cover is private; your name and avatar identify your member posts.");
    }catch(e){if(ownerRef.current===owner)setError(e instanceof Error?e.message:"Profile save failed. Your selected images have been kept for retry.");}
    finally{saveInFlight.current=false;setBusy(false);}
  }
  const button=(label:string,action:()=>void)=><Pressable accessibilityRole="button" onPress={action} disabled={busy}
    style={{minHeight:48,padding:14,borderWidth:1,borderColor:BASECAMP.panelBorder,borderRadius:8}}><Text style={{color:BASECAMP.accent}}>{label}</Text></Pressable>;
  return <ScrollView style={{backgroundColor:BASECAMP.ink}} contentContainerStyle={{padding:20,paddingTop:50,paddingBottom:80,gap:16}}>
    <SRScreenHeader title="Edit profile" onBack={()=>router.back()}/>
    <Text style={{color:BASECAMP.textMuted}}>Your name/avatar identify you to members. Your cover photo is private and synced only to your account.</Text>
    <TextInput accessibilityLabel="Profile display name" placeholder="Display name" value={name} onChangeText={setName} maxLength={80}
      style={{minHeight:48,padding:14,color:BASECAMP.textStrong,borderWidth:1,borderColor:BASECAMP.panelBorder}}/>
    <Text style={{color:BASECAMP.textStrong}}>Profile photo{requestedImage==="avatar"?" · selected":""}</Text>
    {avatar||user?.hasImage?<Image source={{uri:avatar?.uri??user!.imageUrl}} style={{width:100,height:100,borderRadius:50}}/>:null}
    {button("Change profile photo",()=>void pick("avatar"))}
    <Text style={{color:BASECAMP.textStrong}}>You hero image · private{requestedImage==="cover"?" · selected":""}</Text>
    {cover?<Image source={{uri:cover.uri}} style={{width:"100%",height:160}}/>:null}
    {button("Change hero image",()=>void pick("cover"))}
    <ActivityAudiencePicker audience={audience} onChange={setAudience}/>
    {busy?<ActivityIndicator color={BASECAMP.accent}/>:null}
    {error?<Text accessibilityRole="alert" style={{color:BASECAMP.textStrong}}>{error}</Text>:null}
    {message?<Text accessibilityRole="alert" style={{color:BASECAMP.accent}}>{message}</Text>:null}
    {message?button("Return to You",()=>router.back()):null}
    {button("Save profile and recording default",()=>void save())}
  </ScrollView>;
}
