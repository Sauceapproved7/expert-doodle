export type RevenueChannel = "sms" | "email" | "voice" | "internal";
export type RevenueStatus = "new" | "contacting" | "engaged" | "booked" | "won" | "lost" | "opted_out" | "human_handoff";

export type RevenueLead = {
  id?: string | null;
  organizationId: string;
  contactId?: string | null;
  source?: string;
  externalKey?: string | null;
  status?: RevenueStatus;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  currency?: string;
  estimatedValueCents?: number;
  allowedChannels?: RevenueChannel[];
  context?: Record<string, unknown>;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
};

const TERMINAL = new Set<RevenueStatus>(["booked", "won", "lost", "opted_out", "human_handoff"]);
const VALID = new Set<RevenueStatus>(["new", "contacting", "engaged", "booked", "won", "lost", "opted_out", "human_handoff"]);
const CHANNELS = new Set<RevenueChannel>(["sms", "email", "voice", "internal"]);

const SEQUENCES: Record<string, Array<{channel: RevenueChannel; delayMs: number; template: string}>> = {
  missed_call: [
    {channel: "sms", delayMs: 30_000, template: "missed_call_fast_reply"},
    {channel: "email", delayMs: 10 * 60_000, template: "missed_call_email"},
    {channel: "sms", delayMs: 24 * 60 * 60_000, template: "missed_call_next_day"},
  ],
  quote_sent: [
    {channel: "email", delayMs: 4 * 60 * 60_000, template: "quote_same_day"},
    {channel: "sms", delayMs: 24 * 60 * 60_000, template: "quote_next_day"},
    {channel: "email", delayMs: 72 * 60 * 60_000, template: "quote_final_checkin"},
  ],
  abandoned_cart: [
    {channel: "email", delayMs: 30 * 60_000, template: "cart_fast_recovery"},
    {channel: "sms", delayMs: 4 * 60 * 60_000, template: "cart_sms_recovery"},
    {channel: "email", delayMs: 24 * 60 * 60_000, template: "cart_next_day"},
  ],
  inbound: [
    {channel: "sms", delayMs: 60_000, template: "inbound_fast_reply"},
    {channel: "email", delayMs: 15 * 60_000, template: "inbound_email"},
    {channel: "sms", delayMs: 24 * 60 * 60_000, template: "inbound_next_day"},
  ],
};

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  return v.length ? v : null;
}

export function normalizeLead(input: RevenueLead): Required<Pick<RevenueLead,"organizationId"|"source"|"status"|"currency"|"estimatedValueCents"|"allowedChannels"|"context">> & RevenueLead {
  const organizationId = text(input.organizationId);
  if (!organizationId) throw new TypeError("organizationId is required");
  const email = text(input.email)?.toLowerCase() ?? null;
  const phone = text(input.phone);
  if (!email && !phone) throw new TypeError("email or phone is required");
  const status = (text(input.status) ?? "new") as RevenueStatus;
  if (!VALID.has(status)) throw new TypeError(`unsupported status: ${status}`);
  const money = Number(input.estimatedValueCents ?? 0);
  if (!Number.isInteger(money) || money < 0) throw new TypeError("estimatedValueCents must be a non-negative integer");
  const channels = [...new Set((input.allowedChannels ?? []).map((x) => String(x).toLowerCase() as RevenueChannel))]
    .filter((channel) => {
      if (!CHANNELS.has(channel)) throw new TypeError(`unsupported channel: ${channel}`);
      if ((channel === "sms" || channel === "voice") && !phone) return false;
      if (channel === "email" && !email) return false;
      return true;
    });
  return {
    ...input,
    organizationId,
    id: text(input.id),
    contactId: text(input.contactId),
    source: (text(input.source) ?? "inbound").toLowerCase(),
    externalKey: text(input.externalKey),
    status,
    firstName: text(input.firstName),
    lastName: text(input.lastName),
    email,
    phone,
    currency: (text(input.currency) ?? "USD").toUpperCase(),
    estimatedValueCents: money,
    allowedChannels: channels,
    context: input.context && typeof input.context === "object" ? input.context : {},
    lastInboundAt: text(input.lastInboundAt),
    lastOutboundAt: text(input.lastOutboundAt),
  };
}

export function recoveryPlan(input: RevenueLead, now = new Date()) {
  const lead = normalizeLead(input);
  if (!lead.id || TERMINAL.has(lead.status)) return [];
  const sequenceName = SEQUENCES[lead.source] ? lead.source : "inbound";
  return SEQUENCES[sequenceName].flatMap((step, index) => {
    if (!lead.allowedChannels.includes(step.channel)) return [];
    return [{
      kind: "follow_up",
      channel: step.channel,
      templateKey: step.template,
      dueAt: new Date(now.getTime() + step.delayMs).toISOString(),
      idempotencyKey: `${lead.id}:${sequenceName}:${index + 1}`,
    }];
  });
}

const SIGNALS: Record<string, {status: RevenueStatus; terminal: boolean}> = {
  reply: {status: "engaged", terminal: false},
  booked: {status: "booked", terminal: true},
  won: {status: "won", terminal: true},
  lost: {status: "lost", terminal: true},
  opt_out: {status: "opted_out", terminal: true},
  human_requested: {status: "human_handoff", terminal: true},
};

export function applySignal(input: RevenueLead, signal: string, at = new Date().toISOString()) {
  const lead = normalizeLead(input);
  const transition = SIGNALS[signal];
  if (!transition) throw new TypeError(`unsupported revenue signal: ${signal}`);
  return {
    lead: {
      ...lead,
      status: transition.status,
      lastInboundAt: signal === "reply" || signal === "human_requested" ? at : lead.lastInboundAt,
    },
    cancelPendingActions: transition.terminal,
  };
}
