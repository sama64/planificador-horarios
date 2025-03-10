<script>
  import { classData, userPreferences, eligibleClasses } from '../stores';
  import ClassCard from './ClassCard.svelte';
  
  let showAll = false;
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
      <div class="input-group">
        <input 
          type="text" 
          placeholder="Buscar asignatura..." 
          class="input input-bordered w-full" 
          bind:value={searchQuery}
        />
        <button class="btn btn-square">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>
      </div>
    </div>
    
    <div class="form-control">
      <label class="cursor-pointer label">
        <span class="label-text mr-2">Mostrar todas las asignaturas</span> 
        <input type="checkbox" class="toggle toggle-primary" bind:checked={showAll} />
      </label>
    </div>
  </div>
  
  <div class="stats shadow w-full mb-4">
    <div class="stat">
      <div class="stat-figure text-primary">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <div class="stat-title">Asignaturas aprobadas</div>
      <div class="stat-value">{$userPreferences.passedClasses.length}</div>
      <div class="stat-desc">de {$classData.length} totales</div>
    </div>
    
    <div class="stat">
      <div class="stat-figure text-secondary">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
      </div>
      <div class="stat-title">Asignaturas disponibles</div>
      <div class="stat-value">{$eligibleClasses.length}</div>
      <div class="stat-desc">con prerrequisitos cumplidos</div>
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
        <p class="text-gray-500">No se encontraron asignaturas que coincidan con la búsqueda.</p>
      </div>
    {/if}
  </div>
</div> 