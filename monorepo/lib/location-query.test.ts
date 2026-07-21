import assert from "node:assert/strict";
import test from "node:test";
import { queryLocations } from "@/lib/location-query";
import type { Location } from "@/lib/location";
const at = new Date("2026-07-20");
const records: Location[] = [{ id:"1",tenantId:"t",name:"Gedung A",normalizedName:"gedung a",code:"G-A",normalizedCode:"g-a",type:"building",capacity:null,description:null,parentId:null,archived:false,archivedAt:null,archiveReason:null,version:1,createdAt:at,updatedAt:at },{ id:"2",tenantId:"t",name:"Ruang Lab",normalizedName:"ruang lab",code:"LAB",normalizedCode:"lab",type:"room",capacity:30,description:null,parentId:"1",archived:true,archivedAt:at,archiveReason:"lama",version:2,createdAt:at,updatedAt:at }];
test("searches, filters, sorts, paginates, and selects locations from URL state",()=>{ const result=queryLocations(records,{q:"lab",archive:"all",type:"room",sort:"name-desc",pageSize:"25",selected:"2"}); assert.equal(result.total,1); assert.equal(result.items[0]?.id,"2"); assert.equal(result.query.selected,"2"); });
