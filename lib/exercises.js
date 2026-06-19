'use strict';

// Seed library for the `exercises` table. Each entry assembles into plan
// sessions. `discipline: 'all'` means it can be used for any combat sport;
// otherwise it is specific to that discipline's skill work.

module.exports = [
  // ---------------------------------------------------------------- STRENGTH
  { name: 'Back Squat',            category: 'strength', discipline: 'all', detail: '4 x 6 reps' },
  { name: 'Trap-Bar Deadlift',     category: 'strength', discipline: 'all', detail: '3 x 5 reps' },
  { name: 'Bench Press',           category: 'strength', discipline: 'all', detail: '4 x 6 reps' },
  { name: 'Weighted Pull-ups',     category: 'strength', discipline: 'all', detail: '4 x 6 reps' },
  { name: 'Overhead Press',        category: 'strength', discipline: 'all', detail: '3 x 8 reps' },
  { name: 'Romanian Deadlift',     category: 'strength', discipline: 'all', detail: '3 x 8 reps' },
  { name: 'Bulgarian Split Squat', category: 'strength', discipline: 'all', detail: '3 x 10 / leg' },
  { name: 'Power Clean',           category: 'strength', discipline: 'all', detail: '5 x 3 reps' },
  { name: 'Kettlebell Swing',      category: 'strength', discipline: 'all', detail: '4 x 15 reps' },
  { name: 'Weighted Dips',         category: 'strength', discipline: 'all', detail: '4 x 8 reps' },
  { name: 'Barbell Row',           category: 'strength', discipline: 'all', detail: '4 x 8 reps' },
  { name: 'Hip Thrust',            category: 'strength', discipline: 'all', detail: '3 x 10 reps' },
  { name: "Farmer's Carry",        category: 'strength', discipline: 'all', detail: '4 x 40 m' },
  { name: 'Turkish Get-up',        category: 'strength', discipline: 'all', detail: '3 x 5 / side' },
  { name: 'Weighted Plank',        category: 'strength', discipline: 'all', detail: '4 x 45 sec' },
  { name: 'Neck Harness Raises',   category: 'strength', discipline: 'all', detail: '3 x 15 reps' },

  // ------------------------------------------------------------ CONDITIONING
  { name: 'Assault Bike Intervals', category: 'conditioning', discipline: 'all', detail: '8 x 20s sprint / 40s easy' },
  { name: 'Jump Rope',              category: 'conditioning', discipline: 'all', detail: '5 rounds x 3 min' },
  { name: '400m Repeats',           category: 'conditioning', discipline: 'all', detail: '6 x 400 m' },
  { name: 'Sled Push',              category: 'conditioning', discipline: 'all', detail: '6 x 20 m' },
  { name: 'Burpee Intervals',       category: 'conditioning', discipline: 'all', detail: '10 x 30 sec' },
  { name: 'Battle Ropes',           category: 'conditioning', discipline: 'all', detail: '8 x 30 sec' },
  { name: 'Rowing Intervals',       category: 'conditioning', discipline: 'all', detail: '10 x 250 m' },
  { name: 'Heavy Bag Conditioning', category: 'conditioning', discipline: 'all', detail: '6 rounds x 3 min' },
  { name: 'Hill Sprints',           category: 'conditioning', discipline: 'all', detail: '8 x 15 sec' },
  { name: 'Tempo Run',              category: 'conditioning', discipline: 'all', detail: '25 min steady' },
  { name: 'Mountain Climbers',      category: 'conditioning', discipline: 'all', detail: '5 x 45 sec' },
  { name: 'Shadow Conditioning',    category: 'conditioning', discipline: 'all', detail: '5 rounds x 3 min' },

  // ------------------------------------------------------------------ SKILL
  // Boxing
  { name: 'Jab–Cross Drills',   category: 'skill', discipline: 'boxing', detail: '5 rounds x 3 min' },
  { name: 'Slip & Counter',     category: 'skill', discipline: 'boxing', detail: '4 rounds x 3 min' },
  { name: 'Double-End Bag',     category: 'skill', discipline: 'boxing', detail: '5 rounds x 3 min' },
  { name: 'Heavy Bag Combos',   category: 'skill', discipline: 'boxing', detail: '6 rounds x 3 min' },
  { name: 'Focus Mitt Rounds',  category: 'skill', discipline: 'boxing', detail: '5 rounds x 3 min' },
  // MMA
  { name: 'Sprawl & Strike',      category: 'skill', discipline: 'mma', detail: '5 rounds x 3 min' },
  { name: 'Cage Wrestling',       category: 'skill', discipline: 'mma', detail: '4 rounds x 4 min' },
  { name: 'Ground & Pound Drills',category: 'skill', discipline: 'mma', detail: '5 rounds x 3 min' },
  { name: 'Level-Change Combos',  category: 'skill', discipline: 'mma', detail: '4 rounds x 3 min' },
  // BJJ
  { name: 'Guard Retention Drills', category: 'skill', discipline: 'bjj', detail: '4 rounds x 4 min' },
  { name: 'Positional Sparring',    category: 'skill', discipline: 'bjj', detail: '5 rounds x 5 min' },
  { name: 'Submission Chains',      category: 'skill', discipline: 'bjj', detail: '4 x 6 reps' },
  { name: 'Takedown to Pass',       category: 'skill', discipline: 'bjj', detail: '4 rounds x 4 min' },
  // Muay Thai
  { name: 'Teep & Check Drills',  category: 'skill', discipline: 'muay_thai', detail: '5 rounds x 3 min' },
  { name: 'Elbow & Knee Clinch',  category: 'skill', discipline: 'muay_thai', detail: '4 rounds x 3 min' },
  { name: 'Roundhouse Kick Pads', category: 'skill', discipline: 'muay_thai', detail: '6 rounds x 3 min' },
  { name: 'Clinch Sweeps',        category: 'skill', discipline: 'muay_thai', detail: '4 rounds x 3 min' },
  // Wrestling
  { name: 'Penetration Step Drills', category: 'skill', discipline: 'wrestling', detail: '5 x 10 reps' },
  { name: 'Single-Leg Finishes',     category: 'skill', discipline: 'wrestling', detail: '4 x 8 reps' },
  { name: 'Sprawl Reaction Drills',  category: 'skill', discipline: 'wrestling', detail: '6 rounds x 1 min' },
  { name: 'Chain Wrestling',         category: 'skill', discipline: 'wrestling', detail: '5 rounds x 2 min' },
  // Kickboxing
  { name: 'Kick–Punch Combos', category: 'skill', discipline: 'kickboxing', detail: '6 rounds x 3 min' },
  { name: 'Switch Kick Pads',  category: 'skill', discipline: 'kickboxing', detail: '5 rounds x 3 min' },
  { name: 'Lateral Footwork',  category: 'skill', discipline: 'kickboxing', detail: '4 x 2 min' },
  { name: 'Counter Kicking',   category: 'skill', discipline: 'kickboxing', detail: '4 rounds x 3 min' },
  // Karate
  { name: 'Kata Repetition',        category: 'skill', discipline: 'karate', detail: '5 x 1 form' },
  { name: 'Kumite Distance Drills', category: 'skill', discipline: 'karate', detail: '5 rounds x 2 min' },
  { name: 'Reverse Punch Pads',     category: 'skill', discipline: 'karate', detail: '6 rounds x 2 min' },
  { name: 'Blitz Entry Drills',     category: 'skill', discipline: 'karate', detail: '4 x 8 reps' },
  // Generic skill (any discipline)
  { name: 'Shadow Sparring',     category: 'skill', discipline: 'all', detail: '5 rounds x 3 min' },
  { name: 'Reaction Ball Drills',category: 'skill', discipline: 'all', detail: '4 x 2 min' },
  { name: 'Partner Flow Drilling',category: 'skill', discipline: 'all', detail: '5 rounds x 3 min' },
  { name: 'Footwork Ladder',     category: 'skill', discipline: 'all', detail: '4 x 2 min' },

  // --------------------------------------------------------------- MOBILITY
  { name: 'Dynamic Warm-up Flow', category: 'mobility', discipline: 'all', detail: '10 min' },
  { name: 'Hip Mobility Series',  category: 'mobility', discipline: 'all', detail: '8 min' },
  { name: 'Foam Rolling',         category: 'mobility', discipline: 'all', detail: '10 min' },
  { name: 'Yoga for Fighters',    category: 'mobility', discipline: 'all', detail: '20 min' },
  { name: 'Shoulder Band Routine',category: 'mobility', discipline: 'all', detail: '8 min' },
  { name: 'Ankle & Wrist Prep',   category: 'mobility', discipline: 'all', detail: '6 min' },
  { name: 'Static Stretch Cooldown', category: 'mobility', discipline: 'all', detail: '12 min' },
  { name: 'Breathing & Box Recovery', category: 'mobility', discipline: 'all', detail: '6 min' },
];
