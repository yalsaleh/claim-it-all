import { createHmac, timingSafeEqual } from 'node:crypto';
import { EntityIdSchema } from '@contractradar/shared';

export function signTenantId(tenantId: string, secret: string): string {
  const parsed = EntityIdSchema.parse(tenantId);
  const sig = createHmac('sha256', secret).update(parsed).digest('base64url');
  return `${parsed}.${sig}`;
}

export function verifySignedTenantValue(raw: string, secret: string): string | null {
  const lastDot = raw.lastIndexOf('.');
  if (lastDot <= 0) {
    return null;
  }
  const tenantId = raw.slice(0, lastDot);
  const provided = raw.slice(lastDot + 1);
  const parsed = EntityIdSchema.safeParse(tenantId);
  if (!parsed.success || !provided) {
    return null;
  }
  const expected = createHmac('sha256', secret).update(parsed.data).digest('base64url');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  return parsed.data;
}
