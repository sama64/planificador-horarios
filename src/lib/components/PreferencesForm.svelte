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
  
  function toggleDay(day) {
    $userPreferences.noDays = $userPreferences.noDays.includes(day)
      ? $userPreferences.noDays.filter(d => d !== day)
      : [...$userPreferences.noDays, day];
  }
  
  function setTimePreference(value) {
    $userPreferences.timePreference = value === 'null' ? null : value;
  }
</script>

<div class="bg-base-100 p-4 rounded-lg shadow">
  <!-- Mobile dropdown header (visible only on mobile) -->
  <button 
    class="flex md:hidden items-center justify-between w-full text-xl font-semibold mb-4 hover:bg-base-200 -m-2 p-2 rounded"
    on:click={() => mobileExpanded = !mobileExpanded}
  >
    <span>Preferencias</span>
    <svg 
      class="w-5 h-5 transition-transform duration-200 {mobileExpanded ? 'rotate-180' : ''}" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
    </svg>
  </button>
  
  <!-- Desktop header (visible only on desktop) -->
  <h2 class="hidden md:block text-xl font-semibold mb-4">Preferencias</h2>
  
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
  </div>
</div> 