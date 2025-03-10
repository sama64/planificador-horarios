<script>
  import { classData, calculateSchedule, scheduleResults } from '$lib/stores';
  import ClassManager from '$lib/components/ClassManager.svelte';
  import PreferencesForm from '$lib/components/PreferencesForm.svelte';
  import ScheduleResults from '$lib/components/ScheduleResults.svelte';
  
  let loading = false;
  
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

<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
  <div class="lg:col-span-1 space-y-4">
    <div class="text-center lg:text-left">
      <h1 class="text-2xl font-bold mb-2">Planificador de Horarios</h1>
      <p class="text-base-content/70">Optimice su plan de estudios con el mínimo número de semestres.</p>
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
      <li>Seleccione las asignaturas que ya ha aprobado haciendo clic en ellas.</li>
      <li>Configure sus preferencias de horario (días a evitar, franja horaria preferida).</li>
      <li>Haga clic en "Calcular Horario Óptimo" para generar su plan de estudios.</li>
      <li>El sistema calculará el número mínimo de períodos necesarios para graduarse.</li>
      <li>Revise el horario generado y ajuste sus preferencias si es necesario.</li>
    </ol>
    
    <div class="alert alert-info mt-4">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span>El sistema garantiza el cumplimiento de todos los prerrequisitos y evita conflictos de horario.</span>
    </div>
  </div>
</div>
