// Builds grain packs off the main thread and hands the buffers over without copying.
import { buildPack } from './build';
import { transferables } from './pack';

export interface SimRequest { id: number; n: number }

// The project compiles against the DOM lib only (the WebWorker lib would retype every global),
// so describe the little of the worker scope used here.
interface WorkerScope {
  onmessage: ((e: MessageEvent<SimRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;

scope.onmessage = (e: MessageEvent<SimRequest>) => {
  const { id, n } = e.data;
  try {
    const pack = buildPack(n);
    scope.postMessage({ id, pack }, transferables(pack));
  } catch (err) {
    scope.postMessage({ id, error: String(err) });
  }
};
