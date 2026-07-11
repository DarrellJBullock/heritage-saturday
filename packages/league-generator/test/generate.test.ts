import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_STARTING_POSITIONS, LEAGUE_SIZES } from '@heritage-saturday/shared';
import { generateLeague } from '../src/index';
import {
  TEAM_NICKNAMES,
  CITY_NAMES,
  CONFERENCE_NAMES,
  CLASSIC_GAME_NAMES,
} from '../src/data';

test('deterministic: same seed yields an identical league', () => {
  const a = generateLeague({ templateKey: 'heritage', size: 8, seed: 'seed-xyz' });
  const b = generateLeague({ templateKey: 'heritage', size: 8, seed: 'seed-xyz' });
  assert.deepEqual(a, b);
});

test('different seeds yield different leagues', () => {
  const a = generateLeague({ templateKey: 'heritage', size: 8, seed: 'seed-1' });
  const b = generateLeague({ templateKey: 'heritage', size: 8, seed: 'seed-2' });
  assert.notDeepEqual(a, b);
});

for (const size of LEAGUE_SIZES) {
  test(`size ${size}: produces exactly ${size} uniquely-named teams`, () => {
    const league = generateLeague({ templateKey: 'heritage', size, seed: `s-${size}` });
    assert.equal(league.teams.length, size);
    const names = new Set(league.teams.map((t) => t.name));
    assert.equal(names.size, size, 'team names must be unique');
  });

  test(`size ${size}: every team covers all required starting positions`, () => {
    const league = generateLeague({ templateKey: 'heritage', size, seed: `s-${size}` });
    for (const team of league.teams) {
      const positions = new Set(team.players.map((p) => p.position));
      for (const required of REQUIRED_STARTING_POSITIONS) {
        assert.ok(
          positions.has(required),
          `team ${team.name} is missing required position ${required}`,
        );
      }
    }
  });

  test(`size ${size}: jersey numbers are unique within each team`, () => {
    const league = generateLeague({ templateKey: 'heritage', size, seed: `s-${size}` });
    for (const team of league.teams) {
      const jerseys = team.players.map((p) => p.jerseyNumber);
      assert.equal(new Set(jerseys).size, jerseys.length, `duplicate jersey in ${team.name}`);
    }
  });

  test(`size ${size}: every team has a conference and division`, () => {
    const league = generateLeague({ templateKey: 'heritage', size, seed: `s-${size}` });
    for (const team of league.teams) {
      assert.ok(team.conference.length > 0);
      assert.ok(team.division.length > 0);
    }
  });
}

test('overall ratings are in a sane range and drive a legal starter per position', () => {
  const league = generateLeague({ templateKey: 'heritage', size: 8, seed: 'ratings' });
  for (const team of league.teams) {
    for (const p of team.players) {
      assert.ok(p.overallRating >= 40 && p.overallRating <= 99, `bad rating ${p.overallRating}`);
    }
  }
});

for (const size of LEAGUE_SIZES) {
  test(`size ${size}: every team has a band and exactly one symmetric rival`, () => {
    const league = generateLeague({ templateKey: 'heritage', size, seed: `bands-${size}` });
    league.teams.forEach((team, i) => {
      assert.ok(team.band.name && team.band.style && team.band.chant && team.band.tradition,
        `team ${i} missing band fields`);
      const j = team.rivalIndex;
      assert.ok(j >= 0 && j < size && j !== i, `team ${i} has an invalid rival ${j}`);
      assert.equal(league.teams[j].rivalIndex, i, `rivalry ${i}<->${j} is not symmetric`);
      // Rivals share a division and a classic-game name.
      assert.equal(league.teams[j].division, team.division, `rivals ${i},${j} in different divisions`);
      assert.equal(league.teams[j].classicGameName, team.classicGameName, `rivals ${i},${j} disagree on classic game`);
    });
    // Every team is paired exactly once (no team is left out).
    const partnered = new Set(league.teams.map((_, i) => i));
    assert.equal(partnered.size, size);
  });
}

// Brand safety (company-docs/vision.md rule, which overrides everything): none of the generated
// identity strings may collide with the real institutions the rule names. This guards against a
// future edit to the banks reintroducing one; the current banks are all original fiction.
test('brand safety: no generated name collides with a real-institution denylist', () => {
  // Real HBCU mascots, conferences, and school-name tokens the rule forbids.
  const DENYLIST = [
    'tigers', 'rattlers', 'bison', 'aggies', 'eagles', 'hornets', 'panthers', 'bulldogs',
    'golden lions', 'wildcats', 'bears', 'delta devils', 'jaguars', 'pirates', 'braves',
    'rams', 'broncos', 'mountaineers', 'gators', 'blue tigers', 'lions',
    'swac', 'meac', 'ciaa', 'siac', 'grambling', 'howard', 'jackson', 'southern',
    'prairie view', 'alcorn', 'hampton', 'morehouse', 'spelman', 'tuskegee', 'famu',
    // Real marching bands / their signatures — forbidden for the generated bands.
    'sonic boom', 'marching 100', 'aristocrat', 'human jukebox', 'marching storm',
    'blue and gold marching machine', 'marching wildcats', 'ocean of soul',
  ];
  const single = DENYLIST.filter((t) => !t.includes(' '));
  const phrases = DENYLIST.filter((t) => t.includes(' '));

  // Match whole words / phrases, not incidental substrings: "Stallions" must not trip on the
  // mascot "Lions". Word-boundary matching is the right brand-safety semantics.
  const collides = (value: string): string | null => {
    const words = new Set(value.toLowerCase().split(/[^a-z]+/).filter(Boolean));
    for (const term of single) if (words.has(term)) return term;
    for (const term of phrases) if (value.toLowerCase().includes(term)) return term;
    return null;
  };

  for (const value of [...TEAM_NICKNAMES, ...CITY_NAMES, ...CONFERENCE_NAMES, ...CLASSIC_GAME_NAMES]) {
    const hit = collides(value);
    assert.equal(hit, null, `name bank entry "${value}" collides with denylisted "${hit}"`);
  }

  // And check the actual generated output across the largest preset, including bands.
  const league = generateLeague({ templateKey: 'heritage', size: 54, seed: 'brand' });
  for (const team of league.teams) {
    const hay = `${team.name} ${team.conference} ${team.division} ${team.band.name} ${team.band.style} ${team.band.tradition} ${team.classicGameName}`;
    const hit = collides(hay);
    assert.equal(hit, null, `generated "${team.name}" collides with denylisted "${hit}"`);
  }
});
