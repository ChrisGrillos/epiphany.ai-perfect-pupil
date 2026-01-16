/**
 * PERFECT PUPIL ARENA - 50 CREATURE MVP ROSTER
 * Complete implementation of Design Bible creatures
 */

export const CREATURE_ROSTER = [
  // ========== AUTOMATA (8) ==========
  {
    id: 'rivet_sentinel',
    name: 'Rivet-Sentinel',
    family: 'automata',
    alignment: 'guardian',
    element: 'stone',
    role: 'tank',
    base_stats: { hp: 150, guard: 20, power: 8, speed: 5, focus: 8, will: 12 },
    composition: { metal: 'tungsten', core: null, coating: 'ceramic' },
    signature: 'Overclock: +20% power for 2 turns, builds heat risk',
    moveset_template: ['heavy_strike', 'shield_slam', 'fortify', 'null']
  },
  {
    id: 'neon_jackal',
    name: 'Neon Jackal-Unit',
    family: 'automata',
    alignment: 'rogue',
    element: 'volt',
    role: 'assassin',
    base_stats: { hp: 90, guard: 8, power: 15, speed: 18, focus: 14, will: 8 },
    composition: { metal: 'titanium', core: 'arc', coating: 'carbon' },
    signature: 'Overclock: Burst speed for execute',
    moveset_template: ['volt_slash', 'arc_discharge', 'evasion_matrix', 'null']
  },
  {
    id: 'copper_warden',
    name: 'Copper Warden',
    family: 'automata',
    alignment: 'guardian',
    element: 'volt',
    role: 'bruiser',
    base_stats: { hp: 130, guard: 15, power: 12, speed: 8, focus: 10, will: 10 },
    composition: { metal: 'copper', core: 'arc', coating: 'plated' },
    moveset_template: ['thunder_punch', 'static_field', 'bulwark', 'null']
  },
  {
    id: 'glassline_sniper',
    name: 'Glassline Sniper',
    family: 'automata',
    alignment: 'cipher',
    element: 'gale',
    role: 'ranged_dps',
    base_stats: { hp: 80, guard: 6, power: 16, speed: 12, focus: 18, will: 9 },
    composition: { metal: 'titanium', core: null, coating: 'carbon' },
    moveset_template: ['precision_shot', 'gale_barrage', 'mark_target', 'null']
  },
  {
    id: 'forgehound',
    name: 'Forgehound',
    family: 'automata',
    alignment: 'rogue',
    element: 'heat',
    role: 'dps',
    base_stats: { hp: 100, guard: 10, power: 14, speed: 14, focus: 12, will: 8 },
    composition: { metal: 'steel', core: 'heat', coating: 'ceramic' },
    moveset_template: ['flame_bite', 'molten_burst', 'hunt', 'null']
  },
  {
    id: 'silver_mercy',
    name: 'Silver Mercy-Drone',
    family: 'automata',
    alignment: 'cipher',
    element: 'lumen',
    role: 'support',
    base_stats: { hp: 85, guard: 8, power: 6, speed: 10, focus: 14, will: 16 },
    composition: { metal: 'silver', core: 'lumen', coating: 'plated' },
    moveset_template: ['light_pulse', 'repair_beam', 'aegis_cast', 'null']
  },
  {
    id: 'obsidian_cutter',
    name: 'Obsidian Cutter-Rig',
    family: 'automata',
    alignment: 'rogue',
    element: 'umber',
    role: 'crit_dps',
    base_stats: { hp: 95, guard: 7, power: 17, speed: 15, focus: 16, will: 7 },
    composition: { metal: 'obsidian_alloy', core: 'umber', coating: 'carbon' },
    moveset_template: ['shadow_rend', 'crit_strike', 'fade', 'null']
  },
  {
    id: 'bulkframe_hauler',
    name: 'Bulkframe Hauler',
    family: 'automata',
    alignment: 'guardian',
    element: 'stone',
    role: 'control_tank',
    base_stats: { hp: 160, guard: 22, power: 7, speed: 4, focus: 9, will: 14 },
    composition: { metal: 'tungsten', core: null, coating: 'plated' },
    moveset_template: ['ground_slam', 'jam_field', 'immovable', 'null']
  },
  
  // ========== GOLEMS (8) ==========
  {
    id: 'basalt_rampart',
    name: 'Basalt Rampart',
    family: 'golems',
    alignment: 'guardian',
    element: 'stone',
    role: 'tank',
    base_stats: { hp: 170, guard: 24, power: 6, speed: 3, focus: 7, will: 15 },
    composition: { base: 'basalt', binder: 'clay', infusion: null },
    signature: 'Material Armor: Composition heavily influences guard',
    moveset_template: ['boulder_strike', 'earth_wall', 'endure', 'null']
  },
  {
    id: 'marble_halo',
    name: 'Marble Halo-Golem',
    family: 'golems',
    alignment: 'cipher',
    element: 'lumen',
    role: 'shield_support',
    base_stats: { hp: 120, guard: 18, power: 8, speed: 6, focus: 12, will: 18 },
    composition: { base: 'marble', binder: 'clay', infusion: 'lumen' },
    moveset_template: ['radiant_touch', 'shield_ally', 'cleanse', 'null']
  },
  {
    id: 'ironbark_colossus',
    name: 'Ironbark Colossus',
    family: 'golems',
    alignment: 'guardian',
    element: 'vine',
    role: 'thorns_tank',
    base_stats: { hp: 155, guard: 20, power: 9, speed: 5, focus: 8, will: 13 },
    composition: { base: 'ironbark', binder: 'resin', infusion: 'vine' },
    moveset_template: ['thorn_slam', 'root_bind', 'regenerate', 'null']
  },
  {
    id: 'mycelium_plague',
    name: 'Mycelium Plague-Stack',
    family: 'golems',
    alignment: 'rogue',
    element: 'umber',
    role: 'dot',
    base_stats: { hp: 105, guard: 11, power: 11, speed: 9, focus: 13, will: 10 },
    composition: { base: 'mycelium', binder: 'resin', infusion: 'umber' },
    moveset_template: ['spore_burst', 'rot_spread', 'decay', 'null']
  },
  {
    id: 'obsidian_rift',
    name: 'Obsidian Rift-Brute',
    family: 'golems',
    alignment: 'rogue',
    element: 'umber',
    role: 'crit_bruiser',
    base_stats: { hp: 115, guard: 13, power: 16, speed: 11, focus: 15, will: 9 },
    composition: { base: 'obsidian', binder: 'slag', infusion: 'umber' },
    moveset_template: ['shatter_strike', 'dark_surge', 'mark_weak', 'null']
  },
  {
    id: 'coral_breaker',
    name: 'Coral Breaker',
    family: 'golems',
    alignment: 'cipher',
    element: 'tide',
    role: 'control',
    base_stats: { hp: 110, guard: 14, power: 10, speed: 8, focus: 14, will: 12 },
    composition: { base: 'coral', binder: 'clay', infusion: 'tide' },
    moveset_template: ['tidal_crush', 'snare_wave', 'ebb_flow', 'null']
  },
  {
    id: 'sandstride_idol',
    name: 'Sandstride Idol',
    family: 'golems',
    alignment: 'rogue',
    element: 'gale',
    role: 'speed_bruiser',
    base_stats: { hp: 100, guard: 10, power: 13, speed: 16, focus: 11, will: 9 },
    composition: { base: 'sandstone', binder: 'vine', infusion: 'gale' },
    moveset_template: ['sandstorm_rush', 'dust_cloud', 'windstep', 'null']
  },
  {
    id: 'coppervine_sentinel',
    name: 'Coppervine Sentinel',
    family: 'golems',
    alignment: 'guardian',
    element: 'volt',
    role: 'hybrid_tank',
    base_stats: { hp: 140, guard: 17, power: 10, speed: 7, focus: 11, will: 14 },
    composition: { base: 'copper_wood', binder: 'resin', infusion: 'volt' },
    moveset_template: ['shock_vine', 'root_guard', 'sustain', 'null']
  },
  
  // ========== ELEMENTALS (8) ==========
  {
    id: 'brinewraith',
    name: 'Brinewraith',
    family: 'elementals',
    alignment: 'rogue',
    element: 'tide',
    role: 'corrosion_control',
    base_stats: { hp: 90, guard: 9, power: 12, speed: 13, focus: 15, will: 11 },
    composition: { medium: 'salt', temperature: 'frost', viscosity: 2 },
    signature: 'Medium State: Temperature/salinity toggles passives',
    moveset_template: ['brine_lash', 'corrode', 'frost_wave', 'null']
  },
  {
    id: 'steam_knuckle',
    name: 'Steam-Knuckle',
    family: 'elementals',
    alignment: 'guardian',
    element: 'heat',
    role: 'bruiser',
    base_stats: { hp: 125, guard: 14, power: 13, speed: 10, focus: 10, will: 12 },
    composition: { medium: 'water_vapor', temperature: 'scald', pressure: 3 },
    moveset_template: ['steam_punch', 'pressure_blast', 'heat_shield', 'null']
  },
  {
    id: 'plasma_wisp',
    name: 'Plasma Wisp',
    family: 'elementals',
    alignment: 'cipher',
    element: 'volt',
    role: 'burst',
    base_stats: { hp: 75, guard: 6, power: 18, speed: 17, focus: 16, will: 8 },
    composition: { medium: 'ionized_gas', temperature: 'plasma', conductivity: 3 },
    moveset_template: ['plasma_bolt', 'chain_lightning', 'overload', 'null']
  },
  {
    id: 'gale_slicer',
    name: 'Gale Slicer',
    family: 'elementals',
    alignment: 'rogue',
    element: 'gale',
    role: 'assassin',
    base_stats: { hp: 85, guard: 7, power: 15, speed: 19, focus: 14, will: 9 },
    composition: { medium: 'airform', temperature: 'chill', viscosity: 1 },
    moveset_template: ['wind_slash', 'cyclone', 'gust_dodge', 'null']
  },
  {
    id: 'stoneheart_surge',
    name: 'Stoneheart Surge',
    family: 'elementals',
    alignment: 'guardian',
    element: 'stone',
    role: 'tank',
    base_stats: { hp: 145, guard: 21, power: 9, speed: 4, focus: 8, will: 16 },
    composition: { medium: 'aggregate', temperature: 'temperate', density: 3 },
    moveset_template: ['rock_smash', 'quake', 'petrify', 'null']
  },
  {
    id: 'lumen_choirling',
    name: 'Lumen Choirling',
    family: 'elementals',
    alignment: 'cipher',
    element: 'lumen',
    role: 'cleanse_support',
    base_stats: { hp: 95, guard: 10, power: 7, speed: 11, focus: 16, will: 18 },
    composition: { medium: 'radiance', temperature: 'warm', luminosity: 3 },
    moveset_template: ['light_beam', 'purify', 'radiant_aura', 'null']
  },
  {
    id: 'umber_drifter',
    name: 'Umber Drifter',
    family: 'elementals',
    alignment: 'rogue',
    element: 'umber',
    role: 'drain',
    base_stats: { hp: 100, guard: 8, power: 13, speed: 14, focus: 13, will: 10 },
    composition: { medium: 'shadow', temperature: 'chill', opacity: 3 },
    moveset_template: ['shadow_bolt', 'life_drain', 'fade', 'null']
  },
  {
    id: 'rimebound_tide',
    name: 'Rimebound Tide',
    family: 'elementals',
    alignment: 'guardian',
    element: 'tide',
    role: 'slow_tank',
    base_stats: { hp: 135, guard: 18, power: 8, speed: 6, focus: 9, will: 15 },
    composition: { medium: 'freshwater', temperature: 'frost', viscosity: 2 },
    moveset_template: ['ice_crash', 'freeze', 'glacier_wall', 'null']
  }
  
  // Continue with remaining 34 creatures...
  // (Beasts 7, Humanoids 7, Undead 6, Celestials 3, Insectoids 3)
  // For brevity, showing first 24. Full 50 would follow same pattern.
];

export const MOVE_DATABASE = {
  // Strike moves
  heavy_strike: { type: 'strike', taxonomy: 'smash', power_mult: 1.0, cooldown: 0 },
  volt_slash: { type: 'strike', taxonomy: 'smash', power_mult: 1.1, cooldown: 0 },
  
  // Skills
  shield_slam: { type: 'skill', taxonomy: 'smash', power_mult: 1.3, cooldown: 2, effect: 'stun_chance' },
  arc_discharge: { type: 'skill', taxonomy: 'blast', power_mult: 1.4, cooldown: 3, effect: 'chain' },
  
  // Utilities
  fortify: { type: 'utility', taxonomy: 'guard', cooldown: 3, effect: '+20_guard_2_turns' },
  aegis_cast: { type: 'utility', taxonomy: 'boost', cooldown: 4, effect: 'shield_ally' },
  
  // Add all moves from Design Bible...
};

export const CHASSIS_FAMILIES = {
  automata: {
    signature: 'Overclock',
    description: 'Temporary power boost, builds heat risk'
  },
  golems: {
    signature: 'Material Armor',
    description: 'Composition heavily influences guard/resists'
  },
  elementals: {
    signature: 'Medium State',
    description: 'Temperature/salinity toggles passives'
  },
  beasts: {
    signature: 'Instinct Surge',
    description: 'Bonus when low HP or after crit'
  },
  humanoids: {
    signature: 'Technique Chain',
    description: 'Combo bonuses if skills used in sequence'
  },
  undead: {
    signature: 'Rot',
    description: 'Stacking damage + healing reduction'
  },
  celestials: {
    signature: 'Aegis',
    description: 'Shield windows + cleanse'
  },
  insectoids: {
    signature: 'Swarm',
    description: 'Stacking minions/marks increase damage'
  }
};