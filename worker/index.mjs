const securityHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
const labels={heart:'Она отправила тебе ❤️',kiss:'Кажется, Викуська тебя поцеловала 💋',hug:'Викуська тебя обняла 🫂'};
export function validate(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return false;
 if(!['heart','kiss','hug','message'].includes(data.action))return false;
 if(typeof data.eventId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.eventId))return false;
 if(data.website!==''||!Number.isFinite(data.elapsed)||data.elapsed<1500)return false;
 if(data.action==='message'&&(typeof data.text!=='string'||!data.text.trim()||data.text.trim().length>1500))return false;
 return true;
}
export function messageFor(data,now=new Date()){
 const stamp=new Intl.DateTimeFormat('ru-UA',{timeZone:'Europe/Kyiv',dateStyle:'short',timeStyle:'medium'}).format(now);
 return `${data.action==='message'?`Новое сообщение от Викуськи:\n${data.text.trim()}`:labels[data.action]}\n\nВремя: ${stamp} (Киев)`;
}
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',...securityHeaders,...headers}});
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/')){
   if(!['GET','HEAD'].includes(request.method))return json({ok:false},405);
   if(!env.ASSETS)return json({ok:false},503);
   const asset=await env.ASSETS.fetch(request);const response=new Response(asset.body,asset);
   for(const [name,value] of Object.entries(securityHeaders))response.headers.set(name,value);
   response.headers.set('X-Robots-Tag','noindex, nofollow');return response;
  }
  const origin=request.headers.get('Origin');
  if(origin!==url.origin)return json({ok:false},403);
  const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
  if(new URL(request.url).pathname!=='/api/event')return json({ok:false},404,cors);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return json({ok:false},405,cors);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({ok:false},415,cors);
  if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID||!env.EVENT_GATE)return json({ok:false},503,cors);
  let body;
  try{
   // Stream limit applies even when Content-Length is absent or forged.
   const reader=request.body?.getReader();if(!reader)return json({ok:false},400,cors);
   let length=0;const chunks=[];
   while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>8192){await reader.cancel();return json({ok:false},413,cors)}chunks.push(value)}
   const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}body=JSON.parse(new TextDecoder().decode(bytes));
  }catch{return json({ok:false},400,cors)}
  if(!validate(body))return json({ok:false},400,cors);
  try{
   const stub=env.EVENT_GATE.get(env.EVENT_GATE.idFromName('private-inbox'));
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(request.headers.get('CF-Connecting-IP')||'unknown'));
   const ip=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   const result=await stub.fetch('https://gate.internal/event',{method:'POST',body:JSON.stringify({...body,ip})});
   return json(await result.json(),result.status,cors);
  }catch{return json({ok:false},503,cors)}
 }
};
// One persistent gate coordinates retries and quotas across Worker instances.
export class EventGate{
 constructor(ctx,env){this.ctx=ctx;this.env=env}
 async fetch(request){
  const data=await request.json();const now=Date.now();const eventKey=`event:${data.eventId}`;
  const decision=await this.ctx.storage.transaction(async tx=>{
   const previous=await tx.get(eventKey);
   if(previous)return {status:previous.state==='sent'?200:409,ok:previous.state==='sent',duplicate:true};
   let global=await tx.get('global')||{start:now,count:0};if(now-global.start>=3600000)global={start:now,count:0};
   let visitor=await tx.get(`ip:${data.ip}`)||{start:now,count:0,last:0};if(now-visitor.start>=60000)visitor={start:now,count:0,last:0};
   if(global.count>=60||visitor.count>=6||now-visitor.last<3000)return {status:429,ok:false};
   await tx.put('global',{...global,count:global.count+1});await tx.put(`ip:${data.ip}`,{...visitor,count:visitor.count+1,last:now});
   await tx.put(eventKey,{state:'pending',time:now});return null;
  });
  if(decision)return json(decision,decision.status);
  await this.ctx.storage.setAlarm(now+86400000);
  let delivered=false;
  try{
   const response=await fetch(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:this.env.TELEGRAM_CHAT_ID,text:messageFor(data),protect_content:true}),signal:AbortSignal.timeout(10000)});
   const result=await response.json();delivered=response.ok&&result.ok===true;
  }catch{/* Keep ambiguous attempts to prevent automatic duplicate deliveries. */}
  await this.ctx.storage.put(eventKey,{state:delivered?'sent':'unknown',time:now});
  return json({ok:delivered},delivered?200:502);
 }
 async alarm(){
  const entries=await this.ctx.storage.list();const cutoff=Date.now()-86400000;
  for(const [key,value] of entries){if((key.startsWith('event:')&&value.time<cutoff)||(key.startsWith('ip:')&&value.start<cutoff))await this.ctx.storage.delete(key)}
  if(entries.size>2)await this.ctx.storage.setAlarm(Date.now()+86400000);
 }
}
