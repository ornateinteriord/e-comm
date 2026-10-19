import { SearchIndexEvent } from '../models/search-index-event.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('search-event');

export async function emitSearchEvent(
  productId: string,
  action: 'upsert' | 'delete',
): Promise<void> {
  try {
    await SearchIndexEvent.create({ productId, action });
    log.debug({ productId, action }, 'Search index event created');
  } catch (err) {
    // Non-fatal: log but don't fail the product operation
    log.error({ err, productId, action }, 'Failed to create search index event');
  }
}
