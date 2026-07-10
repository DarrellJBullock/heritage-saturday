// Generates CSV/JSON fixtures for QA e2e suite. Run once with `node generate.mjs`.
// All names are 100% original fiction.
import fs from 'node:fs';
import path from 'node:path';

const POSITIONS = ['QB','RB','WR','TE','LT','LG','C','RG','RT','LE','RE','DT','LOLB','MLB','ROLB','CB','FS','SS','K','P'];

const FIRST_NAMES = ['Jax','Marlon','Dex','Corwin','Tobias','Reggie','Vance','Emil','Otis','Prescott','Lamar','Dashiell','Grover','Sully','Wyn','Barrett','Cole','Finch','Roscoe','Tate'];
const LAST_NAMES = ['Fenwick','Okoro','Baptiste','Voss','Kettering','Mbeki','Larkspur','Donahue','Quillan','Strand','Whitlock','Zayas','Ferro','Hargrove','Blaylock','Sandoval','Trent','Ashworth','Corbin','Delgado'];

function teamPlayers(teamId, startIdx) {
  return POSITIONS.map((pos, i) => ({
    sheet: 'players',
    team_id: teamId,
    player_id: `${teamId}-P${i + 1}`,
    first_name: FIRST_NAMES[(startIdx + i) % FIRST_NAMES.length],
    last_name: LAST_NAMES[(startIdx + i) % LAST_NAMES.length],
    position: pos,
    jersey_number: i + 1,
    overall_rating: 60 + (i % 35),
    archetype: '',
  }));
}

function teamsRows() {
  return [
    { sheet: 'teams', team_id: 'T1', team_name: 'Ridgeline Ramblers', abbreviation: 'RR', city: 'Ridgeline', state: 'CO' },
    { sheet: 'teams', team_id: 'T2', team_name: 'Cobalt Crest Coyotes', abbreviation: 'CCC', city: 'Cobalt Crest', state: 'AZ' },
  ];
}

const ALL_COLUMNS = ['sheet','team_id','team_name','abbreviation','city','state','player_id','first_name','last_name','position','jersey_number','overall_rating','archetype'];

function toCsv(rows) {
  const lines = [ALL_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(ALL_COLUMNS.map((c) => (row[c] ?? '')).join(','));
  }
  return lines.join('\n');
}

const outDir = path.dirname(new URL(import.meta.url).pathname);

// 1. Valid roster (CSV) — two full legal teams
const validRows = [...teamsRows(), ...teamPlayers('T1', 0), ...teamPlayers('T2', 7)];
fs.writeFileSync(path.join(outDir, 'valid-roster.csv'), toCsv(validRows));

// 2. Valid roster (JSON) — same content, JSON convention {sheet: [...]}
const validJson = {
  teams: teamsRows().map(({ sheet, ...r }) => r),
  players: [...teamPlayers('T1', 0), ...teamPlayers('T2', 7)].map(({ sheet, ...r }) => r),
};
fs.writeFileSync(path.join(outDir, 'valid-roster.json'), JSON.stringify(validJson, null, 2));

// 3. Missing required column: players row missing `position`
const missingColRows = [...teamsRows(), ...teamPlayers('T1', 0), ...teamPlayers('T2', 7)];
missingColRows.find((r) => r.sheet === 'players' && r.player_id === 'T1-P1').position = '';
fs.writeFileSync(path.join(outDir, 'missing-column.csv'), toCsv(missingColRows));

// 4. Duplicate player_id within players sheet
const dupPlayerIdRows = [...teamsRows(), ...teamPlayers('T1', 0), ...teamPlayers('T2', 7)];
dupPlayerIdRows.find((r) => r.sheet === 'players' && r.player_id === 'T1-P2').player_id = 'T1-P1';
fs.writeFileSync(path.join(outDir, 'duplicate-player-id.csv'), toCsv(dupPlayerIdRows));

// 5. Duplicate jersey number within same team_id
const dupJerseyRows = [...teamsRows(), ...teamPlayers('T1', 0), ...teamPlayers('T2', 7)];
dupJerseyRows.find((r) => r.sheet === 'players' && r.player_id === 'T1-P2').jersey_number = 1; // collides with T1-P1
fs.writeFileSync(path.join(outDir, 'duplicate-jersey.csv'), toCsv(dupJerseyRows));

// 6. Out-of-range rating + invalid position
const badRatingPosRows = [...teamsRows(), ...teamPlayers('T1', 0), ...teamPlayers('T2', 7)];
badRatingPosRows.find((r) => r.sheet === 'players' && r.player_id === 'T1-P3').overall_rating = 150;
badRatingPosRows.find((r) => r.sheet === 'players' && r.player_id === 'T1-P4').position = 'ZZ';
fs.writeFileSync(path.join(outDir, 'bad-rating-invalid-position.csv'), toCsv(badRatingPosRows));

// 7. Missing team_name (required Teams column)
const missingTeamNameRows = [...teamsRows(), ...teamPlayers('T1', 0), ...teamPlayers('T2', 7)];
missingTeamNameRows.find((r) => r.sheet === 'teams' && r.team_id === 'T2').team_name = '';
fs.writeFileSync(path.join(outDir, 'missing-team-name.csv'), toCsv(missingTeamNameRows));

// 8. Unsupported extension / corrupt content
fs.writeFileSync(path.join(outDir, 'corrupt.xlsx'), 'this is not a real xlsx file, just garbage bytes %%%');
fs.writeFileSync(path.join(outDir, 'unsupported.txt'), 'sheet,team_id\nteams,T1');

// 9. Unfillable roster: only a QB and RB for one team (missing 18 required positions)
const unfillableRows = [
  { sheet: 'teams', team_id: 'T3', team_name: 'Sparrow Hollow Wardens', abbreviation: 'SHW' },
  { sheet: 'players', team_id: 'T3', player_id: 'T3-P1', first_name: 'Dex', last_name: 'Fenwick', position: 'QB', jersey_number: 1, overall_rating: 80 },
  { sheet: 'players', team_id: 'T3', player_id: 'T3-P2', first_name: 'Otis', last_name: 'Voss', position: 'RB', jersey_number: 2, overall_rating: 75 },
];
fs.writeFileSync(path.join(outDir, 'unfillable-roster.csv'), toCsv(unfillableRows));

console.log('Fixtures generated in', outDir);
