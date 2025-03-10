<script>
  import { classData, userPreferences, eligibleClasses } from '../stores';
  import ClassCard from './ClassCard.svelte';
  
  let showAll = true;
  let searchQuery = '';
  
  $: filteredClasses = showAll 
    ? $classData
    : $eligibleClasses;
    
  $: searchResults = searchQuery 
    ? filteredClasses.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toString().includes(searchQuery))
    : filteredClasses;
  
  function toggleClassPassed(classId) {
    if ($userPreferences.passedClasses.includes(classId)) {
      $userPreferences.passedClasses = $userPreferences.passedClasses.filter(id => id !== classId);
    } else {
      $userPreferences.passedClasses = [...$userPreferences.passedClasses, classId];
    }
  }
</script>

<div class="bg-base-100 p-4 rounded-lg shadow mb-4">
  <h2 class="text-xl font-semibold mb-4">Asignaturas</h2>
  
  <div class="flex flex-col md:flex-row gap-4 mb-4">
    <div class="form-control flex-1">
      <div class="relative">
        <input 
          type="text" 
          placeholder="Buscar asignatura..." 
          class="input input-bordered w-full pr-10" 
          bind:value={searchQuery}
        />
        <button class="btn btn-square absolute top-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>
      </div>
    </div>
    
    <div class="form-control w-full md:w-auto">
      <label class="cursor-pointer label justify-between">
        <span class="label-text mr-2 flex items-center text-sm md:text-base">
          {showAll ? 'Mostrar todas' : 'Solo disponibles'}
          <div class="tooltip tooltip-top" data-tip={showAll ? 'Incluye todas las asignaturas, incluso las que tienen prerrequisitos pendientes' : 'Solo asignaturas cuyos prerrequisitos ya están aprobados'}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-4 h-4 stroke-current ml-1"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
        </span> 
        <input type="checkbox" class="toggle toggle-primary" bind:checked={showAll} />
      </label>
    </div>
  </div>
  
  <div class="stats shadow w-full mb-4 flex-wrap">
    <div class="stat">
      <div class="stat-figure text-primary">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <div class="stat-title text-sm md:text-base">Regulares</div>
      <div class="stat-value text-2xl md:text-3xl">{$userPreferences.passedClasses.length}</div>
      <div class="stat-desc text-xs">de {$classData.length} totales</div>
    </div>
    
    <div class="stat">
      <div class="stat-figure text-secondary">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
      </div>
      <div class="stat-title text-sm md:text-base">Disponibles</div>
      <div class="stat-value text-2xl md:text-3xl">{$eligibleClasses.length}</div>
      <div class="stat-desc text-xs">con prerrequisitos cumplidos</div>
    </div>
  </div>
  
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each searchResults as cls (cls.id)}
      <ClassCard
        classData={cls}
        passed={$userPreferences.passedClasses.includes(cls.id)}
        onClick={() => toggleClassPassed(cls.id)}
        showDetails={true}
      />
    {/each}
    
    {#if searchResults.length === 0}
      <div class="col-span-full text-center py-8">
        {#if searchQuery}
          <p class="text-gray-500">No se encontraron asignaturas que coincidan con la búsqueda "{searchQuery}".</p>
        {:else if !showAll && $eligibleClasses.length === 0}
          <p class="text-gray-500">No hay asignaturas disponibles. Marque algunas asignaturas como regulares para desbloquear nuevas asignaturas.</p>
        {:else}
          <p class="text-gray-500">No se encontraron asignaturas con los filtros actuales.</p>
        {/if}
      </div>
    {/if}
  </div>
</div> 