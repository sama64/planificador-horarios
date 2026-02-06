<script>
  import { userPreferences } from '../stores';
  
  const allDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const timePreferences = [
    { value: null, label: 'Sin preferencia' },
    { value: 'morning', label: 'Mañana (antes de 12:00)' },
    { value: 'afternoon', label: 'Tarde (12:00 - 18:00)' },
    { value: 'evening', label: 'Noche (después de 18:00)' }
  ];
  
  let mobileExpanded = false;
  let showHelpPopup = false;
  
  function toggleDay(day) {
    $userPreferences.noDays = $userPreferences.noDays.includes(day)
      ? $userPreferences.noDays.filter(d => d !== day)
      : [...$userPreferences.noDays, day];
  }
  
  function setTimePreference(value) {
    $userPreferences.timePreference = value === 'null' ? null : value;
  }
  
  function toggleHelpPopup() {
    showHelpPopup = !showHelpPopup;
  }
</script>

<div class="bg-base-100 p-4 rounded-lg shadow">
  <!-- Mobile dropdown header (visible only on mobile) -->
  <div class="flex md:hidden items-center justify-between w-full text-xl font-semibold mb-4">
    <button 
      class="flex items-center gap-2 hover:bg-base-200 -m-2 p-2 rounded flex-1"
      on:click={() => mobileExpanded = !mobileExpanded}
    >
      <span>Preferencias</span>
      <svg 
        class="w-5 h-5 transition-transform duration-200 ml-auto {mobileExpanded ? 'rotate-180' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </button>
    <button 
      class="w-5 h-5 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs hover:bg-gray-500 transition-colors ml-2"
      on:click={toggleHelpPopup}
    >
      ?
    </button>
  </div>
  
  <!-- Desktop header (visible only on desktop) -->
  <div class="hidden md:flex items-center gap-2 mb-4">
    <h2 class="text-xl font-semibold">Preferencias</h2>
    <div class="relative">
      <button 
        class="w-5 h-5 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs hover:bg-gray-500 transition-colors tooltip tooltip-bottom"
        data-tip="Las preferencias le permiten personalizar su horario, pero de no poder encontrar un horario que cumpla con sus preferencias, el sistema ignorará las preferencias para asegurar que todas las asignaturas puedan ser programadas."
      >
        ?
      </button>
    </div>
  </div>
  
  <!-- Content (always visible on desktop, collapsible on mobile) -->
  <div class="md:block {mobileExpanded ? 'block' : 'hidden'}">
    <div class="mb-4">
      <h3 class="font-medium mb-2">Días a evitar</h3>
      <div class="flex flex-wrap gap-2">
        {#each allDays as day}
          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              class="checkbox checkbox-primary" 
              checked={$userPreferences.noDays.includes(day)}
              on:change={() => toggleDay(day)}
            />
            <span>{day}</span>
          </label>
        {/each}
      </div>
    </div>
    
    <div class="mb-4">
      <h3 class="font-medium mb-2">Preferencia de horario</h3>
      <select 
        class="select select-bordered w-full" 
        value={$userPreferences.timePreference}
        on:change={(e) => setTimePreference(e.target.value)}
      >
        {#each timePreferences as pref}
          <option value={pref.value}>{pref.label}</option>
        {/each}
      </select>
    </div>
    
    <div class="mb-4">
      <h3 class="font-medium mb-2">Máximo de materias por cuatrimestre</h3>
      <input 
        type="number" 
        class="input input-bordered w-full" 
        min="1" 
        max="10" 
        bind:value={$userPreferences.maxClassesPerPeriod}
        placeholder="6"
      />
    </div>
  </div>
</div>

<!-- Mobile help popup -->
{#if showHelpPopup}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 md:hidden" on:click={toggleHelpPopup}>
    <div class="bg-base-100 p-6 rounded-lg shadow-xl m-4 max-w-sm" on:click|stopPropagation>
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-lg">Sobre preferencias</h3>
        <button class="btn btn-sm btn-circle btn-ghost" on:click={toggleHelpPopup}>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <p class="text-sm">
        Las preferencias le permiten personalizar su horario, pero de no poder encontrar un horario que cumpla con sus preferencias, el sistema ignorará las preferencias para asegurar que todas las asignaturas puedan ser programadas.
      </p>
      <div class="alert alert-warning mt-4 text-xs">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span><span class="font-bold">Importante:</span> Si el sistema no puede encontrar un horario que cumpla con sus preferencias, las ignorará automáticamente.</span>
      </div>
    </div>
  </div>
{/if} 