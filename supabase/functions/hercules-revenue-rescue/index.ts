import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";
import {applySignal, normalizeLead, recoveryPlan, type RevenueLead} from "./core.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...corsHeaders, "content-type": "application/json; charset=utf-8"},
  });
}

function leadFromRow(row: Record<string, unknown>): RevenueLead {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    contactId: row.contact_id as string | null,
    source: row.source as string,
    externalKey: row.external_key as string | null,
    status: row.status as RevenueLead["status"],
    firstName: row.first_name as string | null,
    lastName: row.last_name as string | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
    currency: row.currency as string,
    estimatedValueCents: Number(row.estimated_value_cents ?? 0),
    allowedChannels: (row.allowed_channels ?? []) as RevenueLead["allowedChannels"],
    context: (row.context ?? {}) as Record<string, unknown>,
    lastInboundAt: row.last_inbound_at as string | null,
    lastOutboundAt: row.last_outbound_at as string | null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: corsHeaders});
  if (req.method !== "POST") return response({error: "method_not_allowed"}, 405);

  const authorization = req.headers.get("authorization");
  if (!authorization) return response({error: "authorization_required"}, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {global: {headers: {Authorization: authorization}}},
  );

  try {
    const body = await req.json();
    const action = String(body?.action ?? "").trim();
    const organizationId = String(body?.organizationId ?? "").trim();
    if (!organizationId) return response({error: "organizationId_required"}, 400);

    if (action === "ingest") {
      const lead = normalizeLead({...body.lead, organizationId});
      const now = new Date();
      const row = {
        organization_id: lead.organizationId,
        contact_id: lead.contactId ?? null,
        source: lead.source,
        external_key: lead.externalKey ?? null,
        status: lead.status,
        first_name: lead.firstName ?? null,
        last_name: lead.lastName ?? null,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
        currency: lead.currency,
        estimated_value_cents: lead.estimatedValueCents,
        allowed_channels: lead.allowedChannels,
        context: lead.context,
        last_inbound_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      const {data: saved, error: leadError} = await supabase
        .from("hercules_revenue_leads")
        .upsert(row, {onConflict: "organization_id,source,external_key"})
        .select("*")
        .single();
      if (leadError) return response({error: "lead_ingest_failed", detail: leadError.message}, 400);

      const plan = recoveryPlan(leadFromRow(saved), now);
      if (plan.length) {
        const actions = plan.map((step) => ({
          organization_id: organizationId,
          lead_id: saved.id,
          kind: step.kind,
          channel: step.channel,
          state: "queued",
          template_key: step.templateKey,
          idempotency_key: step.idempotencyKey,
          due_at: step.dueAt,
          payload: {templateKey: step.templateKey, source: saved.source},
        }));
        const {error: actionError} = await supabase
          .from("hercules_revenue_actions")
          .upsert(actions, {onConflict: "organization_id,idempotency_key", ignoreDuplicates: true});
        if (actionError) return response({error: "action_queue_failed", detail: actionError.message}, 400);

        await supabase
          .from("hercules_revenue_leads")
          .update({next_follow_up_at: plan[0].dueAt, updated_at: now.toISOString()})
          .eq("id", saved.id)
          .eq("organization_id", organizationId);
      }

      await supabase.from("hercules_revenue_events").insert({
        organization_id: organizationId,
        lead_id: saved.id,
        event_name: "lead_ingested",
        currency: saved.currency,
        properties: {source: saved.source, queuedActions: plan.length},
      });

      return response({ok: true, lead: saved, queuedActions: plan.length, nextActionAt: plan[0]?.dueAt ?? null});
    }

    if (action === "signal") {
      const leadId = String(body?.leadId ?? "").trim();
      const signal = String(body?.signal ?? "").trim();
      if (!leadId || !signal) return response({error: "leadId_and_signal_required"}, 400);

      const {data: row, error: fetchError} = await supabase
        .from("hercules_revenue_leads")
        .select("*")
        .eq("id", leadId)
        .eq("organization_id", organizationId)
        .single();
      if (fetchError) return response({error: "lead_not_found"}, 404);

      const at = new Date().toISOString();
      const transition = applySignal(leadFromRow(row), signal, at);
      const {error: updateError} = await supabase
        .from("hercules_revenue_leads")
        .update({
          status: transition.lead.status,
          last_inbound_at: transition.lead.lastInboundAt,
          next_follow_up_at: transition.cancelPendingActions ? null : row.next_follow_up_at,
          updated_at: at,
        })
        .eq("id", leadId)
        .eq("organization_id", organizationId);
      if (updateError) return response({error: "lead_update_failed", detail: updateError.message}, 400);

      if (transition.cancelPendingActions) {
        await supabase
          .from("hercules_revenue_actions")
          .update({state: "cancelled", updated_at: at})
          .eq("lead_id", leadId)
          .eq("organization_id", organizationId)
          .in("state", ["queued", "claimed"]);
      }

      const amountCents = Math.max(0, Number(body?.amountCents ?? (signal === "won" ? row.estimated_value_cents : 0)) || 0);
      await supabase.from("hercules_revenue_events").insert({
        organization_id: organizationId,
        lead_id: leadId,
        event_name: signal,
        amount_cents: amountCents,
        currency: row.currency,
        occurred_at: at,
        properties: body?.properties && typeof body.properties === "object" ? body.properties : {},
      });

      return response({ok: true, leadId, status: transition.lead.status, cancelledPendingActions: transition.cancelPendingActions});
    }

    if (action === "dashboard") {
      const {data, error} = await supabase
        .from("hercules_revenue_dashboard")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) return response({error: "dashboard_failed", detail: error.message}, 400);
      return response({ok: true, metrics: data ?? {
        organization_id: organizationId,
        total_leads: 0,
        engaged_leads: 0,
        booked_leads: 0,
        won_leads: 0,
        recovered_revenue_cents: 0,
        queued_actions: 0,
        failed_actions: 0,
        recovery_rate: 0,
      }});
    }

    if (action === "leads") {
      const limit = Math.min(100, Math.max(1, Number(body?.limit ?? 25) || 25));
      const {data, error} = await supabase
        .from("hercules_revenue_leads")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", {ascending: false})
        .limit(limit);
      if (error) return response({error: "lead_list_failed", detail: error.message}, 400);
      return response({ok: true, leads: data});
    }

    if (action === "due_actions") {
      const now = new Date().toISOString();
      const limit = Math.min(100, Math.max(1, Number(body?.limit ?? 25) || 25));
      const {data, error} = await supabase
        .from("hercules_revenue_actions")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("state", "queued")
        .lte("due_at", now)
        .order("due_at", {ascending: true})
        .limit(limit);
      if (error) return response({error: "action_list_failed", detail: error.message}, 400);
      return response({ok: true, actions: data});
    }

    return response({error: "unsupported_action"}, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return response({error: "invalid_request", detail: message}, 400);
  }
});
