const CATEGORY_TRANSLATION_UPDATED_EVENT = 'admin-category-translations-updated';
const CATEGORY_TRANSLATION_CHANNEL = 'admin-category-translations';

let channel;

const getChannel = () => {
  if (
    !channel &&
    typeof window !== 'undefined' &&
    typeof window.BroadcastChannel === 'function'
  ) {
    channel = new window.BroadcastChannel(CATEGORY_TRANSLATION_CHANNEL);
  }
  return channel;
};

export const emitCategoryTranslationUpdate = (detail = {}) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(CATEGORY_TRANSLATION_UPDATED_EVENT, { detail }));
};

export const broadcastCategoryTranslationUpdate = (detail = {}) => {
  if (typeof window === 'undefined') return;

  emitCategoryTranslationUpdate(detail);
  getChannel()?.postMessage({
    type: CATEGORY_TRANSLATION_UPDATED_EVENT,
    detail,
  });
};

export const subscribeToCategoryTranslationUpdates = (handler) => {
  if (typeof window === 'undefined') return () => {};

  const handleLocalUpdate = (event) => handler(event.detail || {});
  window.addEventListener(CATEGORY_TRANSLATION_UPDATED_EVENT, handleLocalUpdate);

  const browserChannel = getChannel();
  const handleCrossTabUpdate = (event) => {
    if (event.data?.type === CATEGORY_TRANSLATION_UPDATED_EVENT) {
      handler(event.data.detail || {});
    }
  };
  browserChannel?.addEventListener('message', handleCrossTabUpdate);

  return () => {
    window.removeEventListener(CATEGORY_TRANSLATION_UPDATED_EVENT, handleLocalUpdate);
    browserChannel?.removeEventListener('message', handleCrossTabUpdate);
  };
};