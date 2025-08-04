<script>
  import { classData, calculateSchedule, scheduleResults, selectionComplete, selectedFaculty, selectedCurriculum } from '$lib/stores';
  import ClassManager from '$lib/components/ClassManager.svelte';
  import PreferencesForm from '$lib/components/PreferencesForm.svelte';
  import ScheduleResults from '$lib/components/ScheduleResults.svelte';
  import FacultySelect from '$lib/components/FacultySelect.svelte';
  
  let loading = false;
  
  // Para mostrar los nombres formateados en lugar de IDs
  $: facultyName = getFacultyName($selectedFaculty);
  $: curriculumName = getCurriculumName($selectedFaculty, $selectedCurriculum);
  
  function getFacultyName(facultyId) {
    if (!facultyId) return '';
    
    const faculties = {
      'unlz': 'UNLZ - Facultad de Ingeniería'
    };
    
    return faculties[facultyId] || facultyId;
  }
  
  function getCurriculumName(facultyId, curriculumId) {
    if (!facultyId || !curriculumId) return '';
    
    const curriculums = {
      'unlz': {
        'mecatronica': 'Ingeniería en Mecatrónica',
        'industrial': 'Ingeniería Industrial',
        'mecanica': 'Ingeniería Mecánica',
      }
    };
    
    return curriculums[facultyId]?.[curriculumId] || curriculumId;
  }
  
  async function handleCalculate() {
    loading = true;
    try {
      await calculateSchedule();
    } catch (error) {
      console.error('Error calculating schedule:', error);
    } finally {
      loading = false;
    }
  }
</script>

<!-- Selector de Facultad y Carrera -->
<FacultySelect />

<!-- Contenido principal (solo visible después de seleccionar facultad y carrera) -->
{#if $selectionComplete}
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <div class="lg:col-span-1 space-y-4">
      <div class="text-center lg:text-left">
        <h1 class="text-2xl font-bold mb-2 hidden md:block">Planificador de Horarios</h1>
        <p class="text-base-content/70">Optimice su plan de estudios con el mínimo número de cuatrimestes.</p>
        
        <!-- Aviso de desarrollo -->
        <div class="alert alert-warning my-3 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div>
            <span class="font-semibold">Aviso:</span> Sistema en fase de desarrollo. Los resultados pueden contener errores.
            <br>
            <a href="https://wa.me/5491170600371" target="_blank" class="link link-primary text-xs">
              Contacto para reportar errores
            </a>
          </div>
        </div>
        
        <!-- Información de la facultad y carrera seleccionadas -->
        <div class="text-sm mt-2 p-2 bg-base-200 rounded-lg">
          <span class="font-semibold">Facultad:</span> {facultyName}
          <span class="mx-2">|</span>
          <span class="font-semibold">Carrera:</span> {curriculumName}
          <button class="btn btn-xs btn-ghost ml-2" on:click={() => $selectionComplete = false}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Cambiar
          </button>
        </div>
      </div>
    
      <PreferencesForm />
      
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <button 
            class="btn btn-primary w-full {loading ? 'loading' : ''}" 
            on:click={handleCalculate}
            disabled={loading || $classData.length === 0}
          >
            Calcular Horario Óptimo
          </button>
          
          {#if $classData.length === 0}
            <div class="text-sm text-error mt-2">
              Cargando datos de asignaturas...
            </div>
          {/if}
        </div>
      </div>
    </div>
    
    <div class="lg:col-span-2">
      <div class="card bg-base-100 shadow-xl mb-4">
        <div class="card-body">
          <h2 class="card-title">Resultados del Horario</h2>
          <ScheduleResults />
        </div>
      </div>
      
      <ClassManager />
    </div>
  </div>

  <div class="divider my-8">Instrucciones</div>

  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">Cómo usar el planificador</h2>
      
      <ol class="list-decimal list-inside space-y-2 mt-4">
        <li>Seleccione las asignaturas que ya tiene regular haciendo clic en ellas.</li>
        <li>Configure sus preferencias de horario (días a evitar, franja horaria preferida).</li>
        <li>Haga clic en "Calcular Horario Óptimo" para generar su plan de estudios.</li>
        <li>El sistema calculará el número mínimo de períodos necesarios para graduarse.</li>
        <li>Revise el horario generado y ajuste sus preferencias si es necesario.</li>
      </ol>
      
      <div class="alert alert-info mt-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span><span class="font-bold">Aviso:</span> El sistema se encuentra en fase de desarrollo y puede no funcionar correctamente.
          <br>
          <br>
          El sistema garantiza el cumplimiento de todos los prerrequisitos y evita conflictos de horario pero no garantiza que los horarios sean correctos.
        </span>
      </div>
    </div>
  </div>

{/if}
