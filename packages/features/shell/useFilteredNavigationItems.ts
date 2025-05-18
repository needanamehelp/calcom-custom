import { UserPermissionRole } from "@calcom/prisma/enums";

import type { NavigationItemType } from "./navigation/NavigationItem";

/**
 * Filter navigation items based on user role
 * Only admins can see Teams, Routing, Workflows, and Insights
 */
export const filterNavigationItemsByRole = (
  navigationItems: NavigationItemType[],
  userRole?: UserPermissionRole | 'INACTIVE_ADMIN' | null
): NavigationItemType[] => {
  const isAdmin = userRole === UserPermissionRole.ADMIN;

  // For admin users, return all navigation items
  if (isAdmin) {
    return navigationItems;
  }

  // For regular users, filter out restricted items
  return navigationItems
    .filter((item) => {
      // Hide Teams, Routing, Workflows, and Insights for non-admin users
      if (
        item.name === "teams" ||
        item.name === "routing" ||
        item.name === "workflows" 
      ) {
        return false;
      }

      return true;
    });
};
