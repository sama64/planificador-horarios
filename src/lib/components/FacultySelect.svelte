<script>
  import { selectedFaculty, selectedCurriculum, selectionComplete, loadClassData } from '../stores';
  
  // Lista de facultades y sus carreras simplificada
  const faculties = [
    { 
      id: 'unlz',
      name: 'UNLZ - Facultad de Ingeniería',
      curriculums: [
        { id: 'mecatronica', name: 'Ingeniería en Mecatrónica' },
        { id: 'industrial', name: 'Ingeniería Industrial' },
        { id: 'mecanica', name: 'Ingeniería Mecánica' }
      ]
    }
  ];
  
  let faculty = 'unlz'; // Default seleccionado
  let curriculum = null;
  let availableCurriculums = faculties[0].curriculums; // Ya sabemos que solo hay una facultad
  let error = '';
  let isLoading = false;
  
  async function handleSubmit() {
    if (!faculty || !curriculum) {
      error = 'Por favor seleccione una carrera';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      // Actualizar los stores
      $selectedFaculty = faculty;
      $selectedCurriculum = curriculum;
      
      // Cargar los datos de clases
      await loadClassData();
      
      // Solo cuando la carga es exitosa, actualizar selectionComplete
      $selectionComplete = true;
    } catch (err) {
      console.error('Error loading data:', err);
      error = `Error al cargar los datos: ${err.message}`;
    } finally {
      isLoading = false;
    }
  }
</script>

<style>
  /* Estilos para el modal con paleta oscura */
  .modal-backdrop {
    background-color: rgba(0, 0, 0, 0.8);
  }
  
  .modal-container {
    background-color: #2a303c;
    color: #e5e7eb;
    box-shadow: 0 0 20px rgba(0, 0, 255, 0.2);
    border: 2px solid #3d4451;
  }
  
  .text-modal {
    color: #e5e7eb;
  }
  
  /* Fix para el select */
  :global(.select) {
    width: 100% !important;
    display: block !important;
  }
  
  /* Asegurar que las opciones se muestran correctamente */
  :global(select option) {
    background-color: #2a303c;
    color: #e5e7eb;
  }
</style>

<!-- Solo mostrar el modal si selectionComplete es false -->
{#if !$selectionComplete}
  <div class="fixed inset-0 modal-backdrop z-50 flex justify-center items-center p-4">
    <div class="modal-container rounded-lg p-6 max-w-md w-full">
      <h3 class="font-bold text-lg mb-2 text-modal">Bienvenido al Planificador de Horarios</h3>
      
      <!-- Aviso de desarrollo -->
      <div class="alert alert-warning mb-4 text-sm">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <div>
          <span class="font-semibold">Aviso:</span> El sistema se encuentra en fase de desarrollo y puede contener errores.
        </div>
      </div>
      
      <p class="mb-6 text-modal">Para comenzar, por favor seleccione su carrera:</p>
      
      {#if error}
        <div class="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
        </div>
      {/if}
      
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text text-modal">Facultad</span>
        </label>
        <div class="select-container w-full">
          <select class="select select-bordered w-full bg-base-300 text-base-content" disabled>
            <option>{faculties[0].name}</option>
          </select>
        </div>
      </div>
      
      <div class="form-control mb-6">
        <label class="label">
          <span class="label-text text-modal">Carrera</span>
        </label>
        <div class="select-container w-full">
          <select class="select select-bordered w-full bg-base-300 text-base-content" bind:value={curriculum}>
            <option value={null} disabled selected>Seleccione una carrera</option>
            {#each availableCurriculums as curr}
              <option value={curr.id}>{curr.name}</option>
            {/each}
          </select>
        </div>
      </div>
      
      <div class="modal-action">
        <button class="btn btn-primary w-full {isLoading ? 'loading' : ''}" on:click={handleSubmit} disabled={isLoading || !curriculum}>
          Comenzar
        </button>
      </div>
    </div>
  </div>
{/if} 