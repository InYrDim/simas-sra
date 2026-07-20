"use server";
import { revalidatePath } from "next/cache";import { redirect } from "next/navigation";
import { createLocationService,type LocationType } from "@/lib/location";import { locationStore } from "@/lib/location-data";import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
const service=createLocationService({store:locationStore});
const fields=(f:FormData)=>({name:String(f.get("name")??""),code:String(f.get("code")??""),type:String(f.get("type")??"") as LocationType,capacity:f.get("capacity")?Number(f.get("capacity")):null,description:String(f.get("description")??"")||null,parentId:String(f.get("parentId")??"")||null});
function finish(domain:string,result:{ok:boolean;code?:string}){revalidatePath(`/${domain}/master/sarpras`);redirect(`/${domain}/master/sarpras?result=${result.ok?"saved":result.code??"error"}`);}
export async function createLocationAction(domain:string,form:FormData){finish(domain,await service.create(await enforceMasterDataAccess(domain,"write"),fields(form)));}
export async function editLocationAction(domain:string,form:FormData){finish(domain,await service.edit(await enforceMasterDataAccess(domain,"write"),String(form.get("id")),fields(form),Number(form.get("expectedVersion"))));}
export async function manageLocationAction(domain:string,form:FormData){const p=await enforceMasterDataAccess(domain,"write"),id=String(form.get("id")),input={expectedVersion:Number(form.get("expectedVersion")),reason:String(form.get("reason")??"")};finish(domain,String(form.get("operation"))==="archive"?await service.archive(p,id,input):await service.reactivate(p,id,input));}
