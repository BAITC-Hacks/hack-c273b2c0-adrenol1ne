import { repositories } from "@backend/repositories";
import type { AuditRepository } from "@backend/repositories/contracts";
import { currentActor } from "@backend/middleware/request-context";
import type { Actor } from "@shared/types/session";
export type AuditAction =
  | "ACTIVITY_STARTED"
  | "ACTIVITY_COMPLETED"
  | "SKILL_UPDATED"
  | "RECOMMENDATION_GENERATED"
  | "MANAGER_VALIDATION"
  | "DATA_IMPORTED"
  | "CAREER_TARGET_UPDATED"
  | "LEARNING_PATH_PUBLISHED";
type AuditValue =
  | string
  | number
  | boolean
  | null
  | AuditValue[]
  | { [key: string]: AuditValue };
export class AuditService {
  static async record(
    input: {
      action: AuditAction;
      entityType: string;
      entityId: string;
      metadata?: Record<string, AuditValue>;
    },
    repository: AuditRepository = repositories.audit,
    actor: Actor = currentActor(),
  ) {
    // Only explicit business metadata: never request bodies, tokens, prompts or written answers.
    await repository.append({
      actorId: actor.id,
      actorRole: actor.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: JSON.stringify(input.metadata ?? {}),
    });
  }
  static async list(limit = 100) {
    return (
      await repositories.audit.list(Math.min(200, Math.max(1, limit)))
    ).map((e) => ({
      ...e,
      timestamp: e.timestamp.toISOString(),
      metadata: JSON.parse(e.metadata),
    }));
  }
}
