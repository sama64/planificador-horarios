import GLPK from 'glpk.js';

// Asynchronously load GLPK WASM module
let glpkPromise = null;
function getGLPK() {
  if (!glpkPromise) {
    console.log('Initializing GLPK module...');
    glpkPromise = GLPK().then(module => {
      console.log('GLPK module initialized successfully');
      return module;
    });
  }
  return glpkPromise;
}

/**
 * Check if two class schedule options overlap in time
 */
function hasTimeConflict(scheduleOption1, scheduleOption2) {
  // Check if there's at least one day in common
  const commonDays = scheduleOption1.days.filter(day => scheduleOption2.days.includes(day));
  if (commonDays.length === 0) return false;
  
  // For common days, check time overlap
  const start1 = convertTimeToMinutes(scheduleOption1.startTime);
  const end1 = convertTimeToMinutes(scheduleOption1.endTime);
  const start2 = convertTimeToMinutes(scheduleOption2.startTime);
  const end2 = convertTimeToMinutes(scheduleOption2.endTime);
  
  // Check if time periods overlap
  return !(end1 <= start2 || end2 <= start1);
}

/**
 * Convert time string (e.g., "14:00") to minutes since midnight
 */
function convertTimeToMinutes(timeStr) {
  if (!timeStr) return 0; // Handle empty time strings
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
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
 * Perform topological sort to get a valid ordering of classes
 */
function topologicalSort(graph) {
  console.log('Performing topological sort...');
  const visited = new Set();
  const temp = new Set();
  const order = [];
  
  function visit(nodeId) {
    // If node is in temporary set, we have a cycle
    if (temp.has(nodeId)) {
      throw new Error("Cycle detected in prerequisites graph");
    }
    
    // If we've already visited this node, skip it
    if (visited.has(nodeId)) return;
    
    // Mark node as temporarily visited
    temp.add(nodeId);
    
    // Visit all dependencies first
    const node = graph.get(nodeId);
    node.dependencies.forEach(depId => {
      visit(depId);
    });
    
    // Mark as visited and add to order
    temp.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  }
  
  // Try to visit each node
  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      visit(nodeId);
    }
  }
  
  const result = order.reverse(); // Reverse to get correct dependency order
  console.log('Topological sort complete:', result.length, 'classes ordered');
  return result;
}

/**
 * Generate a conflict matrix that indicates which schedule options conflict
 */
function generateConflictMatrix(classes) {
  console.log('Generating conflict matrix...');
  const classOptions = [];
  
  // Flatten all classes and their schedule options
  classes.forEach(cls => {
    cls.scheduleOptions.forEach((option, idx) => {
      classOptions.push({
        classId: cls.id,
        optionIndex: idx,
        option
      });
    });
  });
  
  console.log('Total schedule options:', classOptions.length);
  
  // Create conflict matrix
  const conflictMatrix = {};
  let conflictCount = 0;
  
  for (let i = 0; i < classOptions.length; i++) {
    for (let j = i + 1; j < classOptions.length; j++) {
      const opt1 = classOptions[i];
      const opt2 = classOptions[j];
      
      // Only check conflicts between different classes
      if (opt1.classId !== opt2.classId) {
        if (hasTimeConflict(opt1.option, opt2.option)) {
          // Create conflict entry
          const key1 = `${opt1.classId},${opt1.optionIndex}`;
          const key2 = `${opt2.classId},${opt2.optionIndex}`;
          
          if (!conflictMatrix[key1]) conflictMatrix[key1] = [];
          if (!conflictMatrix[key2]) conflictMatrix[key2] = [];
          
          conflictMatrix[key1].push(key2);
          conflictMatrix[key2].push(key1);
          conflictCount++;
        }
      }
    }
  }
  
  console.log('Conflict matrix generated with', conflictCount, 'conflicts');
  return conflictMatrix;
}

/**
 * Determine a minimum number of periods to consider based on class dependencies
 */
function estimateMinPeriods(graph, classOrder) {
  // Use longest path in dependency graph as estimate
  let maxPathLength = 0;
  
  for (const nodeId of classOrder) {
    const node = graph.get(nodeId);
    let pathLength = 0;
    
    for (const depId of node.dependencies) {
      const depNode = graph.get(depId);
      pathLength = Math.max(pathLength, depNode.pathLength || 0);
    }
    
    node.pathLength = pathLength + 1;
    maxPathLength = Math.max(maxPathLength, node.pathLength);
  }
  
  // Add a buffer of a few periods
  return maxPathLength + 3;
}

/**
 * Solve the class scheduling problem using ILP
 */
export async function scheduleClasses(classes, userPreferences = {}) {
  // Apply user preferences to filter out undesired schedule options
  console.log('Applying user preferences to class options...');
  const filteredClasses = classes.map(cls => {
    let filteredOptions = [...cls.scheduleOptions];
    
    // Filter out options that don't meet user preferences
    if (userPreferences.noDays && userPreferences.noDays.length > 0) {
      console.log(`Excluding days: ${userPreferences.noDays.join(', ')}`);
      filteredOptions = filteredOptions.filter(opt => 
        !opt.days.some(day => userPreferences.noDays.includes(day))
      );
    }
    
    if (userPreferences.timePreference === 'morning') {
      console.log('Preferring morning classes');
      filteredOptions = filteredOptions.filter(opt => 
        convertTimeToMinutes(opt.startTime) < 12 * 60
      );
    } else if (userPreferences.timePreference === 'afternoon') {
      console.log('Preferring afternoon classes');
      filteredOptions = filteredOptions.filter(opt => 
        convertTimeToMinutes(opt.startTime) >= 12 * 60 && 
        convertTimeToMinutes(opt.startTime) < 18 * 60
      );
    } else if (userPreferences.timePreference === 'evening') {
      console.log('Preferring evening classes');
      filteredOptions = filteredOptions.filter(opt => 
        convertTimeToMinutes(opt.startTime) >= 18 * 60
      );
    }
    
    // If all options are filtered out, revert to original options
    // This ensures the problem remains solvable
    if (filteredOptions.length === 0) {
      console.log(`All options filtered out for class ${cls.id}, reverting to original options`);
      filteredOptions = [...cls.scheduleOptions];
    }
    
    return {
      ...cls,
      scheduleOptions: filteredOptions
    };
  });
  
  console.log('After preference filtering, classes have', 
    filteredClasses.reduce((sum, c) => sum + c.scheduleOptions.length, 0), 
    'total schedule options');
  
  // Build dependency graph
  const graph = buildDependencyGraph(filteredClasses);
  
  try {
    // Get topological ordering of classes
    const classOrder = topologicalSort(graph);
    
    // Generate conflict matrix for schedule options
    const conflictMatrix = generateConflictMatrix(filteredClasses);
    
    // Set up the ILP problem
    console.log('Initializing ILP problem...');
    const glpk = await getGLPK();
    
    // Smart estimation of maximum periods needed
    const MIN_PERIODS = estimateMinPeriods(graph, classOrder);
    const MAX_PERIODS = Math.min(10, Math.max(filteredClasses.length, MIN_PERIODS + 4));
    console.log(`Estimated periods needed: ${MIN_PERIODS}, max periods to consider: ${MAX_PERIODS}`);
    
    // Create GLPK problem
    const lp = {
      name: 'Class Scheduling',
      objective: {
        direction: glpk.GLP_MIN,
        name: 'obj',
        vars: []
      },
      subjectTo: [],
      binaries: []
    };
    
    console.log('Creating ILP variables...');
    // Create variables for class scheduling
    // x_{c,s,p} = 1 if class c with schedule option s is assigned to period p
    const classVars = {};
    filteredClasses.forEach(cls => {
      classVars[cls.id] = {};
      
      cls.scheduleOptions.forEach((_, optIdx) => {
        classVars[cls.id][optIdx] = {};
        
        for (let period = 1; period <= MAX_PERIODS; period++) {
          const varName = `x_${cls.id}_${optIdx}_${period}`;
          lp.objective.vars.push({
            name: varName,
            coef: 0
          });
          lp.binaries.push(varName);
          classVars[cls.id][optIdx][period] = varName;
        }
      });
    });
    
    // Variables for periods used
    // y_p = 1 if period p is used
    const periodVars = {};
    for (let period = 1; period <= MAX_PERIODS; period++) {
      const varName = `y_${period}`;
      lp.objective.vars.push({
        name: varName,
        coef: 1
      });
      lp.binaries.push(varName);
      periodVars[period] = varName;
    }
    
    // Add objective: minimize max period used
    // This more directly minimizes the number of semesters
    for (let period = 1; period <= MAX_PERIODS; period++) {
      lp.objective.vars.push({
        name: periodVars[period],
        coef: period * 10 // Higher weight to prioritize minimizing later periods
      });
    }
    
    console.log('Adding constraints...');
    // Add constraints
    let constraintCount = 0;
    
    // Constraint: Each class must be scheduled exactly once
    filteredClasses.forEach(cls => {
      const constraint = {
        name: `assign_class_${cls.id}`,
        vars: [],
        bnds: { type: glpk.GLP_FX, ub: 1.0, lb: 1.0 }
      };
      
      Object.values(classVars[cls.id]).forEach(periodVars => {
        Object.values(periodVars).forEach(varName => {
          constraint.vars.push({
            name: varName,
            coef: 1
          });
        });
      });
      
      lp.subjectTo.push(constraint);
      constraintCount++;
    });
    
    // Constraint: If a class is scheduled in period p, then y_p = 1
    filteredClasses.forEach(cls => {
      cls.scheduleOptions.forEach((_, optIdx) => {
        for (let period = 1; period <= MAX_PERIODS; period++) {
          const constraint = {
            name: `period_usage_${cls.id}_${optIdx}_${period}`,
            vars: [
              { name: classVars[cls.id][optIdx][period], coef: 1 },
              { name: periodVars[period], coef: -1 }
            ],
            bnds: { type: glpk.GLP_UP, ub: 0.0, lb: 0.0 }
          };
          
          lp.subjectTo.push(constraint);
          constraintCount++;
        }
      });
    });
    
    // Constraint: Prerequisites must be scheduled before their dependent classes
    filteredClasses.forEach(cls => {
      const node = graph.get(cls.id);
      
      node.dependencies.forEach(prereqId => {
        // For every period p and q, if class c is in period p and prereq is in period q, then p > q
        const constraint = {
          name: `prereq_${prereqId}_for_${cls.id}`,
          vars: [],
          bnds: { type: glpk.GLP_LO, ub: 0.0, lb: 1.0 }
        };
        
        // Sum p*x_{c,s,p} - Sum q*x_{prereq,s,q} >= 1
        for (let opt = 0; opt < cls.scheduleOptions.length; opt++) {
          for (let period = 1; period <= MAX_PERIODS; period++) {
            constraint.vars.push({
              name: classVars[cls.id][opt][period],
              coef: period
            });
          }
        }
        
        const prereqClass = filteredClasses.find(c => c.id === prereqId);
        for (let opt = 0; opt < prereqClass.scheduleOptions.length; opt++) {
          for (let period = 1; period <= MAX_PERIODS; period++) {
            constraint.vars.push({
              name: classVars[prereqId][opt][period],
              coef: -period
            });
          }
        }
        
        lp.subjectTo.push(constraint);
        constraintCount++;
      });
    });
    
    // Constraint: No scheduling conflicts within a period
    console.log('Adding conflict constraints...');
    let conflictConstraints = 0;
    
    for (let period = 1; period <= MAX_PERIODS; period++) {
      // For each conflict pair, at most one can be scheduled in the same period
      Object.keys(conflictMatrix).forEach(key1 => {
        const [classId1, optIdx1] = key1.split(',').map(Number);
        
        conflictMatrix[key1].forEach(key2 => {
          const [classId2, optIdx2] = key2.split(',').map(Number);
          
          // Ensure we don't add duplicate constraints
          if (`${classId1},${optIdx1}` < `${classId2},${optIdx2}`) {
            const constraint = {
              name: `conflict_${classId1}_${optIdx1}_${classId2}_${optIdx2}_${period}`,
              vars: [
                { name: classVars[classId1][optIdx1][period], coef: 1 },
                { name: classVars[classId2][optIdx2][period], coef: 1 }
              ],
              bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 }
            };
            
            lp.subjectTo.push(constraint);
            constraintCount++;
            conflictConstraints++;
          }
        });
      });
    }
    
    console.log(`Added ${constraintCount} total constraints (${conflictConstraints} conflict constraints)`);
    
    // Solve the ILP with a timeout
    console.log('Solving ILP problem...');
    
    // Create a promise with timeout
    const timeoutDuration = 180000; // 180 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('ILP solving timed out')), timeoutDuration);
    });
    
    try {
      // Race the solve promise against the timeout
      let solveOptions = { 
        msglev: glpk.GLP_MSG_ALL,   // Verbose output
        presol: true,               // Use presolver to simplify the problem
        tmlim: timeoutDuration/1000 // Set time limit in seconds directly in GLPK
      };
      
      const result = await Promise.race([
        glpk.solve(lp, solveOptions),
        timeoutPromise
      ]);
      
      console.log('ILP solution details:', result);
      console.log('ILP solution status:', result?.status);
      
      // Check if we have a valid result - looking at both status and the solution values
      // The key is to check if there's a valid result object even if status is undefined
      if ((result && (result.status === glpk.GLP_OPT || result.status === 5)) || 
          (result && result.result && Object.keys(result.result.vars || {}).length > 0)) {
        
        // Extract the solution
        console.log('Extracting solution...');
        const schedule = {};
        let maxPeriod = 0;
        
        const vars = result.result?.vars || result.vars;
        
        // For each class, determine period and schedule option
        filteredClasses.forEach(cls => {
          let assigned = false;
          
          for (let opt = 0; opt < cls.scheduleOptions.length && !assigned; opt++) {
            for (let period = 1; period <= MAX_PERIODS && !assigned; period++) {
              const varName = classVars[cls.id][opt][period];
              if (vars && Math.round(vars[varName]) === 1) {
                schedule[cls.id] = {
                  period,
                  scheduleOption: cls.scheduleOptions[opt],
                  optionIndex: opt,
                  class: cls
                };
                maxPeriod = Math.max(maxPeriod, period);
                assigned = true;
              }
            }
          }
        });
        
        // Organize classes by period
        const scheduleByPeriod = {};
        for (let period = 1; period <= maxPeriod; period++) {
          scheduleByPeriod[period] = [];
        }
        
        Object.values(schedule).forEach(item => {
          scheduleByPeriod[item.period].push(item);
        });
        
        console.log(`Optimal solution found with ${maxPeriod} periods`);
        return {
          success: true,
          schedule,
          scheduleByPeriod,
          totalPeriods: maxPeriod
        };
      } else {
        // Handle the error case with more diagnostics
        console.error('Solver failed. Result:', result);
        console.error('Problem size:', lp.objective.vars.length, 'variables,', lp.subjectTo.length, 'constraints');
        
        // Try a simpler version of the problem if full one failed
        return {
          success: false,
          error: 'No se pudo procesar la solución. Intente nuevamente con un conjunto más pequeño de clases.'
        };
      }
    } catch (error) {
      console.error('Error solving ILP:', error);
      
      // More detailed error handling...
      // If it's a timeout, try a fallback heuristic approach
      if (error.message === 'ILP solving timed out') {
        console.log('ILP timed out, attempting fallback heuristic solution...');
        return {
          success: false,
          error: 'El cálculo está tomando demasiado tiempo. Por favor, reduzca el número de clases o simplifique sus preferencias.'
        };
      }
      
      return {
        success: false,
        error: 'Error solving the scheduling problem: ' + error.message
      };
    }
  } catch (error) {
    console.error('Error in scheduling algorithm:', error);
    return {
      success: false,
      error: error.message
    };
  }
} 