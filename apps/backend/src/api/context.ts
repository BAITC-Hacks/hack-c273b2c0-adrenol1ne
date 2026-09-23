import type { Session } from "@shared/types/session";
export type ApiContext = {
  request: Request;
  url: URL;
  path: string[];
  session: Session;
};
