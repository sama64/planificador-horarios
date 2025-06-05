/**
 * Fast class scheduling using DAG-based greedy approach with backtracking
 * Much faster than ILP while still finding optimal/near-optimal solutions
 */

/**
 * Normalize a schedule option to handle both simple and detailed formats
 * Simple format: { days: ["Lunes", "Martes"], startTime: "14:00", endTime: "18:00" }
 * Detailed format: { schedule: [{ day: "Lunes", startTime: "14:00", endTime: "18:00" }, { day: "Sábado", startTime: "08:30", endTime: "12:30" }] }
 */
function normalizeScheduleOption(scheduleOption) {
  // If it already has a schedule array, it's in detailed format
  if (scheduleOption.schedule && Array.isArray(scheduleOption.schedule)) {
    return scheduleOption.schedule;
  }
  
  // Otherwise, it's in simple format - convert to detailed format
  if (scheduleOption.days && scheduleOption.startTime && scheduleOption.endTime) {
    return scheduleOption.days.map(day => ({
      day,
      startTime: scheduleOption.startTime,
      endTime: scheduleOption.endTime
    }));
  }
  
  console.error('Invalid schedule option format:', scheduleOption);
  return [];
}

/**
 * Check if two class schedule options overlap in time
 */
function hasTimeConflict(scheduleOption1, scheduleOption2) {
  const schedule1 = normalizeScheduleOption(scheduleOption1);
  const schedule2 = normalizeScheduleOption(scheduleOption2);
  
  // Check each day/time combination in schedule1 against each in schedule2
  for (const slot1 of schedule1) {
    for (const slot2 of schedule2) {
      // Check if they're on the same day
      if (slot1.day === slot2.day) {
        // Check if time periods overlap
        const start1 = convertTimeToMinutes(slot1.startTime);
        const end1 = convertTimeToMinutes(slot1.endTime);
        const start2 = convertTimeToMinutes(slot2.startTime);
        const end2 = convertTimeToMinutes(slot2.endTime);
        
        // If times overlap on the same day, there's a conflict
        if (!(end1 <= start2 || end2 <= start1)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Convert time string (e.g., "14:00") to minutes since midnight
 */
function convertTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get all days from a schedule option (works with both formats)
 */
function getDaysFromScheduleOption(scheduleOption) {
  const normalized = normalizeScheduleOption(scheduleOption);
  return normalized.map(slot => slot.day);
}

/**
 * Format a schedule option for display (works with both formats)
 * @param {Object} scheduleOption - Schedule option in either format
 * @returns {string} Formatted schedule string
 */
export function formatScheduleOption(scheduleOption) {
  if (!scheduleOption) return '';
  
  const normalized = normalizeScheduleOption(scheduleOption);
  if (normalized.length === 0) return '';
  
  // Group by unique time slots
  const timeSlots = new Map();
  
  normalized.forEach(slot => {
    const timeKey = `${slot.startTime}-${slot.endTime}`;
    if (!timeSlots.has(timeKey)) {
      timeSlots.set(timeKey, []);
    }
    timeSlots.get(timeKey).push(slot.day);
  });
  
  // Format each time slot
  const formattedSlots = Array.from(timeSlots.entries()).map(([timeKey, days]) => {
    const [startTime, endTime] = timeKey.split('-');
    return `${days.join(', ')} ${startTime} - ${endTime}`;
  });
  
  return formattedSlots.join(' | ');
}

/**
 * Build a dependency graph from the class data
 */
function buildDependencyGraph(classes) {
  console.log('Building dependency graph...');
  const graph = new Map();
  
  // Initialize graph with empty adjacency lists
  classes.forEach(cls => {
    graph.set(cls.id, { 
      dependencies: [], 
      dependents: [],
      class: cls 
    });
  });
  
  // Fill in dependencies and dependents
  classes.forEach(cls => {
    const node = graph.get(cls.id);
    
    cls.prerequisites.forEach(prereqId => {
      if (graph.has(prereqId)) {
        node.dependencies.push(prereqId);
        graph.get(prereqId).dependents.push(cls.id);
      }
    });
  });
  
  console.log('Dependency graph built with', graph.size, 'nodes');
  return graph;
}

/**
 * Calculate earliest possible semester for each class based on prerequisites
 */
function calculateEarliestSemesters(graph, classes) {
  console.log('Calculating earliest possible semesters...');
  const eps = new Map(); // earliest possible semester
  
  function calculateEPS(classId) {
    if (eps.has(classId)) {
      return eps.get(classId);
    }
    
    const node = graph.get(classId);
    if (node.dependencies.length === 0) {
      eps.set(classId, 1);
      return 1;
    }
    
    let maxPrereqSemester = 0;
    for (const prereqId of node.dependencies) {
      maxPrereqSemester = Math.max(maxPrereqSemester, calculateEPS(prereqId));
    }
    
    const result = maxPrereqSemester + 1;
    eps.set(classId, result);
    return result;
  }
  
  // Calculate EPS for all classes
  classes.forEach(cls => calculateEPS(cls.id));
  
  console.log('Earliest semesters calculated');
  return eps;
}

/**
 * Create a schedule state that tracks occupied time slots per semester
 */
function createScheduleState() {
  return {
    assignments: new Map(), // classId -> {semester, optionIndex, scheduleOption}
    semesterSlots: new Map(), // semester -> array of occupied schedule options
    maxSemester: 0
  };
}

/**
 * Check if a schedule option can fit in a given semester
 */
function canFitInSemester(scheduleOption, semesterSlots) {
  if (!semesterSlots || semesterSlots.length === 0) {
    return true;
  }
  
  return !semesterSlots.some(occupiedOption => hasTimeConflict(scheduleOption, occupiedOption));
}

/**
 * Try to assign a class to the earliest possible semester
 */
function assignClass(state, cls, eps, minSemester = null) {
  const earliestSemester = minSemester || eps.get(cls.id);
  
  // Try each schedule option
  for (let optionIndex = 0; optionIndex < cls.scheduleOptions.length; optionIndex++) {
    const scheduleOption = cls.scheduleOptions[optionIndex];
    
    // Try semesters starting from the earliest possible
    for (let semester = earliestSemester; semester <= earliestSemester + 3; semester++) {
      const semesterSlots = state.semesterSlots.get(semester) || [];
      
      if (canFitInSemester(scheduleOption, semesterSlots)) {
        // Assign the class
        state.assignments.set(cls.id, {
          semester,
          optionIndex,
          scheduleOption,
          class: cls
        });
        
        // Update semester slots
        if (!state.semesterSlots.has(semester)) {
          state.semesterSlots.set(semester, []);
        }
        state.semesterSlots.get(semester).push(scheduleOption);
        
        // Update max semester
        state.maxSemester = Math.max(state.maxSemester, semester);
        
        return true;
      }
    }
  }
  
  return false; // Could not assign
}

/**
 * Remove a class assignment from the state
 */
function unassignClass(state, classId) {
  const assignment = state.assignments.get(classId);
  if (!assignment) return;
  
  const { semester, scheduleOption } = assignment;
  
  // Remove from assignments
  state.assignments.delete(classId);
  
  // Remove from semester slots
  const semesterSlots = state.semesterSlots.get(semester);
  if (semesterSlots) {
    const index = semesterSlots.findIndex(opt => opt === scheduleOption);
    if (index !== -1) {
      semesterSlots.splice(index, 1);
    }
    
    // If semester is now empty, remove it
    if (semesterSlots.length === 0) {
      state.semesterSlots.delete(semester);
    }
  }
  
  // Recalculate max semester
  state.maxSemester = Math.max(0, ...Array.from(state.semesterSlots.keys()));
}

/**
 * Greedy assignment with backtracking
 */
function solveWithBacktracking(classes, graph, eps, userPreferences, bestSolutionRef) {
  console.log('Starting greedy assignment with backtracking...');
  
  // Sort classes by earliest semester, then by number of dependents (more constrained first)
  const sortedClasses = [...classes].sort((a, b) => {
    const epsA = eps.get(a.id);
    const epsB = eps.get(b.id);
    
    if (epsA !== epsB) {
      return epsA - epsB;
    }
    
    // Break ties by number of dependents (more constrained first)
    const dependentsA = graph.get(a.id).dependents.length;
    const dependentsB = graph.get(b.id).dependents.length;
    
    if (dependentsA !== dependentsB) {
      return dependentsB - dependentsA;
    }
    
    // Finally, break ties by number of schedule options (fewer options = more constrained)
    return a.scheduleOptions.length - b.scheduleOptions.length;
  });
  
  const maxClassesPerSemester = userPreferences.maxClassesPerPeriod || 999;
  
  function backtrack(classIndex, state) {
    // Pruning: if current max semester >= best found solution, abandon this branch
    if (bestSolutionRef.maxSemester > 0 && state.maxSemester >= bestSolutionRef.maxSemester) {
      return false;
    }
    
    // Base case: all classes assigned
    if (classIndex >= sortedClasses.length) {
      // Found a complete solution
      if (bestSolutionRef.maxSemester === 0 || state.maxSemester < bestSolutionRef.maxSemester) {
        bestSolutionRef.maxSemester = state.maxSemester;
        bestSolutionRef.assignments = new Map(state.assignments);
        console.log(`New best solution found: ${state.maxSemester} semesters`);
      }
      return true;
    }
    
    const cls = sortedClasses[classIndex];
    const minSemester = eps.get(cls.id);
    
    // Try each schedule option
    for (let optionIndex = 0; optionIndex < cls.scheduleOptions.length; optionIndex++) {
      const scheduleOption = cls.scheduleOptions[optionIndex];
      
      // Try semesters starting from the earliest possible
      for (let semester = minSemester; semester <= minSemester + 2; semester++) { // Limit search depth
        const semesterSlots = state.semesterSlots.get(semester) || [];
        
        // Check max classes per semester constraint
        if (semesterSlots.length >= maxClassesPerSemester) {
          continue;
        }
        
        if (canFitInSemester(scheduleOption, semesterSlots)) {
          // Make assignment
          const oldMaxSemester = state.maxSemester;
          
          state.assignments.set(cls.id, {
            semester,
            optionIndex,
            scheduleOption,
            class: cls
          });
          
          if (!state.semesterSlots.has(semester)) {
            state.semesterSlots.set(semester, []);
          }
          state.semesterSlots.get(semester).push(scheduleOption);
          state.maxSemester = Math.max(state.maxSemester, semester);
          
          // Recurse
          if (backtrack(classIndex + 1, state)) {
            // If we found the optimal solution (can't get better), return early
            if (bestSolutionRef.maxSemester === Math.max(1, ...Array.from(eps.values()))) {
              return true;
            }
          }
          
          // Backtrack
          unassignClass(state, cls.id);
          state.maxSemester = oldMaxSemester;
        }
      }
    }
    
    return false;
  }
  
  const initialState = createScheduleState();
  backtrack(0, initialState);
  
  return bestSolutionRef.assignments.size === classes.length;
}

/**
 * Fast greedy approach as fallback
 */
function solveGreedy(classes, graph, eps) {
  console.log('Using fast greedy approach...');
  
  const sortedClasses = [...classes].sort((a, b) => {
    const epsA = eps.get(a.id);
    const epsB = eps.get(b.id);
    return epsA - epsB;
  });
  
  const state = createScheduleState();
  
  for (const cls of sortedClasses) {
    if (!assignClass(state, cls, eps)) {
      console.error(`Could not assign class ${cls.name} (${cls.id})`);
      return null;
    }
  }
  
  return state;
}

/**
 * Main scheduling function - much faster than ILP approach
 */
export async function scheduleClasses(classes, userPreferences = {}) {
  console.log('Starting fast scheduling algorithm...');
  console.time('Total scheduling time');
  
  // Apply user preferences to filter schedule options
  console.log('Applying user preferences...');
  const filteredClasses = classes.map(cls => {
    let filteredOptions = [...cls.scheduleOptions];
    
    // Filter by excluded days
    if (userPreferences.noDays && userPreferences.noDays.length > 0) {
      filteredOptions = filteredOptions.filter(opt => {
        const days = getDaysFromScheduleOption(opt);
        return !days.some(day => userPreferences.noDays.includes(day));
      });
    }
    
    // Filter by time preference
    if (userPreferences.timePreference === 'morning') {
      filteredOptions = filteredOptions.filter(opt => {
        const schedule = normalizeScheduleOption(opt);
        return schedule.every(slot => convertTimeToMinutes(slot.startTime) < 12 * 60);
      });
    } else if (userPreferences.timePreference === 'afternoon') {
      filteredOptions = filteredOptions.filter(opt => {
        const schedule = normalizeScheduleOption(opt);
        return schedule.every(slot => 
          convertTimeToMinutes(slot.startTime) >= 12 * 60 && 
          convertTimeToMinutes(slot.startTime) < 18 * 60
        );
      });
    } else if (userPreferences.timePreference === 'evening') {
      filteredOptions = filteredOptions.filter(opt => {
        const schedule = normalizeScheduleOption(opt);
        return schedule.every(slot => convertTimeToMinutes(slot.startTime) >= 18 * 60);
      });
    }
    
    // Ensure at least one option remains
    if (filteredOptions.length === 0) {
      filteredOptions = [...cls.scheduleOptions];
    }
    
    return { ...cls, scheduleOptions: filteredOptions };
  });
  
  // Build dependency graph and calculate earliest semesters
  const graph = buildDependencyGraph(filteredClasses);
  const eps = calculateEarliestSemesters(graph, filteredClasses);
  
  console.log('Theoretical minimum semesters:', Math.max(...Array.from(eps.values())));
  
  // Use backtracking approach (fast enough to not need timeout)
  const bestSolution = { maxSemester: 0, assignments: new Map() };
  
  try {
    // Run backtracking
    const success = solveWithBacktracking(filteredClasses, graph, eps, userPreferences, bestSolution);
    
    // If backtracking didn't find solution, fall back to greedy
    if (!success || bestSolution.assignments.size === 0) {
      console.log('Backtracking incomplete, using greedy fallback...');
      const greedyState = solveGreedy(filteredClasses, graph, eps);
      
      if (greedyState) {
        bestSolution.maxSemester = greedyState.maxSemester;
        bestSolution.assignments = greedyState.assignments;
      }
    }
    
  } catch (error) {
    console.error('Error in backtracking, using greedy fallback:', error);
    const greedyState = solveGreedy(filteredClasses, graph, eps);
    
    if (greedyState) {
      bestSolution.maxSemester = greedyState.maxSemester;
      bestSolution.assignments = greedyState.assignments;
    }
  }
  
  console.timeEnd('Total scheduling time');
  
  // Check if we have a valid solution
  if (bestSolution.assignments.size === 0) {
    return {
      success: false,
      error: 'No se pudo encontrar una solución válida. Verifique los prerrequisitos y horarios.'
    };
  }
  
  // Convert to expected format
  const schedule = {};
  const scheduleByPeriod = {};
  
  bestSolution.assignments.forEach((assignment, classId) => {
    schedule[classId] = assignment;
    
    if (!scheduleByPeriod[assignment.semester]) {
      scheduleByPeriod[assignment.semester] = [];
    }
    scheduleByPeriod[assignment.semester].push(assignment);
  });
  
  console.log(`Solution found: ${bestSolution.maxSemester} semesters, ${filteredClasses.length} classes scheduled`);
  
        return {
          success: true,
          schedule,
          scheduleByPeriod,
    totalPeriods: bestSolution.maxSemester
  };
}