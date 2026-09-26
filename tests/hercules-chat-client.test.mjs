import test from "node:test";
import assert from "node:assert/strict";
import {createHerculesChatClient} from "../hercules-chat/client.mjs";

function token(value="user-jwt") {
  return async () => value;
}

test("chat client posts authenticated actions without putting credentials in the URL", async () => {
  const calls = [];
  const client = createHerculesChatClient({
    supabaseUrl:"https://abcdefghijklmnopqrst.supabase.co",
    anonKey:"anon-public-key",
    accessToken:token(),
    fetchImpl:async (url, options={}) => {
      calls.push({url:String(url),options});
      return Response.json({session:{id:"s1"}});
    },
  });

  const result = await client.createSession({title:"Test"});
  assert.equal(result.session.id,"s1");
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,"https://abcdefghijklmnopqrst.supabase.co/functions/v1/hercules-chat");
  assert.equal(calls[0].url.includes("anon-public-key"),false);
  assert.equal(calls[0].url.includes("user-jwt"),false);
  assert.equal(calls[0].options.headers.apikey,"anon-public-key");
  assert.equal(calls[0].options.headers.authorization,"Bearer user-jwt");
  assert.deepEqual(JSON.parse(calls[0].options.body),{action:"create_session",title:"Test"});
});

test("chat client exposes the complete v1 action surface", async () => {
  const actions=[];
  const client=createHerculesChatClient({
    supabaseUrl:"https://abcdefghijklmnopqrst.supabase.co/",
    anonKey:"anon-public-key",
    accessToken:"user-jwt",
    fetchImpl:async (_url,options={})=>{
      actions.push(JSON.parse(options.body).action);
      return Response.json({});
    },
  });

  await client.listSessions({limit:10});
  await client.updateSession("s1",{title:"Renamed"});
  await client.sendMessage("s1",{type:"text",text:"hello"},{clientMessageId:"11111111-1111-4111-8111-111111111111"});
  await client.getMessages("s1",{afterId:4,limit:20});
  await client.remember("fact text",{memoryType:"fact",sessionId:"s1"});
  await client.searchMemory("fact",{limit:5,threshold:0.5});
  await client.forgetMemory("11111111-1111-4111-8111-111111111111");
  await client.usage();
  await client.runChat("s1","build it",{clientMessageId:"22222222-2222-4222-8222-222222222222"});
  await client.deleteSession("s1");

  assert.deepEqual(actions,[
    "list_sessions",
    "update_session",
    "send_message",
    "get_messages",
    "remember",
    "search_memory",
    "forget_memory",
    "usage",
    "run_chat",
    "delete_session",
  ]);
});

test("chat client fails closed on unsafe configuration and unauthorized responses", async () => {
  assert.throws(
    ()=>createHerculesChatClient({
      supabaseUrl:"http://example.com",
      anonKey:"anon",
      accessToken:"jwt",
    }),
    /HTTPS/,
  );

  assert.throws(
    ()=>createHerculesChatClient({
      supabaseUrl:"https://abcdefghijklmnopqrst.supabase.co",
      anonKey:"",
      accessToken:"jwt",
    }),
    /anon key/i,
  );

  const client=createHerculesChatClient({
    supabaseUrl:"https://abcdefghijklmnopqrst.supabase.co",
    anonKey:"anon",
    accessToken:"expired",
    fetchImpl:async ()=>Response.json({error:"UNAUTHORIZED"},{status:401}),
  });
  await assert.rejects(client.usage(),/UNAUTHORIZED/);
});

test("chat client bounds common user-controlled fields before network I/O", async () => {
  let called=false;
  const client=createHerculesChatClient({
    supabaseUrl:"https://abcdefghijklmnopqrst.supabase.co",
    anonKey:"anon",
    accessToken:"jwt",
    fetchImpl:async ()=>{called=true;return Response.json({});},
  });

  await assert.rejects(client.runChat("s1","x".repeat(12001)),/prompt/i);
  await assert.rejects(client.remember("x".repeat(12001)),/memory/i);
  assert.equal(called,false);
});
