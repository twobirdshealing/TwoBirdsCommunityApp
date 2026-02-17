// =============================================================================
// API SERVICES - Barrel export
// =============================================================================

export * from './app';
export * from './calendar';
export * from './client';
export * from './comments';
export * from './emailPrefs';
export * from './feeds';
export * from './media';
export * from './members';
export * from './messages';
export * from './notifications';
export * from './otp';
export * from './profiles';
export * from './registration';
export * from './spaces';

// Also export the api objects for convenience
export { appApi } from './app';
export { default as calendarApi } from './calendar';
export { default as commentsApi } from './comments';
export { default as emailPrefsApi } from './emailPrefs';
export { default as feedsApi } from './feeds';
export { default as mediaApi } from './media';
export { default as membersApi } from './members';
export { default as messagesApi } from './messages';
export { default as notificationsApi } from './notifications';
export { default as otpApi } from './otp';
export { default as profilesApi } from './profiles';
export { default as registrationApi } from './registration';
export { default as spacesApi } from './spaces';
