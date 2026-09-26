import {randomBytes} from "node:crypto";
import {signJwtHs256} from "./hercules-base/auth-core.mjs";
const jwtSecret=randomBytes(48).toString("hex");
const userId="11111111-1111-4111-8111-111111111111";
const token=signJwtHs256({
  sub:userId,
  role:"staging_user",
  issuer:"hercules-base",
  audience:"hercules-base-api",
  ttlSeconds:900,
},jwtSecret);
void token;
