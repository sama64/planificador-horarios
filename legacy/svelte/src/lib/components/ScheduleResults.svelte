<script>
  import { scheduleResults, classData } from '../stores';
  import { formatScheduleOption } from '../scheduler';
  
  function formatSchedule(scheduleOption) {
    return formatScheduleOption(scheduleOption);
  }
  
  function getPrerequisiteNames(prerequisiteIds) {
    if (!prerequisiteIds || prerequisiteIds.length === 0) return 'Ninguno';
    
    let prereqNames = [];
    const classes = $classData;
    
    prerequisiteIds.forEach(id => {
      const found = classes.find(c => c.id === id);
      if (found) {
        prereqNames.push(found.name);
      }
    });
    
    return prereqNames.join(', ');
  }
  
  // Function to sort classes by day of week and time
  function sortClassesBySchedule(classes) {
    const dayOrder = {
      'Lunes': 1,
      'Martes': 2,
      'Miércoles': 3,
      'Jueves': 4,
      'Viernes': 5,
      'Sábado': 6,
      'Domingo': 7
    };
    
    function convertTimeToMinutes(timeStr) {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    }
    
    function normalizeScheduleOption(scheduleOption) {
      // Handle both simple and detailed formats
      if (scheduleOption.schedule && Array.isArray(scheduleOption.schedule)) {
        return scheduleOption.schedule;
      }
      
      if (scheduleOption.days && scheduleOption.startTime && scheduleOption.endTime) {
        return scheduleOption.days.map(day => ({
          day,
          startTime: scheduleOption.startTime,
          endTime: scheduleOption.endTime
        }));
      }
      
      return [];
    }
    
    function getEarliestDayAndTime(scheduleOption) {
      const normalized = normalizeScheduleOption(scheduleOption);
      if (normalized.length === 0) return { day: 8, time: 9999 }; // Fallback
      
      // Find the earliest day and time combination
      let earliestDay = 8;
      let earliestTime = 9999;
      
      normalized.forEach(slot => {
        const dayNum = dayOrder[slot.day] || 8;
        const timeNum = convertTimeToMinutes(slot.startTime);
        
        if (dayNum < earliestDay || (dayNum === earliestDay && timeNum < earliestTime)) {
          earliestDay = dayNum;
          earliestTime = timeNum;
        }
      });
      
      return { day: earliestDay, time: earliestTime };
    }
    
         return [...classes].sort((a, b) => {
       const scheduleA = getEarliestDayAndTime(a.scheduleOption);
       const scheduleB = getEarliestDayAndTime(b.scheduleOption);
       
       // First sort by day
       if (scheduleA.day !== scheduleB.day) {
         return scheduleA.day - scheduleB.day;
       }
       
       // Then sort by time
       return scheduleA.time - scheduleB.time;
     });
   }
   
   // Function to get classes for a specific day
   function getClassesForDay(classes, targetDay) {
     function normalizeScheduleOption(scheduleOption) {
       if (scheduleOption.schedule && Array.isArray(scheduleOption.schedule)) {
         return scheduleOption.schedule;
       }
       
       if (scheduleOption.days && scheduleOption.startTime && scheduleOption.endTime) {
         return scheduleOption.days.map(day => ({
           day,
           startTime: scheduleOption.startTime,
           endTime: scheduleOption.endTime
         }));
       }
       
       return [];
     }
     
     return classes.filter(classInfo => {
       const normalized = normalizeScheduleOption(classInfo.scheduleOption);
       return normalized.some(slot => slot.day === targetDay);
     }).sort((a, b) => {
       // Sort by start time within the day
       const timeA = getTimeForDay(a.scheduleOption, targetDay);
       const timeB = getTimeForDay(b.scheduleOption, targetDay);
       return timeA.localeCompare(timeB);
     });
   }
   
   // Function to get formatted time for a specific day
   function getTimeForDay(scheduleOption, targetDay) {
     function normalizeScheduleOption(scheduleOption) {
       if (scheduleOption.schedule && Array.isArray(scheduleOption.schedule)) {
         return scheduleOption.schedule;
       }
       
       if (scheduleOption.days && scheduleOption.startTime && scheduleOption.endTime) {
         return scheduleOption.days.map(day => ({
           day,
           startTime: scheduleOption.startTime,
           endTime: scheduleOption.endTime
         }));
       }
       
       return [];
     }
     
     const normalized = normalizeScheduleOption(scheduleOption);
     const daySlot = normalized.find(slot => slot.day === targetDay);
     
     if (daySlot) {
       return `${daySlot.startTime} - ${daySlot.endTime}`;
     }
     
     return '';
   }
  
  // Track how long calculation has been running
  let calculationStartTime = null;
  let calculationDuration = 0;
  let calculationTimer = null;
  
  // Update calculation duration every second
  $: if ($scheduleResults.isCalculating) {
    if (!calculationStartTime) {
      calculationStartTime = Date.now();
      calculationTimer = setInterval(() => {
        calculationDuration = Math.floor((Date.now() - calculationStartTime) / 1000);
      }, 1000);
    }
  } else {
    if (calculationTimer) {
      clearInterval(calculationTimer);
      calculationTimer = null;
    }
    calculationStartTime = null;
    calculationDuration = 0;
  }
</script>

<div>
  {#if $scheduleResults.isCalculating}
    <div class="flex flex-col justify-center items-center p-8">
      <span class="loading loading-spinner loading-lg"></span>
      <span class="mt-2">Calculando horario óptimo... ({calculationDuration}s)</span>
    </div>
  {:else if $scheduleResults.error}
    <div class="alert alert-error shadow-lg">
      <div>
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Error: {$scheduleResults.error}</span>
      </div>
    </div>
    
    <div class="alert alert-info mt-4">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <div>
        <span class="font-semibold">Sugerencias:</span>
        <ul class="list-disc ml-6 mt-1">
          <li>Marque más asignaturas como regulares</li>
          <li>Reduzca las restricciones de días a evitar</li>
          <li>Intente con preferencias de horario diferentes</li>
        </ul>
      </div>
    </div>
  {:else if $scheduleResults.success}
    <div class="mb-4">
      <div class="stats shadow">
        <div class="stat">
          <div class="stat-title">Períodos necesarios</div>
          <div class="stat-value">{$scheduleResults.totalPeriods}</div>
          <div class="stat-desc">Para completar todos los cursos</div>
        </div>
      </div>
    </div>
    
    <div class="grid grid-cols-1 gap-4">
      {#each Object.entries($scheduleResults.scheduleByPeriod) as [period, classes]}
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title">Período {period}</h2>
            
            <!-- Mobile View: Simple List -->
            <div class="block md:hidden">
              <div class="space-y-3">
                {#each sortClassesBySchedule(classes) as classInfo}
                  <div class="bg-base-200 p-4 rounded-lg border-l-4 border-primary">
                    <div class="flex justify-between items-start mb-2">
                      <h4 class="font-semibold text-lg">{classInfo.class.name}</h4>
                      <span class="badge badge-primary">{classInfo.class.hours}h</span>
                    </div>
                    <div class="text-sm text-base-content/80 mb-2">
                      📅 {formatSchedule(classInfo.scheduleOption)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      Prerrequisitos: {getPrerequisiteNames(classInfo.class.prerequisites)}
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Desktop/Tablet View: Calendar Grid -->
            <div class="hidden md:block">
              <!-- Days Header -->
              <div class="grid grid-cols-7 gap-2 mb-4">
                {#each ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as day}
                  <div class="text-center font-semibold p-3 bg-base-200 rounded-lg">
                    <div class="hidden lg:block">{day}</div>
                    <div class="lg:hidden">{day.slice(0, 3)}</div>
                  </div>
                {/each}
              </div>
              
              <!-- Calendar Grid -->
              <div class="grid grid-cols-7 gap-2 items-start">
                {#each ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as day}
                  <div class="bg-base-100 border border-base-300 rounded-lg p-2 min-h-[120px] h-full">
                    {#each getClassesForDay(classes, day) as classInfo}
                      <div class="mb-2 p-3 bg-primary text-primary-content rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer text-sm"
                           title="{classInfo.class.name} - {formatSchedule(classInfo.scheduleOption)}">
                        <div class="font-semibold truncate mb-1">{classInfo.class.name}</div>
                        <div class="text-xs opacity-90 mb-1">
                          {getTimeForDay(classInfo.scheduleOption, day)}
                        </div>
                        <div class="text-xs opacity-75">{classInfo.class.hours}h</div>
                      </div>
                    {/each}
                  </div>
                {/each}
              </div>
              
              <!-- Desktop Class Summary -->
              <div class="mt-6">
                <details class="collapse collapse-arrow bg-base-200">
                  <summary class="collapse-title text-lg font-medium">
                    Ver resumen detallado de clases
                  </summary>
                  <div class="collapse-content">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-3">
                      {#each sortClassesBySchedule(classes) as classInfo}
                        <div class="bg-base-100 p-3 rounded-lg border">
                          <div class="font-medium">{classInfo.class.name}</div>
                          <div class="text-sm text-base-content/70 mt-1">{formatSchedule(classInfo.scheduleOption)}</div>
                          <div class="text-xs text-base-content/60 mt-1">
                            {classInfo.class.hours} horas | Prereq: {getPrerequisiteNames(classInfo.class.prerequisites)}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body text-center">
        <h2 class="card-title justify-center">No hay resultados de horario</h2>
        <p>Seleccione sus asignaturas regulares y haga clic en "Calcular Horario" para generar un horario óptimo.</p>
      </div>
    </div>
  {/if}
</div> 