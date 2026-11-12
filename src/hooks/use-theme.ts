/**
 * Theme hook - returns theme colors dynamically synchronized with the active organization's brand primary color.
 */

import { Colors } from '@/constants/theme';
import { useTenant } from '@/context/TenantContext';
import { useMemo } from 'react';

export function useTheme() {
  let tenantPrimary: string | undefined;
  try {
    const tenant = useTenant();
    tenantPrimary = tenant.primaryColor;
  } catch {
    // Outside TenantProvider, gracefully fallback
  }

  return useMemo(() => {
    if (!tenantPrimary) return Colors.light;
    return {
      ...Colors.light,
      primary: tenantPrimary,
      primaryForeground: '#FFFFFF',
      primaryDark: tenantPrimary,
      primaryLight: `${tenantPrimary}18`,
      accent: tenantPrimary,
    };
  }, [tenantPrimary]);
}

