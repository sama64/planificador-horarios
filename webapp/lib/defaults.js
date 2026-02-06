export const DEFAULT_CONSTRAINTS = {
  passedClassIds: [],
  forbiddenDays: [],
  keepFreeDays: [],
  avoidSaturdays: false,
  avoidSaturdaysMode: 'soft',
  timePreference: '',
  timePreferenceMode: 'soft',
  maxWeeklyHoursPerPeriod: '',
  maxClassesPerPeriod: '',
  penaltyWeights: {
    timePreference: 5,
    saturday: 3
  }
};

export const DAY_OPTIONS = [
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado'
];

export const TIME_PREFERENCE_OPTIONS = [
  { value: '', label: 'Sin preferencia' },
  { value: 'morning', label: 'Manana' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'evening', label: 'Noche' },
  { value: 'night', label: 'Noche tardia' },
  { value: 'afternoon_or_night', label: 'Tarde o noche' }
];
