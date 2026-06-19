'use strict';

// COMBAT AI Coach — a self-contained coaching engine (no external services).
// It combines generalist knowledge (sports nutrition, endurance, strength) with
// sport-specific philosophies modeled on leading combat-sport coaches, and
// answers questions by matching them against a curated knowledge base.

// Who the coach "learns from", surfaced in the UI and the "about" intent.
const COACH_PANEL = {
  wrestling: {
    label: 'Wrestling',
    emoji: '🤼',
    coaches: [
      { name: 'Cael Sanderson', focus: 'Pace, position & live wrestling' },
      { name: 'Morgan Flaharty', focus: 'Strength & conditioning' },
      { name: 'Ivan Ivanov', focus: 'Motor, drilling & technique' },
      { name: 'Wrestling Mindset', focus: 'Mental performance' },
    ],
  },
  boxing: {
    label: 'Boxing',
    emoji: '🥊',
    coaches: [
      { name: 'Boxing Science — Danny Wilson & Alan Ruddock', focus: 'Sports science & S&C' },
      { name: 'Dr Andy Galpin', focus: 'Energy systems & physiology' },
      { name: 'Greg Robinson', focus: 'Strength & conditioning' },
    ],
  },
  general: {
    label: 'Foundations',
    emoji: '🧠',
    coaches: [
      { name: 'Sports Nutritionist', focus: 'Fueling, hydration & weight' },
      { name: 'Endurance Coach', focus: 'Energy systems & conditioning' },
      { name: 'Strength Coach', focus: 'Strength, power & robustness' },
    ],
  },
};

// Curated knowledge base. Each entry is matched by keywords, with a boost when
// its sport matches the athlete's selected sport.
const ENTRIES = [
  // ----------------------------------------------------------------- WRESTLING
  {
    title: 'Building a wrestling gas tank',
    sports: ['wrestling'],
    keywords: ['endurance', 'conditioning', 'gas tank', 'cardio', 'tired', 'fatigue', 'motor',
      'pace', 'third period', 'wind', 'out of shape', 'gassing', 'stamina', 'fitness'],
    body: "Wrestling conditioning is built on the mat first: live goes, hard drilling and short-rest scrambles train the exact energy systems a match demands. Build a big aerobic base 8–12 weeks out (easy runs, bike, and long live wrestling at a controllable pace), then layer in intervals that mirror a period — e.g. 6×2 min hard : 1 min rest. Develop a relentless pace and great position so opponents carry your weight and fade in the third period.",
    sources: ['Cael Sanderson', 'Ivan Ivanov', 'Wrestling Mindset'],
  },
  {
    title: 'Maintaining strength during wrestling season',
    sports: ['wrestling'],
    keywords: ['strength', 'maintain', 'maintenance', 'lifting', 'lift', 'in season', 'in-season',
      'weights', 'strong', 'stay strong', 'program'],
    body: "In-season, keep strength with the minimum effective dose so it doesn't interfere with wrestling. Lift heavy but low-volume twice a week: a main lower-body push (squat or trap-bar deadlift), an upper push and pull, and posterior-chain work. Keep reps low (3–5), leave 2–3 reps in reserve, and protect recovery. You hold the strength you built in the off-season without the soreness that wrecks practice.",
    sources: ['Morgan Flaharty', 'Strength Coach'],
  },
  {
    title: 'Neck, grip & robustness for wrestlers',
    sports: ['wrestling'],
    keywords: ['neck', 'grip', 'injury', 'robust', 'durable', 'bridge', 'hands', 'prehab', 'staying healthy'],
    body: "Wrestlers need bulletproof necks and hands. Train the neck directly (isometrics, controlled bridging, banded resistance) several times a week, and build grip with heavy holds, rope or towel pull-ups, and carries. Robustness work — single-leg balance, controlled landings, hip and shoulder mobility — keeps you available to train, which is the real driver of long-term progress.",
    sources: ['Morgan Flaharty', 'Ivan Ivanov'],
  },
  {
    title: 'The wrestling mindset',
    sports: ['wrestling'],
    keywords: ['mindset', 'nervous', 'nerves', 'confidence', 'focus', 'mental', 'anxiety', 'pressure',
      'choke', 'believe', 'routine', 'pre match', 'pre-match', 'doubt', 'motivation'],
    body: "Control the controllables: your preparation, effort, attitude and body language. Nerves are just energy — reframe them as readiness. Build a consistent pre-match routine (warm-up, breathing, a cue word, visualising your first scramble) so you default to it under pressure. Wrestle to score and impose your pace rather than not-to-lose; a process focus beats an outcome focus every time.",
    sources: ['Wrestling Mindset'],
  },
  {
    title: 'Position & hand-fighting',
    sports: ['wrestling'],
    keywords: ['position', 'hand fighting', 'technique', 'stance', 'takedown', 'scramble', 'drilling',
      'ties', 'shots', 'attacks'],
    body: "Score from great position. Win the hand-fighting and ties first, keep a strong stance and level, and chain attacks so a stopped shot flows into the next. Ivanov-style high-rep drilling makes technique automatic; Cael-style live wrestling under fatigue makes it hold up when it counts. Good position is also your best conditioning and injury insurance.",
    sources: ['Ivan Ivanov', 'Cael Sanderson'],
  },
  {
    title: 'Weight management for wrestlers',
    sports: ['wrestling'],
    keywords: ['weight', 'cut weight', 'weight cut', 'make weight', 'descend', 'drop weight', 'certification'],
    body: "Wrestle at a weight you can make healthily and repeatedly across a season, not a one-off crash. Manage it through consistent nutrition and hydration so you stay powered for daily practice and twice-a-day tournaments. Chronic hard cutting tanks strength, focus and immunity — being a strong, sharp wrestler at a slightly higher class usually beats being a drained one a class down.",
    sources: ['Wrestling Mindset', 'Sports Nutritionist'],
  },

  // -------------------------------------------------------------------- BOXING
  {
    title: 'Boxing conditioning, the sports-science way',
    sports: ['boxing'],
    keywords: ['endurance', 'conditioning', 'cardio', 'road work', 'roadwork', 'running', 'rounds',
      'gas', 'fatigue', 'fitness', 'aerobic', 'later rounds', 'gas tank', 'stamina'],
    body: "Boxing is a high-intensity, intermittent sport, so train it that way. Build a strong aerobic engine — it powers recovery between rounds and between sessions — with steady cardio plus, crucially, high-intensity intervals (40 m runs, bike sprints, 30:30s). Swap junk slow road work for quality conditioning that matches a round's work:rest. A bigger base means you punch hard in the later rounds and recover faster overnight.",
    sources: ['Boxing Science — Danny Wilson & Alan Ruddock', 'Dr Andy Galpin'],
  },
  {
    title: 'Strength & punch power for boxers',
    sports: ['boxing'],
    keywords: ['strength', 'power', 'punch power', 'explosive', 'lifting', 'lift', 'weights', 'strong',
      'fast', 'force', 'hit harder', 'knockout'],
    body: "Punch power comes from force and speed, not from a sweaty workout. Build strength with heavy compound lifts (trap-bar deadlift, squat, press) at low reps, then express it fast with jumps, medicine-ball throws and Olympic-lift variations. Boxing Science's '3D' model develops strength, then speed-strength, then sport-specific power. Two short, heavy, low-fatigue sessions a week add power without slowing your hands or adding unwanted weight.",
    sources: ['Boxing Science — Danny Wilson & Alan Ruddock', 'Greg Robinson'],
  },
  {
    title: 'Legs and footwork that last',
    sports: ['boxing'],
    keywords: ['footwork', 'movement', 'legs', 'stance', 'ring craft', 'balance', 'tire legs', 'agility'],
    body: "Tired legs are the first thing to go in the later rounds, and they take your defence and power with them. Train footwork fresh and often (skipping, ladder, shadow rounds with intent) and underpin it with strength and conditioning so your movement holds up. Strong, conditioned legs let you keep your range, angles and balance when opponents fade.",
    sources: ['Greg Robinson', 'Boxing Science — Danny Wilson & Alan Ruddock'],
  },
  {
    title: 'Refuel & rehydrate after the weigh-in',
    sports: ['boxing'],
    keywords: ['rehydrate', 'after weigh in', 'after weigh-in', 'refuel', 'weigh in', 'weigh-in',
      'recover weight', 'fight day', 'day of'],
    body: "The weigh-in starts the most important meal window of the camp. Rehydrate with fluids plus sodium (and carbs) to pull water back into your system, and eat familiar, easy-to-digest carb-led meals you've practised in training — never experiment on fight day. An athlete who rehydrates and refuels well often has a real edge by the first bell.",
    sources: ['Boxing Science — Danny Wilson & Alan Ruddock'],
  },

  // ---------------------------------------------------- ENERGY SYSTEMS / GALPIN
  {
    title: 'Train the right energy system',
    sports: ['boxing', 'all'],
    keywords: ['energy system', 'energy systems', 'phosphagen', 'glycolytic', 'aerobic', 'anaerobic',
      'lactic', 'recovery between', 'interval', 'intervals'],
    body: "Performance lives across three energy systems: the phosphagen system (short max efforts — your hardest punches and scrambles), the glycolytic system (intense 10–60 s flurries), and the aerobic system (your engine and recovery). Don't only train one. Build a deep aerobic base for recovery, sharpen the glycolytic system with hard intervals, and keep the phosphagen system fast with short max-effort bursts and full rest. Match your hard sessions to what your sport actually demands.",
    sources: ['Dr Andy Galpin'],
  },

  // ------------------------------------------------------------------ NUTRITION
  {
    title: 'Protein for combat athletes',
    sports: ['all'],
    keywords: ['protein', 'muscle', 'recovery food', 'how much protein', 'grams', 'macros'],
    body: "Aim for about 1.6–2.2 g of protein per kg of bodyweight per day, spread across 3–5 meals of ~0.3–0.4 g/kg each. Protein drives recovery and protects muscle when you're dieting or cutting weight. Let whole foods (eggs, dairy, meat, fish, legumes) do most of the work; a shake is just a convenient top-up.",
    sources: ['Sports Nutritionist'],
  },
  {
    title: 'Fueling your training',
    sports: ['all'],
    keywords: ['carbs', 'carbohydrate', 'energy', 'fuel', 'pre workout', 'pre-workout', 'eat', 'before',
      'what to eat', 'before training', 'before a match', 'tournament', 'meal', 'diet'],
    body: "Carbohydrate is your primary fuel for hard wrestling and boxing work. On heavy days eat 4–6 g/kg of carbs, weighted around your sessions. A carb-led meal 2–3 hours before, plus something small and easy (banana, rice cakes, toast) 30–60 min before, keeps intensity high. Afterwards, combine carbs + protein to refill the tank and start recovery.",
    sources: ['Sports Nutritionist'],
  },
  {
    title: 'Hydration',
    sports: ['all'],
    keywords: ['hydration', 'hydrate', 'water', 'drink', 'dehydrated', 'electrolytes', 'thirsty', 'sodium'],
    body: "Show up already hydrated — pale-yellow urine is a good check. For sweaty sessions add electrolytes (sodium especially), not just plain water. Even a 2% drop in body water hurts power, decision-making and conditioning, so sip through the day rather than chugging once.",
    sources: ['Sports Nutritionist'],
  },
  {
    title: 'Cutting weight safely',
    sports: ['all'],
    keywords: ['weight cut', 'cut weight', 'make weight', 'lose weight', 'water cut', 'weigh in',
      'dropping weight', 'losing weight', 'cutting'],
    body: "Do the bulk of your weight loss through nutrition over several weeks — a steady ~0.5–1% of bodyweight per week — so you arrive near your class without a brutal water cut. Save only a small water manipulation for fight week, and only with experienced supervision. Cutting too hard drains power, conditioning and immunity. The goal is to be strong at the weight, not just to hit the scale.",
    sources: ['Sports Nutritionist', 'Boxing Science — Danny Wilson & Alan Ruddock'],
  },
  {
    title: 'Supplements that actually help',
    sports: ['all'],
    keywords: ['creatine', 'supplement', 'supplements', 'caffeine', 'protein powder', 'do i need',
      'pills', 'vitamins'],
    body: "Most gains come from food, sleep and training, but a few supplements are well supported: creatine monohydrate (3–5 g/day) for strength and repeat-effort power, caffeine for alertness and performance, and whey for convenience. Vitamin D and electrolytes can help depending on your situation. Skip anything promising magic — the basics win.",
    sources: ['Sports Nutritionist', 'Dr Andy Galpin'],
  },

  // ----------------------------------------------------- GENERAL CONDITIONING
  {
    title: 'Build the base, then sharpen it',
    sports: ['all'],
    keywords: ['aerobic base', 'base building', 'conditioning plan', 'get fitter', 'stamina',
      'how to get in shape', 'periodise', 'periodize'],
    body: "Periodise your conditioning: spend the early weeks building an aerobic base (frequent, mostly easy-to-moderate cardio plus skill rounds) so you recover faster within and between sessions. As competition nears, shift volume toward sport-specific high-intensity intervals that mirror your rounds or periods. Base first, sharpness second — sharpness fades fast if there's no base under it.",
    sources: ['Endurance Coach'],
  },
  {
    title: 'How to lift around hard sport practice',
    sports: ['all'],
    keywords: ['how often lift', 'sets reps', 'program', 'strength program', 'maintenance lifting',
      'gym', 'weight room', 'how to train strength'],
    body: "Around a heavy skill schedule, treat the weight room as support, not the main event. Two sessions a week of heavy, low-rep compound lifts (a squat or hinge, an upper push, an upper pull, plus core and neck) maintain or build strength with minimal fatigue. Keep most sets short of failure. Quality and recovery beat volume when your sport already brings plenty of fatigue.",
    sources: ['Strength Coach', 'Morgan Flaharty'],
  },
  {
    title: 'Developing explosive power',
    sports: ['all'],
    keywords: ['explosive', 'power', 'speed', 'fast twitch', 'plyometric', 'plyometrics', 'jump', 'throw'],
    body: "Power = force × velocity, so train both ends: heavy lifts for force, then fast work (jumps, medicine-ball throws, short sprints, Olympic-lift variations) to express it quickly. Do power work fresh, early in the session, with full rest between quality reps. Low volume, high intent — a handful of crisp, explosive reps beats grinding tired ones.",
    sources: ['Strength Coach', 'Boxing Science — Danny Wilson & Alan Ruddock'],
  },

  // ------------------------------------------------------------ RECOVERY / MIND
  {
    title: 'Sleep is your best recovery tool',
    sports: ['all'],
    keywords: ['sleep', 'rest', 'recovery', 'insomnia', 'nap', 'tired all the time', 'sleeping'],
    body: "Aim for 7–9 hours of quality sleep — it's where strength, skill and conditioning adaptations consolidate. Keep a consistent schedule, get morning light, and cut screens and caffeine late. If you're under-recovered, more training rarely fixes it; better sleep usually does. A 20-minute nap helps on heavy double-session days.",
    sources: ['Dr Andy Galpin', 'Recovery Science'],
  },
  {
    title: 'Managing fatigue & soreness',
    sports: ['all'],
    keywords: ['sore', 'soreness', 'overtraining', 'deload', 'rest day', 'doms', 'burnt out', 'burnout',
      'overtrained', 'fatigue management', 'recover faster'],
    body: "Hard training only counts if you recover from it. Build in easy days and a lighter 'deload' week every 3–6 weeks, fuel and hydrate well, and use easy movement, mobility and sleep to bounce back. Persistent soreness, stalled performance, poor sleep or low mood are signs to back off before they become injury or burnout.",
    sources: ['Recovery Science', 'Morgan Flaharty'],
  },
  {
    title: 'Warm-ups & mobility',
    sports: ['all'],
    keywords: ['warm up', 'warmup', 'mobility', 'stretch', 'stretching', 'flexibility', 'stiff', 'prehab'],
    body: "Start sessions with a dynamic warm-up that raises your heart rate and takes hips, shoulders and spine through the ranges your sport demands — not long static stretches. Save static stretching and breathing work for cool-downs. A few targeted drills (hips for wrestlers, shoulders and thoracic spine for boxers) keep positions strong and cut injury risk.",
    sources: ['Strength Coach', 'Recovery Science'],
  },
  {
    title: 'Performing under pressure',
    sports: ['all', 'boxing'],
    keywords: ['focus', 'pressure', 'confidence', 'nerves', 'mental', 'belief', 'motivation',
      'discipline', 'mindset', 'nervous'],
    body: "Confidence is built in the gym through preparation you can trust, then protected by where you put your attention. Focus on your process and the next action — your jab, your stance, your breathing — not the scoreboard or the crowd. A simple pre-performance routine and a cue word help you reset after mistakes and stay in the moment.",
    sources: ['Wrestling Mindset'],
  },
];

// Sport-aware suggested questions shown as quick chips.
const SUGGESTIONS = {
  wrestling: [
    'How do I build my gas tank for wrestling?',
    'How do I maintain strength during the season?',
    'How do I handle pre-match nerves?',
    'What should I eat before a tournament?',
  ],
  boxing: [
    'How do I improve conditioning for the later rounds?',
    'How do I build punch power?',
    'How should I cut weight safely?',
    'What should I do right after the weigh-in?',
  ],
  general: [
    'How much protein should I eat?',
    'How do I build an aerobic base?',
    'How should I lift around hard practices?',
    'How important is sleep for recovery?',
  ],
};

// --------------------------------------------------------------------- engine
function normalize(s) {
  return ' ' + String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
}

function keywordHit(msg, kw) {
  const padded = ' ' + kw + ' ';
  if (msg.includes(padded)) return kw.includes(' ') ? 4 : 3; // phrases beat single words
  if (kw.length > 3 && msg.includes(kw)) return 1;           // loose substring (catches plurals)
  return 0;
}

function matchesAny(msg, phrases) {
  return phrases.some((p) => keywordHit(msg, p) > 0);
}

function suggestionsFor(sport) {
  return SUGGESTIONS[sport] || SUGGESTIONS.general;
}

function scoreEntry(entry, msg, sport) {
  let s = 0;
  for (const kw of entry.keywords) s += keywordHit(msg, kw);
  if (s > 0) {
    if (sport && entry.sports.includes(sport)) s += 3;        // matches the athlete's sport
    else if (entry.sports.includes('all')) s += sport ? 1 : 0.5; // general entries stay relevant
    else if (sport) s -= 3;                                    // specific to a different sport
  }
  return s;
}

function greeting(sport) {
  const label = sport ? COACH_PANEL[sport].label : 'combat sports';
  return {
    type: 'chat',
    reply: `Hey — I'm your COMBAT AI Coach. I can help with conditioning, strength, nutrition, weight cuts, recovery and mindset for ${label}. Ask me anything, or tap a suggestion below.`,
    suggestions: suggestionsFor(sport || 'general'),
  };
}

function about(sport) {
  const panels = sport ? [COACH_PANEL[sport], COACH_PANEL.general] : [COACH_PANEL.wrestling, COACH_PANEL.boxing, COACH_PANEL.general];
  return {
    type: 'about',
    reply: "I'm your COMBAT AI Coach. I combine the knowledge of a sports nutritionist, an endurance coach and a strength coach, and I draw on the methods of leading combat-sport coaches depending on your sport:",
    panels,
    suggestions: suggestionsFor(sport || 'general'),
  };
}

function help(sport) {
  return {
    type: 'chat',
    reply: "I can coach you on: 🫁 conditioning & energy systems, 💪 strength & power, 🥗 nutrition & fueling, ⚖️ safe weight cutting, 😴 recovery & sleep, and 🧠 mindset. Pick your sport up top so I tailor the advice, then ask away — here are some ideas:",
    suggestions: suggestionsFor(sport || 'general'),
  };
}

function fallback(sport) {
  return {
    type: 'chat',
    reply: "I'm not totally sure I caught that. I can help with conditioning, strength, nutrition, weight cuts, recovery and mindset. Try one of these:",
    suggestions: suggestionsFor(sport || 'general'),
  };
}

/**
 * Answer a coaching question.
 * @param {{message?:string, sport?:string}} input
 */
function respond({ message, sport } = {}) {
  const raw = String(message || '').trim();
  const msg = normalize(raw);
  const sportKey = sport === 'wrestling' || sport === 'boxing' ? sport : null;

  if (!raw) return help(sportKey);
  if (matchesAny(msg, ['hello', 'hi', 'hey', 'yo', 'sup', 'good morning', 'good evening', 'hey coach', 'whats up']))
    return greeting(sportKey);
  if (matchesAny(msg, ['thank', 'thanks', 'cheers', 'appreciate']))
    return { type: 'chat', reply: 'Anytime — now go put in the work. 🥊 What else can I help with?', suggestions: suggestionsFor(sportKey || 'general') };
  if (matchesAny(msg, ['who are you', 'what are you', 'who do you learn', 'where do you learn', 'who taught', 'your coaches', 'sources', 'based on', 'who trained you']))
    return about(sportKey);
  if (matchesAny(msg, ['help', 'what can you do', 'what do you know', 'topics', 'what can i ask']))
    return help(sportKey);

  let best = null;
  let bestScore = 0;
  for (const entry of ENTRIES) {
    const sc = scoreEntry(entry, msg, sportKey);
    if (sc > bestScore) { bestScore = sc; best = entry; }
  }
  if (!best || bestScore < 3) return fallback(sportKey);

  return {
    type: 'answer',
    title: best.title,
    reply: best.body,
    sources: best.sources,
    suggestions: suggestionsFor(sportKey || 'general'),
  };
}

module.exports = { respond, COACH_PANEL, SUGGESTIONS };
