// Curated static name banks — 100% original fiction (company-docs/vision.md brand-safety rule,
// which overrides everything). None of these are real HBCU (or professional) team names,
// mascots, cities-as-identity, or conferences. The denylist in test/generate.test.ts guards
// against the specific real institutions the rule names; keep this authored, not procedural, so
// it stays reviewable.
//
// Authored as TS arrays rather than JSON so the package needs no JSON-module resolution config.

// 60 original mascots — enough to give the 54-team preset unique nicknames with headroom.
export const TEAM_NICKNAMES = [
  'Sentinels', 'Vanguards', 'Monarchs', 'Aviators', 'Pioneers', 'Gryphons',
  'Comets', 'Voyagers', 'Ironsides', 'Nighthawks', 'Renegades', 'Tempest',
  'Stags', 'Coyotes', 'Cobras', 'Vipers', 'Scorpions', 'Mustangs',
  'Stallions', 'Blazers', 'Cyclones', 'Thunderbirds', 'Meteors', 'Sabers',
  'Crusaders', 'Templars', 'Wardens', 'Marauders', 'Corsairs', 'Admirals',
  'Anchors', 'Cascades', 'Summits', 'Timberjacks', 'Prospectors', 'Foundrymen',
  'Ironworkers', 'Steamers', 'Locomotives', 'Railers', 'Aces', 'Drovers',
  'Wranglers', 'Homesteaders', 'Outriders', 'Nomads', 'Wayfarers', 'Navigators',
  'Beacons', 'Gales', 'Squalls', 'Monsoons', 'Zephyrs', 'Drifters',
  'Wanderers', 'Kestrels', 'Ospreys', 'Falconers', 'Harriers', 'Lancers',
] as const;

// 60 generic, invented-sounding town names (not real HBCU cities-as-identity).
export const CITY_NAMES = [
  'Riverton', 'Lakeside', 'Hillcrest', 'Oakmont', 'Maple Ridge', 'Cedar Hollow',
  'Fair Haven', 'Stonebridge', 'Brookfield', 'Elmwood', 'Fairview', 'Glenwood',
  'Ashmoor', 'Kingsford', 'Westbrook', 'Northgate', 'Southport', 'Easthaven',
  'Redwood', 'Silverton', 'Goldvale', 'Ironvale', 'Clearbrook', 'Springdale',
  'Summerhill', 'Winterport', 'Autumnvale', 'Grandview', 'Highridge', 'Millbrook',
  'Pinevale', 'Bayside', 'Harborview', 'Crestwood', 'Brightwater', 'Fallbrook',
  'Meadowbrook', 'Sunridge', 'Moonvale', 'Starhaven', 'Cliffside', 'Rockvale',
  'Sandhaven', 'Foxglen', 'Deer Hollow', 'Thornbury', 'Briarwood', 'Whitfield',
  'Blackwood', 'Graystone', 'Emberton', 'Frostvale', 'Larkspur', 'Marigold',
  'Juniper', 'Sagebrook', 'Willowdale', 'Bramblewood', 'Copperfield', 'Amberton',
] as const;

// Fictional conference names. A preset uses as many as its division layout needs.
export const CONFERENCE_NAMES = [
  'Heritage Conference',
  'Liberty Conference',
  'Coastal Conference',
  'Frontier Conference',
  'Summit Conference',
  'Highland Conference',
] as const;

// Directional division names — generic geography, not tied to any real league.
export const DIVISION_NAMES = ['North', 'South', 'East', 'West'] as const;

export const FIRST_NAMES = [
  'James', 'Marcus', 'Andre', 'Terrance', 'Devon', 'Isaiah', 'Malik', 'Xavier',
  'Darnell', 'Elijah', 'Julian', 'Trevon', 'Cameron', 'Jamal', 'Darius', 'Antoine',
  'Reggie', 'Maurice', 'Damon', 'Keshawn', 'Lamar', 'Rashad', 'Tyrell', 'Jarrett',
  'Deshawn', 'Cordell', 'Emmanuel', 'Solomon', 'Micah', 'Nathaniel', 'Josiah', 'Amari',
  'Quincy', 'Roman', 'Sterling', 'Vernon', 'Wesley', 'Zaire', 'Brandon', 'Caleb',
] as const;

export const LAST_NAMES = [
  'Carter', 'Robinson', 'Coleman', 'Freeman', 'Jefferson', 'Brooks', 'Hayes', 'Bryant',
  'Dawson', 'Ellison', 'Franklin', 'Grady', 'Holloway', 'Ingram', 'Jennings', 'Kingston',
  'Lawson', 'Mercer', 'Nolan', 'Overton', 'Prescott', 'Quarles', 'Randolph', 'Sanders',
  'Tatum', 'Underwood', 'Vance', 'Whitaker', 'Youngblood', 'Ashby', 'Boone', 'Chandler',
  'Dixon', 'Everett', 'Fontaine', 'Gaines', 'Harmon', 'Isley', 'Jamison', 'Kirkland',
  'Langston', 'Monroe', 'Norwood', 'Osborne', 'Pruitt', 'Rhodes', 'Stovall', 'Thornton',
  'Vaughn', 'Waverly',
] as const;

// --- Marching bands (100% original fiction — NOT any real HBCU band, name, or tradition) ---
// The band name is composed from the team's nickname + one of these ensemble words.
export const BAND_ENSEMBLE_WORDS = [
  'Marching Brigade', 'Sound Corps', 'Cadence Legion', 'Show Band', 'Drumline Company',
  'Marching Regiment', 'Brass Battalion', 'Rhythm Corps', 'Field Ensemble', 'Marching Order',
] as const;

export const BAND_STYLES = [
  'high-energy show style with a heavy brass front',
  'precision military drill',
  'funk-forward street cadence',
  'fast-break dance-battle style',
  'thunderous drumline-led attack',
  'smooth ballad-and-swing showmanship',
] as const;

export const BAND_CHANTS = [
  'Hold the line, sound the horn!',
  'Louder in the fourth!',
  'One beat, one heart!',
  'Turn it up, bring it home!',
  'From the tunnel to the end zone!',
  'Feel the drum, raise the roof!',
] as const;

export const BAND_TRADITIONS = [
  'a fifth-quarter standoff after every home game',
  'a torch-lit march to the stadium on rivalry week',
  'a call-and-response with the student section at every kickoff',
  'a silent drumline entrance that erupts at midfield',
  'a homecoming serenade of the senior class',
  'a pregame tunnel walk timed to a single bass cadence',
] as const;

// Original names for the annual rivalry game. No real classic/bowl names.
export const CLASSIC_GAME_NAMES = [
  'The Delta Duel', 'The Ironclad Classic', 'The Harbor Rivalry', 'The Legacy Bowl-Out',
  'The Coastal Clash', 'The Founders Feud', 'The Heritage Standoff', 'The Frontier Fracas',
  'The Summit Showdown', 'The Tidewater Tussle', 'The Copper Cup', 'The Magnolia Meeting',
  'The Gaslight Grudge', 'The Anchor Rivalry', 'The Highland Reckoning', 'The Cedar Classic',
] as const;

// [primary, secondary] hex pairs — original palettes, no real team branding.
export const COLOR_PAIRS: readonly [string, string][] = [
  ['#1B3A5B', '#F2A900'], ['#7A1F2B', '#E8D9B5'], ['#0E4D3C', '#C9A227'],
  ['#2E1A47', '#B497D6'], ['#123C69', '#AC3B61'], ['#3B2F2F', '#D4A017'],
  ['#004E64', '#25A18E'], ['#5C1A1B', '#C0A062'], ['#22333B', '#EAE0D5'],
  ['#40233F', '#F0A868'], ['#0B3D2E', '#F4B860'], ['#4A1D2E', '#9DB4C0'],
  ['#1D2F4E', '#E4B363'], ['#3E2723', '#8D6E63'], ['#14342B', '#C6AC8F'],
  ['#5B2333', '#D8B08C'], ['#213A57', '#A2D2FF'], ['#432818', '#CB997E'],
  ['#2C365E', '#E9C46A'], ['#4E3620', '#B08968'],
];
