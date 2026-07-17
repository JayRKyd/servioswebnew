export type QuestionOption = {
  label: string
  value: string
  icon?: string
  allowText?: boolean  // show free-text input when this option is selected
}

export type QuestionStep = {
  id: string
  question: string
  hint?: string
  type?: 'single' | 'multi'  // default: 'single'
  options: QuestionOption[]
}

export type CategoryMeta = {
  label: string
  icon: string
  color: string   // Tailwind bg class
  accent: string  // Tailwind text class
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  plumber:      { label: 'Plumbing',      icon: '🔧', color: 'bg-blue-50',    accent: 'text-blue-600' },
  electrician:  { label: 'Electrical',    icon: '⚡', color: 'bg-yellow-50',  accent: 'text-yellow-600' },
  hvac:         { label: 'HVAC',          icon: '❄️',  color: 'bg-cyan-50',    accent: 'text-cyan-600' },
  painter:      { label: 'Painting',      icon: '🎨', color: 'bg-pink-50',    accent: 'text-pink-600' },
  carpenter:    { label: 'Carpentry',     icon: '🪚', color: 'bg-amber-50',   accent: 'text-amber-700' },
  cleaner:      { label: 'Cleaning',      icon: '🧹', color: 'bg-green-50',   accent: 'text-green-600' },
  landscaper:   { label: 'Landscaping',   icon: '🌿', color: 'bg-emerald-50', accent: 'text-emerald-600' },
  roofer:       { label: 'Roofing',       icon: '🏠', color: 'bg-orange-50',  accent: 'text-orange-600' },
  pest_control: { label: 'Pest Control',  icon: '🐛', color: 'bg-red-50',     accent: 'text-red-600' },
  security:     { label: 'Security',      icon: '🔒', color: 'bg-slate-50',   accent: 'text-slate-600' },
  handyman:     { label: 'Handyman',      icon: '🛠️', color: 'bg-violet-50',  accent: 'text-violet-600' },
}

/** No-typing escape hatch for customers who don't know the answer —
 *  appended to scoping questions where uncertainty is plausible. */
const DISCUSS = { label: "I'd like to discuss with the pro", value: 'discuss' }

/** Appended as the final step for every category — answer maps to provider `location` facet */
export const LOCATION_STEP: QuestionStep = {
  id: 'location',
  type: 'single',
  question: 'Where do you need the service?',
  hint: "We'll match you with providers in your area.",
  options: [
    { label: 'London',          value: 'london' },
    { label: 'Manchester',      value: 'manchester' },
    { label: 'Birmingham',      value: 'birmingham' },
    { label: 'Leeds',           value: 'leeds' },
    { label: 'Glasgow',         value: 'glasgow' },
    { label: 'Liverpool',       value: 'liverpool' },
    { label: 'Bristol',         value: 'bristol' },
    { label: 'Sheffield',       value: 'sheffield' },
    { label: 'Edinburgh',       value: 'edinburgh' },
    { label: 'Cardiff',         value: 'cardiff' },
    { label: 'Leicester',       value: 'leicester' },
    { label: 'Nottingham',      value: 'nottingham' },
    { label: 'Other',           value: 'other' },
  ],
}

export const SERVICE_QUESTIONS: Record<string, QuestionStep[]> = {
  plumber: [
    {
      id: 'issue_type',
      question: 'What type of plumbing issue do you have?',
      options: [
        { label: 'Leaking pipe or tap',        value: 'leak' },
        { label: 'Blocked drain or toilet',    value: 'blockage' },
        { label: 'No hot water',               value: 'hot_water' },
        { label: 'Water pressure problem',     value: 'pressure' },
        { label: 'Installation / new fixture', value: 'install' },
        DISCUSS,
        { label: 'Other',                      value: 'other', allowText: true },
      ],
    },
    {
      id: 'problem_area',
      question: 'Where is the problem?',
      options: [
        { label: 'Kitchen',                   value: 'kitchen' },
        { label: 'Bathroom',                  value: 'bathroom' },
        { label: 'Boiler or hot water tank',  value: 'boiler' },
        { label: 'Outdoors',                  value: 'outdoors' },
        { label: 'More than one place',       value: 'multiple' },
      ],
    },
    {
      id: 'urgency',
      question: 'How urgent is this?',
      options: [
        { label: 'Emergency — needs fixing now',    value: 'emergency' },
        { label: 'Urgent — within 24 hours',        value: 'urgent' },
        { label: 'This week',                       value: 'this_week' },
        { label: 'Flexible — just planning ahead',  value: 'flexible' },
      ],
    },
    {
      id: 'property_type',
      question: 'What type of property?',
      options: [
        { label: 'House',                 value: 'house' },
        { label: 'Apartment',             value: 'apartment' },
        { label: 'Business / Commercial', value: 'commercial' },
      ],
    },
  ],

  electrician: [
    {
      id: 'issue_type',
      question: 'What electrical work do you need?',
      options: [
        { label: 'Power outage / tripped breaker',  value: 'outage' },
        { label: 'Install new socket or switch',    value: 'install_outlet' },
        { label: 'Lighting installation or repair', value: 'lighting' },
        { label: 'Fan or AC wiring',                value: 'fan_ac' },
        { label: 'Fuse box / rewiring',             value: 'panel' },
        DISCUSS,
        { label: 'Other',                           value: 'other', allowText: true },
      ],
    },
    {
      id: 'work_area',
      question: 'Where is the work needed?',
      options: [
        { label: 'One room',                     value: 'one_room' },
        { label: 'Several rooms',                value: 'several_rooms' },
        { label: 'Whole property',               value: 'whole_property' },
        { label: 'Outdoors',                     value: 'outdoors' },
        { label: 'Fuse box / consumer unit',     value: 'fuse_box' },
      ],
    },
    {
      id: 'urgency',
      question: 'How urgent is this?',
      options: [
        { label: 'Emergency — safety hazard',  value: 'emergency' },
        { label: 'Urgent — within 24 hours',   value: 'urgent' },
        { label: 'This week',                  value: 'this_week' },
        { label: 'Flexible',                   value: 'flexible' },
      ],
    },
    {
      id: 'property_type',
      question: 'What type of property?',
      options: [
        { label: 'House',                 value: 'house' },
        { label: 'Apartment',             value: 'apartment' },
        { label: 'Business / Commercial', value: 'commercial' },
      ],
    },
  ],

  hvac: [
    {
      id: 'issue_type',
      question: 'What heating or cooling service do you need?',
      options: [
        { label: 'AC not cooling',                value: 'ac_repair' },
        { label: 'Heating not working',           value: 'heat_repair' },
        { label: 'Routine service / maintenance', value: 'maintenance' },
        { label: 'New system installation',       value: 'install' },
        { label: 'Duct cleaning',                 value: 'ducts' },
        DISCUSS,
        { label: 'Other',                         value: 'other', allowText: true },
      ],
    },
    {
      id: 'system_type',
      question: 'What system do you have?',
      options: [
        { label: 'Gas boiler',      value: 'gas_boiler' },
        { label: 'Combi boiler',    value: 'combi_boiler' },
        { label: 'Heat pump',       value: 'heat_pump' },
        { label: 'AC unit',         value: 'ac_unit' },
        { label: "I'm not sure",    value: 'not_sure' },
      ],
    },
    {
      id: 'urgency',
      question: 'How urgent is this?',
      options: [
        { label: 'Emergency — too hot/cold now', value: 'emergency' },
        { label: 'Urgent — within 24 hours',     value: 'urgent' },
        { label: 'This week',                    value: 'this_week' },
        { label: 'Flexible',                     value: 'flexible' },
      ],
    },
    {
      id: 'property_type',
      question: 'What type of property?',
      options: [
        { label: 'House',                 value: 'house' },
        { label: 'Apartment',             value: 'apartment' },
        { label: 'Business / Commercial', value: 'commercial' },
      ],
    },
  ],

  cleaner: [
    {
      id: 'clean_type',
      question: 'What kind of cleaning do you need?',
      options: [
        { label: 'Regular home cleaning',     value: 'regular' },
        { label: 'Deep / spring clean',       value: 'deep' },
        { label: 'Move-in / move-out clean',  value: 'move' },
        { label: 'Office / commercial',       value: 'commercial' },
        { label: 'Post-construction clean',   value: 'post_construction' },
        { label: 'Other',                     value: 'other', allowText: true },
      ],
    },
    {
      id: 'size',
      question: 'How large is the space?',
      options: [
        { label: 'Studio or 1 bedroom', value: 'small' },
        { label: '2–3 bedrooms',        value: 'medium' },
        { label: '4+ bedrooms',         value: 'large' },
        { label: 'Commercial space',    value: 'commercial' },
      ],
    },
    {
      id: 'frequency',
      question: 'How often do you need cleaning?',
      options: [
        { label: 'One-time only',    value: 'once' },
        { label: 'Weekly',           value: 'weekly' },
        { label: 'Every other week', value: 'biweekly' },
        { label: 'Monthly',          value: 'monthly' },
      ],
    },
    {
      id: 'start',
      question: 'When do you want to start?',
      options: [
        { label: 'As soon as possible',   value: 'asap' },
        { label: 'This week',             value: 'this_week' },
        { label: 'In the coming weeks',   value: 'coming_weeks' },
        { label: 'Flexible',              value: 'flexible' },
      ],
    },
  ],

  painter: [
    {
      id: 'paint_type',
      question: 'What needs painting?',
      options: [
        { label: 'Interior rooms',        value: 'interior' },
        { label: 'Exterior / outside',    value: 'exterior' },
        { label: 'Furniture or cabinets', value: 'furniture' },
        { label: 'Fence or deck',         value: 'fence' },
        { label: 'Other',                 value: 'other', allowText: true },
      ],
    },
    {
      id: 'size',
      question: 'Roughly how much area?',
      options: [
        { label: '1–2 rooms',  value: 'small' },
        { label: '3–5 rooms',  value: 'medium' },
        { label: 'Whole house',value: 'large' },
        { label: 'Not sure',   value: 'unsure' },
      ],
    },
    {
      id: 'condition',
      question: 'What condition are the surfaces in?',
      options: [
        { label: 'Good — just needs repainting',        value: 'good' },
        { label: 'Minor prep — small cracks or holes',  value: 'minor_prep' },
        { label: 'Repairs needed before painting',      value: 'repairs' },
        { label: 'Not sure',                            value: 'not_sure' },
      ],
    },
    {
      id: 'materials',
      question: 'Who supplies the paint?',
      options: [
        { label: 'The pro supplies the paint',  value: 'pro_supplies' },
        { label: 'I already have the paint',    value: 'i_supply' },
        DISCUSS,
      ],
    },
    {
      id: 'urgency',
      question: 'When do you need it done?',
      options: [
        { label: 'ASAP',        value: 'asap' },
        { label: 'This week',   value: 'this_week' },
        { label: 'This month',  value: 'this_month' },
        { label: 'Flexible',    value: 'flexible' },
      ],
    },
  ],

  landscaper: [
    {
      id: 'service_type',
      type: 'multi',
      question: 'What gardening or landscaping do you need?',
      hint: 'Select all that apply.',
      options: [
        { label: 'Lawn mowing / grass cutting',  value: 'mowing' },
        { label: 'Hedge cutting or trimming',    value: 'hedge' },
        { label: 'Garden design or planting',    value: 'garden' },
        { label: 'Tree trimming or removal',     value: 'tree' },
        { label: 'Irrigation system',            value: 'irrigation' },
        { label: 'Garden cleanup',               value: 'cleanup' },
        DISCUSS,
        { label: 'Other',                        value: 'other', allowText: true },
      ],
    },
    {
      id: 'property_kind',
      question: 'What kind of property needs the work?',
      options: [
        { label: 'Residential garden',        value: 'residential' },
        { label: 'Communal garden',           value: 'communal' },
        { label: 'Office or commercial',      value: 'commercial' },
        { label: 'Allotment',                 value: 'allotment' },
      ],
    },
    {
      id: 'condition',
      question: "What's the current condition of the garden?",
      options: [
        { label: 'Well-kept',             value: 'well_kept' },
        { label: 'Somewhere in between',  value: 'in_between' },
        { label: 'Overgrown',             value: 'overgrown' },
      ],
    },
    {
      id: 'waste',
      question: 'Who will remove the garden waste?',
      options: [
        { label: 'I can take care of the waste',        value: 'customer' },
        { label: "I'd like the pro to remove it",       value: 'pro' },
        { label: "There won't be much waste",           value: 'none' },
        DISCUSS,
      ],
    },
    {
      id: 'frequency',
      question: 'How often do you need this?',
      options: [
        { label: 'One-time',          value: 'once' },
        { label: 'Weekly',            value: 'weekly' },
        { label: 'Every other week',  value: 'biweekly' },
        { label: 'Monthly',           value: 'monthly' },
      ],
    },
  ],

  handyman: [
    {
      id: 'task_type',
      type: 'multi',
      question: 'What task do you need help with?',
      hint: 'Select all that apply.',
      options: [
        { label: 'Furniture assembly',          value: 'furniture' },
        { label: 'Mounting (TV, shelves, etc)', value: 'mounting' },
        { label: 'Door or window repair',       value: 'door_window' },
        { label: 'Minor plumbing fix',          value: 'plumbing' },
        { label: 'General repairs',             value: 'general' },
        DISCUSS,
        { label: 'Other',                       value: 'other', allowText: true },
      ],
    },
    {
      id: 'job_size',
      question: 'How big is the job?',
      options: [
        { label: 'Under an hour',     value: 'tiny' },
        { label: 'A few hours',       value: 'small' },
        { label: 'A full day',        value: 'medium' },
        { label: 'Multiple days',     value: 'large' },
        { label: 'Not sure',          value: 'not_sure' },
      ],
    },
    {
      id: 'urgency',
      question: 'How soon do you need it?',
      options: [
        { label: 'Today / tomorrow', value: 'urgent' },
        { label: 'This week',        value: 'this_week' },
        { label: 'Flexible',         value: 'flexible' },
      ],
    },
    {
      id: 'property_type',
      question: 'What type of property?',
      options: [
        { label: 'House',                 value: 'house' },
        { label: 'Apartment',             value: 'apartment' },
        { label: 'Business / Commercial', value: 'commercial' },
      ],
    },
  ],

  roofer: [
    {
      id: 'issue_type',
      question: 'What roofing work do you need?',
      options: [
        { label: 'Roof is leaking',            value: 'leak' },
        { label: 'Damaged or missing tiles',   value: 'shingles' },
        { label: 'Full roof replacement',      value: 'replacement' },
        { label: 'Gutter cleaning or repair',  value: 'gutters' },
        { label: 'Inspection',                 value: 'inspection' },
        DISCUSS,
        { label: 'Other',                      value: 'other', allowText: true },
      ],
    },
    {
      id: 'roof_type',
      question: 'What type of roof is it?',
      options: [
        { label: 'Pitched / sloped',  value: 'pitched' },
        { label: 'Flat',              value: 'flat' },
        { label: 'A mix of both',     value: 'mixed' },
        { label: 'Not sure',          value: 'not_sure' },
      ],
    },
    {
      id: 'storeys',
      question: 'How many storeys is the property?',
      hint: 'This affects access and scaffolding.',
      options: [
        { label: '1 storey',    value: 'one' },
        { label: '2 storeys',   value: 'two' },
        { label: '3 or more',   value: 'three_plus' },
      ],
    },
    {
      id: 'urgency',
      question: 'How urgent is this?',
      options: [
        { label: 'Emergency — active leak', value: 'emergency' },
        { label: 'Urgent — this week',      value: 'urgent' },
        { label: 'Flexible',                value: 'flexible' },
      ],
    },
  ],

  pest_control: [
    {
      id: 'pest_type',
      type: 'multi',
      question: 'What type of pest problem?',
      hint: 'Select all that apply.',
      options: [
        { label: 'Ants or roaches',      value: 'ants_roaches' },
        { label: 'Rodents (rats/mice)',  value: 'rodents' },
        { label: 'Termites',             value: 'termites' },
        { label: 'Wasps or bees',        value: 'wasps' },
        { label: 'Bed bugs',             value: 'bed_bugs' },
        DISCUSS,
        { label: 'Other',                value: 'other', allowText: true },
      ],
    },
    {
      id: 'where',
      question: 'Where is the problem?',
      options: [
        { label: 'Inside the property',   value: 'inside' },
        { label: 'Outside the property',  value: 'outside' },
        { label: 'Both',                  value: 'both' },
      ],
    },
    {
      id: 'urgency',
      question: 'How soon do you need treatment?',
      options: [
        { label: 'ASAP — severe infestation', value: 'emergency' },
        { label: 'This week',                 value: 'this_week' },
        { label: 'Flexible',                  value: 'flexible' },
      ],
    },
    {
      id: 'property_type',
      question: 'What type of property?',
      options: [
        { label: 'House',                 value: 'house' },
        { label: 'Apartment',             value: 'apartment' },
        { label: 'Business / Commercial', value: 'commercial' },
      ],
    },
  ],

  security: [
    {
      id: 'service_type',
      question: 'What security service do you need?',
      options: [
        { label: 'CCTV / camera install',    value: 'cctv' },
        { label: 'Alarm system',             value: 'alarm' },
        { label: 'Smart locks',              value: 'locks' },
        { label: 'Security guard / patrol',  value: 'guard' },
        { label: 'Security audit',           value: 'audit' },
        DISCUSS,
        { label: 'Other',                    value: 'other', allowText: true },
      ],
    },
    {
      id: 'monitoring',
      question: 'Do you want professional monitoring?',
      hint: 'A monitored system alerts a response service, not just your phone.',
      options: [
        { label: 'Yes — professionally monitored',  value: 'yes' },
        { label: 'No — self-monitored',             value: 'no' },
        { label: 'Not sure',                        value: 'not_sure' },
      ],
    },
    {
      id: 'timing',
      question: 'When do you need this?',
      options: [
        { label: 'ASAP',        value: 'asap' },
        { label: 'This week',   value: 'this_week' },
        { label: 'This month',  value: 'this_month' },
        { label: 'Flexible',    value: 'flexible' },
      ],
    },
    {
      id: 'property_type',
      question: 'What type of property?',
      options: [
        { label: 'Home',         value: 'home' },
        { label: 'Business',     value: 'business' },
        { label: 'Event venue',  value: 'event' },
      ],
    },
  ],

  carpenter: [
    {
      id: 'work_type',
      question: 'What carpentry work do you need?',
      options: [
        { label: 'Custom furniture',      value: 'furniture' },
        { label: 'Cabinets or shelving',  value: 'cabinets' },
        { label: 'Deck or pergola',       value: 'deck' },
        { label: 'Door or window frames', value: 'frames' },
        { label: 'Flooring',              value: 'flooring' },
        DISCUSS,
        { label: 'Other',                 value: 'other', allowText: true },
      ],
    },
    {
      id: 'job_size',
      question: 'How big is the job?',
      options: [
        { label: 'Small repair',                    value: 'small' },
        { label: 'A single piece or item',          value: 'single_piece' },
        { label: 'A whole room',                    value: 'room' },
        { label: 'Large project / multiple rooms',  value: 'large' },
        { label: 'Not sure',                        value: 'not_sure' },
      ],
    },
    {
      id: 'materials',
      question: 'Who supplies the materials?',
      options: [
        { label: 'The pro supplies materials',  value: 'pro_supplies' },
        { label: 'I already have materials',    value: 'i_supply' },
        DISCUSS,
      ],
    },
    {
      id: 'urgency',
      question: 'When do you need this?',
      options: [
        { label: 'ASAP',        value: 'asap' },
        { label: 'This week',   value: 'this_week' },
        { label: 'This month',  value: 'this_month' },
        { label: 'Flexible',    value: 'flexible' },
      ],
    },
  ],
}
