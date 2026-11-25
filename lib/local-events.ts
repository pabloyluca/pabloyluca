import { EventEmitter } from "node:events";
import { isSandbox } from "./mode";
declare global {
  var plLocalEvents: EventEmitter | undefined;
}
export const events = () =>
  (globalThis.plLocalEvents ??= new EventEmitter().setMaxListeners(0));
export function signal(...topics: string[]) {
  if (isSandbox()) for (const t of topics) events().emit(t);
}
