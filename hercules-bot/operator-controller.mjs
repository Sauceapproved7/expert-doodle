import {classifyCommand, authorizeCommand, createReceipt} from "./operator-core.mjs";

function safeKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function createOperatorController({adapters={}}={}) {
  return Object.freeze({
    async run(input={}, context={}) {
      const command=classifyCommand(input);
      const authorization=authorizeCommand(command,context);
      const receipt=createReceipt(command,authorization);

      if (authorization.decision==="deny") {
        return {status:"denied",reason:authorization.reason,receipt};
      }
      if (authorization.decision==="hold") {
        return {status:"held",reason:authorization.reason,receipt};
      }

      const targetAdapter=adapters[safeKey(command.target)];
      const action=targetAdapter?.[safeKey(command.verb)];
      if (typeof action!=="function") {
        return {status:"denied",reason:"adapter-not-registered",receipt};
      }

      const evidence=await action({
        command,
        payload: input.payload ?? {},
        context: Object.freeze({...context})
      });
      return {status:"completed",evidence,receipt};
    }
  });
}
