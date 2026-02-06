<script>
  import { classData as allClassesStore } from '../stores';
  import { formatScheduleOption } from '../scheduler';
  
  export let classData;
  export let selected = false;
  export let passed = false;
  export let onClick = () => {};
  export let showDetails = false;
  
  function formatSchedule(scheduleOption) {
    return formatScheduleOption(scheduleOption);
  }
  
  function getPrerequisiteNames(prerequisiteIds) {
    if (!prerequisiteIds || prerequisiteIds.length === 0) return 'Ninguno';
    
    let prereqNames = [];
    const allClasses = $allClassesStore;
    
    prerequisiteIds.forEach(id => {
      const found = allClasses.find(c => c.id === id);
      if (found) {
        prereqNames.push(found.name);
      } else {
        prereqNames.push(`ID: ${id}`);
      }
    });
    
    return prereqNames.join(', ');
  }
</script>

<div 
  class="card w-full bg-base-100 shadow-md hover:shadow-lg transition-shadow cursor-pointer border-2 {selected ? 'border-primary' : 'border-base-200'} {passed ? 'bg-base-200' : ''}"
  on:click={onClick}
>
  <div class="card-body p-4">
    <div class="flex justify-between items-start gap-2">
      <h2 class="card-title text-lg font-medium flex items-center gap-2 flex-wrap">
        {#if passed}
          <span class="badge badge-success">Regular</span>
        {/if}
        <span class={passed ? "line-through opacity-70" : ""}>
          {classData.name}
        </span>
      </h2>
      <div class="badge badge-neutral whitespace-nowrap flex-shrink-0">{classData.hours} hs</div>
    </div>
    
    {#if showDetails}
      <div class="mt-2">
        {#if classData.prerequisites.length > 0}
          <div class="text-sm mb-2">
            <strong>Prerequisitos:</strong> {getPrerequisiteNames(classData.prerequisites)}
          </div>
        {:else}
          <div class="text-sm mb-2">
            <strong>Sin prerequisitos</strong>
          </div>
        {/if}
        
        <div class="text-sm">
          <strong>Horarios:</strong>
          <ul class="list-disc list-inside mt-1">
            {#each classData.scheduleOptions as option}
              <li>{formatSchedule(option)}</li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
  </div>
</div> 