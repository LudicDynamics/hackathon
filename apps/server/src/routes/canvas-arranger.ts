import { Router, type Request, type Response } from 'express';
import type {
  CanvasArrangeRequest,
  CanvasArrangerRuntime,
} from '../engine/canvas-arranger-lifecycle.js';

const MODES: Record<string, true> = { grid: true, circle: true, row: true };
const SCREENSHOT_POLICIES: Record<string, true> = { none: true, before: true, after: true, before_and_after: true };
const REQUEST_KEYS: Record<string, true> = {
  worldId: true, layer: true, mode: true, requestId: true,
  expectedRevision: true, expectedCanvasVersion: true, snapshotId: true,
  screenshotPolicy: true,
};

function validString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseRequest(body: unknown): CanvasArrangeRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Canvas arrangement request must be an object.');
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some((key) => !REQUEST_KEYS[key])) throw new Error('Canvas arrangement request contains unknown fields.');
  if (!validString(value.worldId) || !validString(value.layer) || !validString(value.requestId) || !validString(value.snapshotId)) throw new Error('Canvas arrangement identity is incomplete.');
  if (!MODES[String(value.mode)] || !SCREENSHOT_POLICIES[String(value.screenshotPolicy)]) throw new Error('Canvas arrangement mode or screenshot policy is invalid.');
  if (!Number.isInteger(value.expectedRevision) || Number(value.expectedRevision) < 0 || !Number.isInteger(value.expectedCanvasVersion) || Number(value.expectedCanvasVersion) < 0) throw new Error('Canvas version fence is invalid.');
  return {
    worldId: value.worldId,
    layer: value.layer,
    mode: value.mode as CanvasArrangeRequest['mode'],
    requestId: value.requestId,
    expectedRevision: value.expectedRevision as number,
    expectedCanvasVersion: value.expectedCanvasVersion as number,
    snapshotId: value.snapshotId,
    screenshotPolicy: value.screenshotPolicy as CanvasArrangeRequest['screenshotPolicy'],
  };
}

function statusFor(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('already in progress')) return 409;
  if (message.includes('not found')) return 404;
  if (message.includes('No active world')) return 409;
  return 400;
}

/** Mounted at `/api`; canonical endpoint is POST /api/canvas/arrange. */
export function createCanvasArrangerRouter(runtime: CanvasArrangerRuntime): Router {
  const router = Router();
  router.post('/canvas/arrange', async (req: Request, res: Response) => {
    try {
      const accepted = await runtime.start(parseRequest(req.body));
      res.status(202).json(accepted);
    } catch (error) {
      res.status(statusFor(error)).json({ ok: false, code: statusFor(error) === 409 ? 'conflict' : 'invalid_request', error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.get('/canvas/arrange/:operationId', (req: Request, res: Response) => {
    const operationId = typeof req.params.operationId === 'string' ? req.params.operationId : '';
    const operation = runtime.get(operationId);
    if (!operation) return res.status(404).json({ ok: false, code: 'not_found', error: 'Canvas arrangement operation was not found.' });
    return res.json(operation);
  });

  router.post('/canvas/arrange/:operationId/cancel', async (req: Request, res: Response) => {
    const operationId = typeof req.params.operationId === 'string' ? req.params.operationId : '';
    const operation = runtime.get(operationId);
    if (!operation) return res.status(404).json({ ok: false, code: 'not_found', error: 'Canvas arrangement operation was not found.' });
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    if (body.worldId !== operation.worldId || body.layer !== operation.layer || body.requestId !== operation.requestId) {
      return res.status(409).json({ ok: false, code: 'request_reuse_mismatch', error: 'Cancellation identity does not match the operation.' });
    }
    try {
      return res.status(202).json(await runtime.cancel(operation.operationId));
    } catch (error) {
      return res.status(statusFor(error)).json({ ok: false, code: 'invalid_request', error: error instanceof Error ? error.message : String(error) });
    }
  });
  return router;
}
