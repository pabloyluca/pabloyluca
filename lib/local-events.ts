import { EventEmitter } from "node:events";
import { usesLocalData } from "./mode";
declare global {
  var plLocalEvents: EventEmitter | undefined;
}
export const events = () =>
  (globalThis.plLocalEvents ??= new EventEmitter().setMaxListeners(0));
export function signal(...topics: string[]) {
  if (usesLocalData()) for (const t of topics) events().emit(t);
}
