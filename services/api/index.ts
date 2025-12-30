// =============================================================================
// API SERVICES - Barrel export
// =============================================================================

export * from './app';
export * from './calendar';
export * from './client';
export * from './comments';
export * from './feeds';
export * from './media';
export * from './notifications';
export * from './profiles';
export * from './spaces';

// Also export the api objects for convenience
export { appApi } from './app';
export { default as calendarApi } from './calendar';
export { default as commentsApi } from './comments';
export { default as feedsApi } from './feeds';
export { default as mediaApi } from './media';
export { default as notificationsApi } from './notifications';
export { default as profilesApi } from './profiles';
export { default as spacesApi } from './spaces';
