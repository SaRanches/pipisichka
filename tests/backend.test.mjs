import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{validate,messageFor,EventGate} from '../worker/index.mjs';
const valid=()=>({action:'heart',eventId:crypto.randomUUID(),elapsed:5000,website:''});
test('accept known actions; reject malformed or empty messages',()=>{
 for(const action of ['heart','kiss','hug'])assert.equal(validate({...valid(),action}),true);
 for(const data of [null,{},[],{...valid(),action:'spam'},{...valid(),eventId:'fake'},{...valid(),website:'bot'},{...valid(),elapsed:1},{...valid(),action:'message',text:'  '},{...valid(),action:'message',text:'a'.repeat(1501)}])assert.equal(validate(data),false);
 assert.equal(validate({...valid(),action:'message',text:'Привет ❤️'}),true);
});
test('format plain Telegram text and Kyiv time',()=>{
 const value=messageFor({...valid(),action:'message',text:' <b>Привет</b> '},new Date('2026-01-01T00:00:00Z'));
 assert.match(value,/<b>Привет<\/b>/);assert.match(value,/02:00:00/);assert.match(value,/Киев/);
});
const env={};
const req=(body,overrides={})=>new Request('https://worker.example/api/event',{method:'POST',headers:{Origin:'https://worker.example','Content-Type':'application/json'},body:JSON.stringify(body),...overrides});
test('fail closed for foreign origin, missing credentials, methods',async()=>{
 assert.equal((await worker.fetch(req(valid(),{headers:{Origin:'https://evil.test'}}),env)).status,403);
 const response=await worker.fetch(req(valid()),env);assert.equal(response.status,503);assert.equal((await response.json()).ok,false);
 assert.equal((await worker.fetch(req(null,{method:'GET',body:undefined}),env)).status,405);
 const preflight=await worker.fetch(req(null,{method:'OPTIONS',body:undefined}),env);assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://worker.example');
});
test('validate real body limits and forward only verified requests',async()=>{
 const configured={...env,TELEGRAM_BOT_TOKEN:'test',TELEGRAM_CHAT_ID:'1',EVENT_GATE:{idFromName:n=>n,get:()=>({fetch:async()=>new Response('{"ok":true}')})}};
 assert.equal((await worker.fetch(req({...valid(),text:'a'.repeat(9000)}),configured)).status,413);
 assert.equal((await worker.fetch(req({}),configured)).status,400);
 assert.equal((await worker.fetch(req(valid()),configured)).status,200);
});
test('persistent gate deduplicates and throttles; success requires Telegram ok',async()=>{
 const map=new Map();const storage={get:async k=>map.get(k),put:async(k,v)=>map.set(k,v),transaction:async fn=>fn(storage),setAlarm:async()=>{}};
 const gate=new EventGate({storage},{TELEGRAM_BOT_TOKEN:'test',TELEGRAM_CHAT_ID:'1'});const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('{"ok":true}')};
 try{
  const data={...valid(),ip:'hashed'};const request=()=>new Request('https://internal/event',{method:'POST',body:JSON.stringify(data)});
  assert.equal((await gate.fetch(request())).status,200);assert.equal((await gate.fetch(request())).status,200);assert.equal(calls,1);
  assert.equal((await gate.fetch(new Request('https://internal/event',{method:'POST',body:JSON.stringify({...valid(),ip:'hashed'})}))).status,429);
  globalThis.fetch=async()=>new Response('{"ok":false}',{status:400});
  assert.equal((await gate.fetch(new Request('https://internal/event',{method:'POST',body:JSON.stringify({...valid(),ip:'another'})}))).status,502);
 }finally{globalThis.fetch=original}
});
