import { PROJECT_ROLES, PROJECT_STATUSES } from '@contractradar/authz';
import { EntityIdSchema } from '@contractradar/shared';
import { z } from 'zod';

export const CreateProjectInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(/^[A-Z0-9][A-Z0-9-_]*$/, 'Project code must be uppercase alphanumeric'),
    description: z.string().trim().max(2000).optional(),
    countryCode: z
      .string()
      .trim()
      .length(2)
      .regex(/^[A-Z]{2}$/, 'countryCode must be ISO-3166 alpha-2'),
    defaultCurrency: z
      .string()
      .trim()
      .length(3)
      .regex(/^[A-Z]{3}$/, 'defaultCurrency must be ISO-4217'),
    timezone: z.string().trim().min(3).max(64),
    status: z.enum(PROJECT_STATUSES).optional(),
  })
  .strict();

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const UpdateProjectInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    countryCode: z
      .string()
      .trim()
      .length(2)
      .regex(/^[A-Z]{2}$/)
      .optional(),
    defaultCurrency: z
      .string()
      .trim()
      .length(3)
      .regex(/^[A-Z]{3}$/)
      .optional(),
    timezone: z.string().trim().min(3).max(64).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

export const AddProjectMemberInputSchema = z
  .object({
    userId: EntityIdSchema.or(z.string().cuid()),
    role: z.enum(PROJECT_ROLES),
  })
  .strict();

export type AddProjectMemberInput = z.infer<typeof AddProjectMemberInputSchema>;

export const SelectTenantInputSchema = z
  .object({
    tenantId: EntityIdSchema,
  })
  .strict();
