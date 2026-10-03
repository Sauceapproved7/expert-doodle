const MODULES=Object.freeze({
  "clear-user-temp":Object.freeze({
    code:"clear-user-temp",risk:"low",requiresElevation:false,
    scope:"current-user temporary files only",reversibleViaCapsule:true
  }),
  "reset-windows-update-cache":Object.freeze({
    code:"reset-windows-update-cache",risk:"medium",requiresElevation:true,
    scope:"Windows Update cache and related services",reversibleViaCapsule:true
  }),
  "repair-windows-image":Object.freeze({
    code:"repair-windows-image",risk:"medium",requiresElevation:true,
    scope:"Windows component-store health using supported OS servicing tools",reversibleViaCapsule:true
  }),
  "startup-review":Object.freeze({
    code:"startup-review",risk:"low",requiresElevation:false,
    scope:"report startup entries; disablement requires separately approved action",reversibleViaCapsule:true
  })
});

export function listRepairModules(){
  return Object.values(MODULES);
}

export function getRepairModule(code){
  const module=MODULES[code];
  if(!module) throw new Error("repair code is not allow-listed");
  return module;
}
