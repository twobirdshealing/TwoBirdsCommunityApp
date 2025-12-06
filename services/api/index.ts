// =============================================================================
// API SERVICES - Barrel export
// =============================================================================
// This file re-exports all API services so you can do:
//   import { feedsApi, spacesApi, profilesApi } from '@/services/api';
// =============================================================================

export * from './client';
export * from './feeds';
export * from './comments';
export * from './spaces';
export * from './profiles';

// Also export the api objects for convenience
export { default as feedsApi } from './feeds';
export { default as commentsApi } from './comments';
export { default as spacesApi } from './spaces';
export { default as profilesApi } from './profiles';
