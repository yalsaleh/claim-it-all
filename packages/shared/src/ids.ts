import { z } from 'zod';

/** Stable UUID identifier used for tenants, projects, users, and memberships. */
export const EntityIdSchema = z.string().uuid();

export type EntityId = z.infer<typeof EntityIdSchema>;

export const TenantIdSchema = EntityIdSchema.brand<'TenantId'>();
export type TenantId = z.infer<typeof TenantIdSchema>;

export const ProjectIdSchema = EntityIdSchema.brand<'ProjectId'>();
export type ProjectId = z.infer<typeof ProjectIdSchema>;

export const UserIdSchema = EntityIdSchema.brand<'UserId'>();
export type UserId = z.infer<typeof UserIdSchema>;

export function parseTenantId(value: string): TenantId {
  return TenantIdSchema.parse(value);
}

export function parseProjectId(value: string): ProjectId {
  return ProjectIdSchema.parse(value);
}

export function parseUserId(value: string): UserId {
  return UserIdSchema.parse(value);
}
