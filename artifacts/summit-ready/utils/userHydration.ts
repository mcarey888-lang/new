export function createGenerationGuard() {
  let generation = 0;
  return {
    begin(): { generation: number; isCurrent: () => boolean } {
      const started = ++generation;
      return { generation: started, isCurrent: () => generation === started };
    },
    invalidate(): void {
      generation += 1;
    },
  };
}

export function canMigrateFlatData(
  userId: string,
  namespacedValue: string | null,
  migrationOwner: string | null,
): boolean {
  return !!userId && namespacedValue === null && (
    migrationOwner === null || migrationOwner === userId
  );
}

export const FLAT_MIGRATION_KEYS = [
  "summitready_goal",
  "summitready_training_goal",
  "summitready_expedition_goal",
  "summitready_sessions",
  "summitready_plan",
  "summitready_nearby_hills",
  "summitready_completed_plan_sessions",
  "summitready_assigned_hills",
  "summitready_adjust_note",
  "summitready_submitted_plan_sessions",
  "summitready_hills_in_plan",
  "summitready_session_reps",
  "summitready_session_efforts",
  "summitready_session_day_overrides",
  "summitready_has_viewed_plan",
  "summitready_achievements",
  "summitready_completed_goals",
  "summitready_app_mode",
  "summitready_shell_mode",
  "summitready_explore_hikes",
  "summitready_saved_trails",
  "summitready_completed_trails",
  "summitready_custom_routes",
  "summitready_my_hills",
  "summitready_excluded_my_hills",
  "summitready_expeditions",
  "summitready_active_expedition_id",
  "summitready_pending_past_hikes",
  "summitready_questionnaire_data",
] as const;

export const FLAT_MIGRATION_OWNER_KEY = "summitready_flat_migration_owner_v1";