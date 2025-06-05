import { writable, derived } from 'svelte/store';
import { scheduleClasses } from './scheduler';

// Store for the faculty and curriculum selection
export const selectedFaculty = writable(null);
export const selectedCurriculum = writable(null);
export const selectionComplete = writable(false);

// Store for the class data
export const classData = writable([]);

// Store for user preferences
export const userPreferences = writable({
  noDays: [], // Days to avoid: "Lunes", "Martes", etc.
  timePreference: null, // "morning", "afternoon", "evening"
  maxClassesPerPeriod: null, // Maximum number of classes per period
  passedClasses: [], // IDs of classes already passed
  timeout: 30000, // Timeout in milliseconds (default: 30 seconds - much faster algorithm)
});

// Store for scheduling results
export const scheduleResults = writable({
  success: false,
  schedule: null,
  scheduleByPeriod: null,
  totalPeriods: 0,
  error: null,
  isCalculating: false
});

// Function to load class data from a JSON file
export async function loadClassData() {
  try {
    // Get the currently selected faculty and curriculum
    let faculty, curriculum;
    selectedFaculty.subscribe(value => { faculty = value; })();
    selectedCurriculum.subscribe(value => { curriculum = value; })();
    
    if (!faculty || !curriculum) {
      console.error('No faculty or curriculum selected');
      throw new Error('No se ha seleccionado una facultad o carrera');
    }
    
    // Construct the file path - make sure it has the right prefix for static files
    const filePath = `/data/${faculty}/${curriculum}.json`;
    console.log('Loading class data from:', filePath);
    
    // Explicitly log the fetch for debugging
    console.log('Fetching from URL:', window.location.origin + filePath);
    
    const response = await fetch(filePath);
    if (!response.ok) {
      console.error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      throw new Error(`No se pudieron cargar los datos: ${response.statusText}`);
    }
    
    let data = await response.json();
    console.log('Loaded JSON data successfully');
    
    // Add passed property to each class if not present
    data = data.map(cls => ({
      ...cls,
      passed: false // Default value
    }));
    
    console.log('Loaded class data:', data.length, 'classes');
    classData.set(data);
    return data;
  } catch (error) {
    console.error('Error loading class data:', error);
    classData.set([]); // Asegurarse de que el store tenga un valor válido
    throw error; // Re-lanzar el error para que pueda ser manejado por el componente
  }
}

// Function to calculate schedule based on current class data and preferences
export async function calculateSchedule() {
  try {
    console.log('Starting schedule calculation...');
    scheduleResults.update(r => ({ ...r, isCalculating: true, error: null }));
    
    // Get current values from stores
    let classes;
    let prefs;
    
    classData.subscribe(value => { classes = value; })();
    userPreferences.subscribe(value => { prefs = value; })();
    
    console.log('Current preferences:', prefs);
    console.log('Classes to schedule:', classes.length - prefs.passedClasses.length);
    
    // Apply passed classes filter
    const activeClasses = classes.filter(cls => !prefs.passedClasses.includes(cls.id));
    console.log('Active classes after filtering:', activeClasses.length);
    
    // Calculate the schedule
    console.time('Schedule calculation');
    const result = await scheduleClasses(activeClasses, prefs);
    console.timeEnd('Schedule calculation');
    
    console.log('Schedule calculation result:', result);
    
    // Update the store with results
    scheduleResults.set({
      ...result,
      isCalculating: false
    });
    
    return result;
  } catch (error) {
    console.error('Error calculating schedule:', error);
    scheduleResults.set({
      success: false,
      error: error.message,
      isCalculating: false
    });
    return { success: false, error: error.message };
  }
}

// Derived store that shows available classes (not passed yet)
export const availableClasses = derived(
  [classData, userPreferences], 
  ([$classData, $userPreferences]) => {
    return $classData.filter(cls => !$userPreferences.passedClasses.includes(cls.id));
  }
);

// Derived store for classes that can be taken (all prerequisites passed)
export const eligibleClasses = derived(
  [classData, userPreferences], 
  ([$classData, $userPreferences]) => {
    return $classData.filter(cls => {
      // Class not already passed
      if ($userPreferences.passedClasses.includes(cls.id)) {
        return false;
      }
      
      // All prerequisites are passed
      return cls.prerequisites.every(prereqId => 
        $userPreferences.passedClasses.includes(prereqId)
      );
    });
  }
); 