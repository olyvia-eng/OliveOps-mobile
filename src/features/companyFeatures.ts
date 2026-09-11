import type { CompanyFeatures, CompanyFeaturesInput } from '@/types/api';

export const DEFAULT_COMPANY_FEATURES: CompanyFeatures = Object.freeze({
  projects: true,
  recurringServices: true,
  snowOperations: false,
});

export function normalizeCompanyFeatures(features?: CompanyFeaturesInput): CompanyFeatures {
  return {
    projects: typeof features?.projects === 'boolean'
      ? features.projects
      : DEFAULT_COMPANY_FEATURES.projects,
    recurringServices: typeof features?.recurringServices === 'boolean'
      ? features.recurringServices
      : DEFAULT_COMPANY_FEATURES.recurringServices,
    snowOperations: typeof features?.snowOperations === 'boolean'
      ? features.snowOperations
      : DEFAULT_COMPANY_FEATURES.snowOperations,
  };
}