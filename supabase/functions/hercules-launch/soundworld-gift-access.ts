function withdrawn(){
  return new Response(JSON.stringify({ok:false,error:'promotion_withdrawn',claimsEnabled:false}),{status:410,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
export function isSoundWorldGiftAccessPage(url:URL){return url.searchParams.get('soundworld_gift')==='1';}
export function soundWorldGiftAccessPage(_ctx:{U:string;K:string}){return withdrawn();}
export async function soundWorldGiftAccessRequest(_body:any,_ctx:{U:string;K:string;S:string}){return withdrawn();}
