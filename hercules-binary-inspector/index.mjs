import {createHash} from "node:crypto";

const DEFAULT_MAX_BYTES=32*1024*1024;
const MAX_MAX_BYTES=128*1024*1024;
const DEFAULT_MAX_STRINGS=200;
const MAX_MAX_STRINGS=10000;
const MAX_STRING_LENGTH=512;

const MAGIC=[
  {hex:"4d5a",format:"PE"},
  {hex:"7f454c46",format:"ELF"},
  {hex:"cffaedfe",format:"Mach-O-64"},
  {hex:"feedfacf",format:"Mach-O-64"},
];

function boundedInteger(value,{name,min,max,defaultValue}) {
  const candidate=value===undefined ? defaultValue : value;
  if (!Number.isInteger(candidate) || candidate<min || candidate>max) {
    throw new TypeError(name+"_invalid");
  }
  return candidate;
}

function identifyFormat(input) {
  const prefix=input.subarray(0,4).toString("hex");
  return MAGIC.find(entry=>prefix.startsWith(entry.hex))?.format ?? "unknown";
}

function isPrintableAscii(byte) {
  return byte>=0x20 && byte<=0x7e;
}

function extractPrintableStrings(input,maxStrings) {
  if(maxStrings===0) return [];
  const strings=[];
  let start=-1;

  const emit=(end)=>{
    if(start<0 || end-start<4) return;
    const length=Math.min(end-start,MAX_STRING_LENGTH);
    strings.push({
      offset:start,
      value:input.subarray(start,start+length).toString("latin1"),
    });
  };

  for(let i=0;i<input.length;i+=1) {
    if(isPrintableAscii(input[i])) {
      if(start<0) start=i;
      continue;
    }
    emit(i);
    if(strings.length>=maxStrings) return strings;
    start=-1;
  }

  emit(input.length);
  return strings.slice(0,maxStrings);
}

export function inspectBinary(input,options={}) {
  if(!options || typeof options!=="object" || options.authorized!==true) {
    throw new Error("authorization_required");
  }
  if(!Buffer.isBuffer(input)) throw new TypeError("binary_buffer_required");

  const maxBytes=boundedInteger(options.maxBytes,{
    name:"max_bytes",
    min:1,
    max:MAX_MAX_BYTES,
    defaultValue:DEFAULT_MAX_BYTES,
  });
  const maxStrings=boundedInteger(options.maxStrings,{
    name:"max_strings",
    min:0,
    max:MAX_MAX_STRINGS,
    defaultValue:DEFAULT_MAX_STRINGS,
  });

  if(input.length===0) throw new Error("empty_binary");
  if(input.length>maxBytes) throw new Error("binary_too_large");

  return Object.freeze({
    schema:"hercules.binary-inspector.v1",
    evidence:Object.freeze({
      size:input.length,
      sha256:createHash("sha256").update(input).digest("hex"),
      format:identifyFormat(input),
      strings:Object.freeze(extractPrintableStrings(input,maxStrings).map(Object.freeze)),
    }),
    execution:"not_performed",
    mutations:"not_performed",
  });
}
