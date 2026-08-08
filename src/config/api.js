/**
 * Centralized API configuration for OliveOps Mobile.
 *
 * The production base URL is the single source of truth for all API calls.
 * Do not hard-code this URL anywhere else in the codebase.
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.oliveops.ca';

export default API_BASE_URL;
