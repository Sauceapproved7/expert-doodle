export async function writeFetchResponse(nodeResponse,fetchResponse){
  nodeResponse.statusCode=fetchResponse.status;
  for(const [name,value] of fetchResponse.headers){
    nodeResponse.setHeader(name,value);
  }

  if(!fetchResponse.body){
    nodeResponse.end();
    return;
  }

  const reader=fetchResponse.body.getReader();
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(value&&value.byteLength){
        const accepted=nodeResponse.write(Buffer.from(value));
        if(accepted===false){
          await new Promise((resolve)=>nodeResponse.once("drain",resolve));
        }
      }
    }
    nodeResponse.end();
  }finally{
    reader.releaseLock();
  }
}
