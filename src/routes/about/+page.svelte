<script>
  // About page component
</script>

<div class="prose max-w-none">
  <h1>Acerca del Planificador de Horarios</h1>
  
  <p>
    El Planificador de Horarios es una aplicación diseñada para ayudar a los estudiantes a optimizar su plan de estudios,
    minimizando el número de semestres necesarios para completar su carrera.
  </p>
  
  <h2>Características principales</h2>
  
  <ul>
    <li>
      <strong>Optimización matemática:</strong> Utiliza Programación Lineal Entera (ILP) a través de GLPK.js para
      encontrar la solución óptima que minimice el número de períodos académicos.
    </li>
    <li>
      <strong>Respeto de prerrequisitos:</strong> Garantiza que todas las restricciones de prerrequisitos
      entre asignaturas se cumplan.
    </li>
    <li>
      <strong>Evita conflictos de horario:</strong> Asegura que no haya superposiciones de horarios
      entre las asignaturas programadas en el mismo período.
    </li>
    <li>
      <strong>Personalización:</strong> Permite establecer preferencias como días a evitar
      o franjas horarias preferidas.
    </li>
  </ul>
  
  <h2>Cómo funciona</h2>
  
  <p>
    La aplicación modela el problema de programación de horarios como un problema de optimización matemática,
    donde se busca minimizar el número total de períodos necesarios mientras se respetan todas las restricciones:
  </p>
  
  <ol>
    <li>Cada asignatura debe ser programada exactamente una vez.</li>
    <li>Una asignatura solo puede ser programada después de que todos sus prerrequisitos hayan sido completados.</li>
    <li>No puede haber conflictos de horario entre asignaturas programadas en el mismo período.</li>
    <li>Se respetan las preferencias del usuario en la medida de lo posible.</li>
  </ol>
  
  <h2>Tecnologías utilizadas</h2>
  
  <ul>
    <li><strong>Frontend:</strong> SvelteKit, Tailwind CSS, DaisyUI</li>
    <li><strong>Optimización:</strong> GLPK.js (Solver de Programación Lineal)</li>
    <li><strong>Algoritmos:</strong> Programación Lineal Entera (ILP), Ordenamiento Topológico</li>
  </ul>
  
  <div class="alert alert-info mt-8">
    <div>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span>Esta aplicación es una herramienta de ayuda a la planificación. Siempre verifique los resultados con su plan de estudios oficial.</span>
    </div>
  </div>
</div> 