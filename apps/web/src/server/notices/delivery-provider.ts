import {
  assertDeliveryProviderAllowed,
  createNoticeDeliveryProvider,
  type NoticeDeliveryProvider,
} from '@contractradar/notice-delivery';
import { validationError } from '@/server/errors';

/** Web adapter for notice delivery providers (Slice 7). */
export function getNoticeDeliveryProvider(): NoticeDeliveryProvider | null {
  const provider = createNoticeDeliveryProvider({
    NOTICE_DELIVERY_PROVIDER: process.env.NOTICE_DELIVERY_PROVIDER,
    APP_ENV: process.env.APP_ENV ?? process.env.NODE_ENV,
  });
  if (provider) {
    assertDeliveryProviderAllowed(provider, process.env.APP_ENV ?? process.env.NODE_ENV);
  }
  return provider;
}

export function requireAutomatedDeliveryProvider(): NoticeDeliveryProvider {
  const provider = getNoticeDeliveryProvider();
  if (!provider) {
    throw validationError(
      'NOTICE_DELIVERY_PROVIDER must be fake or local_capture for automated send in this environment',
    );
  }
  return provider;
}
