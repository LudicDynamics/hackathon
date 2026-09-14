import { AirpRequestError } from './airp-gateway.js';

export const ACTION_FEEDBACK_STATUSES = ['accepted', 'conflict', 'rejected', 'failed'] as const;
export type ActionFeedbackStatus = (typeof ACTION_FEEDBACK_STATUSES)[number];
export type ActionFeedbackOutcome = ActionFeedbackStatus | 'pending' | 'cancelled';
export type ActionVerb = 'inspect' | 'act' | 'enter' | 'choice' | 'dice' | 'present' | 'move' | 'take' | 'drop' | 'cancel';

/** Local projection only; this module never creates or replaces a world event. */
export interface ActionFeedback<TDetails = unknown> {
  /** One attempt only. A terminal feedback cannot be settled twice. */
  key: string;
  outcome: ActionFeedbackOutcome;
  /** Null while pending or cancelled; a terminal action status otherwise. */
  status: ActionFeedbackStatus | null;
  /** Always present so UI does not infer copy from HTTP status or exceptions. */
  message: string;
  /** Authoritative gateway details, when returned. */
  details: TDetails | null;
  /** Authoritative event id, when details include an event. */
  eventId?: string;
  /** Compatibility with UX phase vocabulary. */
  phase: 'pending' | 'succeeded' | 'conflict' | 'failed' | 'cancelled';
}

export interface ActionFeedbackStart {
  key: string;
  verb: ActionVerb;
  target?: string;
}

export type ActionResultLike<TDetails = unknown> =
  | ({ ok: true; details?: TDetails; eventId?: string } & Record<string, unknown>)
  | ({ ok: false; code?: string; error?: unknown; details?: unknown } & Record<string, unknown>)
  | { cancelled: true };

const CONFLICT_CODES = new Set([
  'requirements_not_met', 'wrong_item', 'already_open', 'not_ready', 'no_handler',
  'choice_not_found', 'not_interactive', 'dice_already_rolled', 'already_exists',
  'not_movable', 'near_out_of_layer', 'no_free_seat', 'stale', 'conflict',
]);
const REJECTED_CODES = new Set([
  'forbidden', 'permission_denied', 'unauthorized', 'not_allowed', 'rejected',
  'dice_forced_not_allowed',
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function errorCode(value: unknown): string | undefined {
  const item = record(value);
  const payload = record(item?.payload);
  const nested = record(item?.error);
  const nestedPayload = record(nested?.payload);
  const candidate = item?.code ?? payload?.code ?? nested?.code ?? nestedPayload?.code;
  return typeof candidate === 'string' ? candidate : undefined;
}

function errorMessage(value: unknown): string {
  if (value instanceof Error && value.message) return value.message;
  const item = record(value);
  if (typeof item?.message === 'string' && item.message) return item.message;
  if (item?.error instanceof Error && item.error.message) return item.error.message;
  if (typeof item?.error === 'string' && item.error) return item.error;
  return 'The action could not be completed.';
}

function errorStatus(value: unknown): number | undefined {
  if (value instanceof AirpRequestError) return value.status;
  const item = record(value);
  const payload = record(item?.payload);
  const nested = record(item?.error);
  const candidate = item?.status ?? item?.statusCode ?? item?.httpStatus ?? payload?.status
    ?? nested?.status ?? nested?.statusCode ?? nested?.httpStatus;
  return typeof candidate === 'number' ? candidate : undefined;
}

/** Extract both current gateway success shapes: `{ ok: true, ...details }` and `{ ok: true, details }`. */
export function actionDetailsOf<TDetails = Record<string, unknown>>(result: ActionResultLike<TDetails>): TDetails | null {
  if (!result || ('cancelled' in result && result.cancelled === true) || !('ok' in result) || result.ok !== true) return null;
  const nested = record(result.details);
  if (nested && Object.keys(nested).length > 0) return result.details as TDetails;
  const flat = { ...result } as Record<string, unknown>;
  delete flat.ok;
  delete flat.eventId;
  if (Object.keys(flat).length === 0) return null;
  return flat as TDetails;
}

function eventIdOf(details: unknown, result: unknown): string | undefined {
  const detail = record(details);
  const event = record(detail?.event);
  const top = record(result);
  const id = detail?.eventId ?? event?.id ?? top?.eventId;
  return typeof id === 'string' ? id : undefined;
}

/** Classify domain outcomes, never by success copy and never by HTTP 2xx alone. */
export function classifyActionResult(verb: ActionVerb, result: ActionResultLike): ActionFeedbackStatus | 'cancelled' {
  if ('cancelled' in result && result.cancelled === true) return 'cancelled';
  if (!('ok' in result) || result.ok !== true) {
    const code = errorCode(result);
    const status = errorStatus(result);
    if (code && REJECTED_CODES.has(code)) return 'rejected';
    if (status === 401 || status === 403) return 'rejected';
    if (code && CONFLICT_CODES.has(code)) return 'conflict';
    if (status === 409 || status === 422) return 'conflict';
    return 'failed';
  }
  {
    const details = actionDetailsOf(result);
    if (!details) return 'failed';
    const detail = record(details);
    if (verb === 'present' && detail?.handled === false) return 'conflict';
    if (detail?.status === 'conflict' || detail?.outcome === 'conflict') return 'conflict';
    if (detail?.status === 'rejected' || detail?.outcome === 'rejected' || detail?.accepted === false) return 'rejected';
    if (detail?.status === 'failed' || detail?.outcome === 'failed') return 'failed';
    const code = typeof detail?.code === 'string' ? detail.code : undefined;
    if (code && CONFLICT_CODES.has(code)) return 'conflict';
    if (code && REJECTED_CODES.has(code)) return 'rejected';
    // A failed dice check is still an accepted, persisted action fact.
    return 'accepted';
  }

}

function phaseOf(outcome: ActionFeedbackOutcome): ActionFeedback['phase'] {
  if (outcome === 'accepted') return 'succeeded';
  if (outcome === 'rejected') return 'failed';
  return outcome;
}

function messageOf(status: ActionFeedbackStatus | 'cancelled', result: ActionResultLike): string {
  if (status === 'cancelled') return 'Action cancelled.';
  if ('ok' in result && result.ok === true) {
    const detail = record(actionDetailsOf(result));
    if (status === 'conflict' && typeof detail?.reason === 'string') return detail.reason;
    if (status === 'rejected') return 'You are not allowed to do that.';
    return status === 'accepted' ? 'Action accepted.' : 'The action was not accepted.';
  }
  const code = errorCode(result);
  if (code === 'requirements_not_met') return 'That requirement is not met.';
  if (code === 'choice_not_found' || code === 'stale') return 'That choice is no longer available.';
  if (code === 'dice_already_rolled') return 'This roll has already been resolved.';
  if (code === 'wrong_item' || code === 'already_open' || code === 'not_ready' || code === 'no_handler') return 'That action has no effect here.';
  if (status === 'conflict') return 'The action conflicts with the current world state.';
  if (status === 'rejected') return 'You are not allowed to do that.';
  return errorMessage(result);
}

export class ActionFeedbackStore {
  private readonly entries = new Map<string, ActionFeedback>();
  private readonly verbs = new Map<string, ActionVerb>();
  private readonly listeners = new Set<() => void>();

  begin(input: ActionFeedbackStart): ActionFeedback {
    if (!input.key.trim()) throw new Error('Action feedback key must not be empty');
    const existing = this.entries.get(input.key);
    if (existing) return existing;
    const feedback: ActionFeedback = {
      key: input.key,
      outcome: 'pending',
      status: null,
      message: 'Working…',
      details: null,
      phase: 'pending',
    };
    this.entries.set(input.key, feedback);
    this.verbs.set(input.key, input.verb);
    this.emit();
    return feedback;
  }

  settle<TDetails = unknown>(key: string, result: ActionResultLike<TDetails>): ActionFeedback<TDetails> {
    const current = this.entries.get(key);
    if (!current) throw new Error(`Unknown action feedback key: ${key}`);
    if (current.outcome !== 'pending') return current as ActionFeedback<TDetails>;
    const outcome = classifyActionResult(this.verbs.get(key) ?? 'act', result);
    const details = actionDetailsOf(result);
    const eventId = eventIdOf(details, result);
    const feedback: ActionFeedback<TDetails> = {
      key,
      outcome,
      status: outcome === 'cancelled' ? null : outcome,
      message: messageOf(outcome, result),
      details,
      ...(eventId ? { eventId } : {}),
      phase: phaseOf(outcome),
    };
    this.entries.set(key, feedback);
    this.emit();
    return feedback;
  }

  cancel(key: string): ActionFeedback {
    const current = this.entries.get(key);
    if (!current) throw new Error(`Unknown action feedback key: ${key}`);
    if (current.outcome !== 'pending') return current;
    const feedback: ActionFeedback = { ...current, outcome: 'cancelled', status: null, message: 'Action cancelled.', phase: 'cancelled' };
    this.entries.set(key, feedback);
    this.emit();
    return feedback;
  }

  get(key: string): ActionFeedback | null {
    return this.entries.get(key) ?? null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export function beginAction(store: ActionFeedbackStore, input: ActionFeedbackStart): ActionFeedback {
  return store.begin(input);
}

export async function runAction<TDetails = unknown>(
  store: ActionFeedbackStore,
  input: ActionFeedbackStart,
  request: () => Promise<ActionResultLike<TDetails>>,
): Promise<ActionFeedback<TDetails>> {
  store.begin(input);
  try {
    return await store.settle(input.key, await request());
  } catch (error) {
    return store.settle(input.key, { ok: false, error });
  }
}

let keySequence = 0;
export function actionKey(verb: ActionVerb, target: string, detail = ''): string {
  keySequence += 1;
  return `${verb}:${target}:${detail}:${keySequence}`;
}
