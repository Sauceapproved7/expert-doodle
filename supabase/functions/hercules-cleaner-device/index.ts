import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {handleCleanerDeviceRequest} from '../hercules-private-bridge/cleaner-device.ts';

Deno.serve((req:Request)=>handleCleanerDeviceRequest(req));
