<script>
  import { userPreferences } from '../stores';
  
  const allDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const timePreferences = [
    { value: null, label: 'Sin preferencia' },
    { value: 'morning', label: 'Mañana (antes de 12:00)' },
    { value: 'afternoon', label: 'Tarde (12:00 - 18:00)' },
    { value: 'evening', label: 'Noche (después de 18:00)' }
  ];
  
  // Timeout options in milliseconds
  const minTimeout = 30000; // 30 seconds
  const maxTimeout = 600000; // 10 minutes
  const step = 30000; // 30 seconds
  
  // Convert milliseconds to seconds for display
  $: timeoutInSeconds = $userPreferences.timeout / 1000;
  
  function toggleDay(day) {
    $userPreferences.noDays = $userPreferences.noDays.includes(day)
      ? $userPreferences.noDays.filter(d => d !== day)
      : [...$userPreferences.noDays, day];
  }
  
  function setTimePreference(value) {
    $userPreferences.timePreference = value === 'null' ? null : value;
  }
  
  function updateTimeout(event) {
    const value = parseInt(event.target.value);
    $userPreferences.timeout = value;
  }
</script>

<div class="bg-base-100 p-4 rounded-lg shadow">
  <h2 class="text-xl font-semibold mb-4">Preferencias</h2>
  
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
    <h3 class="font-medium mb-2">Tiempo máximo de cálculo</h3>
    <div class="flex flex-col gap-2">
      <input 
        type="range" 
        min={minTimeout} 
        max={maxTimeout} 
        step={step} 
        class="range range-primary" 
        value={$userPreferences.timeout}
        on:input={updateTimeout}
      />
      <div class="flex justify-between text-xs">
        <span>30s</span>
        <span>{timeoutInSeconds} segundos</span>
        <span>10m</span>
      </div>
      <div class="text-sm text-base-content/70 mt-1">
        Un tiempo mayor puede producir mejores horarios pero tomará más tiempo en calcular.
      </div>
    </div>
  </div>
</div> 