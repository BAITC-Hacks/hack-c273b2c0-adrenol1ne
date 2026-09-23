import { AsyncLocalStorage } from "node:async_hooks";
import { SYSTEM_ACTOR, type Actor } from "@shared/types/session";
const context = new AsyncLocalStorage<Actor>();
export const currentActor = () => context.getStore() ?? SYSTEM_ACTOR;
export const withActor = <T>(actor: Actor, work: () => T): T =>
  context.run(actor, work);
