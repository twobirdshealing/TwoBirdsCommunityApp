// =============================================================================
// API SERVICES - Barrel export
// =============================================================================

export * from './client';
export * from './feeds';
export * from './comments';
export * from './spaces';
export * from './profiles';
export * from './media';
export * from './calendar';
export * from './app';

// Also export the api objects for convenience
export { default as feedsApi } from './feeds';
export { default as commentsApi } from './comments';
export { default as spacesApi } from './spaces';
export { default as profilesApi } from './profiles';
export { default as mediaApi } from './media';
export { default as calendarApi } from './calendar';
export { appApi } from './app';
