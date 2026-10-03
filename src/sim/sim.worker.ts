// Builds grain packs off the main thread and hands the buffers over without copying.
import { buildPack } from './build';
import { transferables } from './pack';

export interface SimRequest { id: number; n: number }

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (e: MessageEvent<SimRequest>) => {
  const { id, n } = e.data;
  try {
    const pack = buildPack(n);
    scope.postMessage({ id, pack }, transferables(pack));
  } catch (err) {
    scope.postMessage({ id, error: String(err) });
  }
};
