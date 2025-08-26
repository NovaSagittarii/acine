import {
  Routine_RequirementType,
  Routine_SchedulingGroup_Period as Period,
} from 'acine-proto-dist';

export const REQUIREMENT_TYPE_DISPLAY = [
  ['unset', Routine_RequirementType.REQUIREMENT_TYPE_UNSPECIFIED],
  ['check', Routine_RequirementType.REQUIREMENT_TYPE_CHECK],
  ['check pass', Routine_RequirementType.REQUIREMENT_TYPE_CHECK_PASS],
  ['execute', Routine_RequirementType.REQUIREMENT_TYPE_EXECUTE],
  ['completion', Routine_RequirementType.REQUIREMENT_TYPE_COMPLETION],
] as [string, Routine_RequirementType][];

export const PERIOD_DISPLAY = [
  ['manual', Period.PERIOD_UNSPECIFIED],
  ['daily', Period.PERIOD_DAILY],
  ['weekly', Period.PERIOD_WEEKLY],
  ['biweekly', Period.PERIOD_BIWEEKLY],
  ['monthly', Period.PERIOD_MONTHLY],
] as [string, Period][];
