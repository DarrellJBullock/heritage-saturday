import { RowValidationResult } from './types';
import { isBlank, isRatingInRange, isValidPosition, toInt, toStr } from './fieldRules';

export function validatePlayerRow(raw: Record<string, unknown>): RowValidationResult {
  const messages: string[] = [];

  const playerId = toStr(raw.player_id);

  if (isBlank(raw.player_id)) messages.push('Missing required field: player_id');
  if (isBlank(raw.team_id)) messages.push('Missing required field: team_id');
  if (isBlank(raw.first_name)) messages.push('Missing required field: first_name');
  if (isBlank(raw.last_name)) messages.push('Missing required field: last_name');

  if (isBlank(raw.position)) {
    messages.push('Missing required field: position');
  } else if (!isValidPosition(raw.position)) {
    messages.push('Invalid position: not a recognized position code');
  }

  if (isBlank(raw.jersey_number)) {
    messages.push('Missing required field: jersey_number');
  } else if (toInt(raw.jersey_number) === null) {
    messages.push('jersey_number must be an integer');
  }

  if (isBlank(raw.overall_rating)) {
    messages.push('Missing required field: overall_rating');
  } else if (!isRatingInRange(raw.overall_rating)) {
    messages.push('overall_rating must be between 0 and 99');
  }

  return {
    status: messages.length > 0 ? 'ERROR' : 'OK',
    messages,
    entityRefId: playerId || null,
  };
}

export function validateTeamRow(raw: Record<string, unknown>): RowValidationResult {
  const messages: string[] = [];
  const teamId = toStr(raw.team_id);

  if (isBlank(raw.team_id)) messages.push('Missing required field: team_id');
  if (isBlank(raw.team_name)) messages.push('Missing required field: team_name');

  return {
    status: messages.length > 0 ? 'ERROR' : 'OK',
    messages,
    entityRefId: teamId || null,
  };
}

export function validateCoachRow(raw: Record<string, unknown>): RowValidationResult {
  const messages: string[] = [];
  const coachId = toStr(raw.coach_id);
  const teamId = toStr(raw.team_id);

  if (isBlank(raw.coach_id)) messages.push('Missing required field: coach_id');
  if (isBlank(raw.team_id)) messages.push('Missing required field: team_id');
  if (isBlank(raw.first_name)) messages.push('Missing required field: first_name');
  if (isBlank(raw.last_name)) messages.push('Missing required field: last_name');

  return {
    status: messages.length > 0 ? 'ERROR' : 'OK',
    messages,
    entityRefId: coachId || teamId || null,
  };
}

export function validateDepthChartRow(raw: Record<string, unknown>): RowValidationResult {
  const messages: string[] = [];

  if (isBlank(raw.team_id)) messages.push('Missing required field: team_id');
  if (isBlank(raw.player_id)) messages.push('Missing required field: player_id');
  if (isBlank(raw.position)) {
    messages.push('Missing required field: position');
  } else if (!isValidPosition(raw.position)) {
    messages.push('Invalid position: not a recognized position code');
  }
  if (isBlank(raw.slot)) {
    messages.push('Missing required field: slot');
  } else if (toInt(raw.slot) === null) {
    messages.push('slot must be an integer');
  }

  return {
    status: messages.length > 0 ? 'ERROR' : 'OK',
    messages,
    entityRefId: null,
  };
}
