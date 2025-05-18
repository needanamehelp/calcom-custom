import { useSession } from "next-auth/react";
import { useContext } from "react";

import { InsightsOrgTeamsContext } from "../context/InsightsOrgTeamsProvider";

export function useInsightsOrgTeams() {
  const context = useContext(InsightsOrgTeamsContext);
  if (!context) {
    throw new Error("useInsightsOrgTeams must be used within a InsightsOrgTeamsProvider");
  }
  const session = useSession();
  const currentUserId = session.data?.user.id;
  const currentOrgId = session.data?.user.org?.id;
  const { orgTeamsType, selectedTeamId, setOrgTeamsType, setSelectedTeamId } = context;

  // FIXED: Set isAll only when it's an org view AND the user is in an org
  const isAll = orgTeamsType === "org" && !!currentOrgId;
  
  // FIXED: Set teamId only for team views and org views
  const teamId = orgTeamsType === "org" ? currentOrgId : orgTeamsType === "team" ? selectedTeamId : undefined;
  
  // FIXED: Always include userId for individual users AND in "yours" view
  // This ensures individual users (without teams) always see their own data
  const userId = !teamId || orgTeamsType === "yours" ? currentUserId : undefined;

  return {
    orgTeamsType,
    setOrgTeamsType,
    selectedTeamId,
    setSelectedTeamId,
    isAll,
    teamId,
    userId,
  };
}
