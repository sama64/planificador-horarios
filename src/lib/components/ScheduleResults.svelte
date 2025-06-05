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
            
            <div class="overflow-x-auto">
              <table class="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Asignatura</th>
                    <th>Horario</th>
                    <th>Horas</th>
                    <th>Prerrequisitos</th>
                  </tr>
                </thead>
                <tbody>
                  {#each sortClassesBySchedule(classes) as classInfo}
                    <tr>
                      <td>{classInfo.class.name}</td>
                      <td>{formatSchedule(classInfo.scheduleOption)}</td>
                      <td>{classInfo.class.hours}</td>
                      <td>{getPrerequisiteNames(classInfo.class.prerequisites)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
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