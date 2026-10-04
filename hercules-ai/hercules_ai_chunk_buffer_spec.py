import json

def consume_sse_chunks(chunks):
    buffer=""
    answer=[]
    for chunk in chunks:
        buffer+=chunk
        while "\n" in buffer:
            line,buffer=buffer.split("\n",1)
            line=line.rstrip("\r")
            if line.startswith("data: ") and line[6:]!="[DONE]":
                try:
                    answer.append(json.loads(line[6:])["choices"][0]["delta"].get("content",""))
                except (json.JSONDecodeError,KeyError,IndexError,TypeError):
                    pass
    return "".join(answer)
