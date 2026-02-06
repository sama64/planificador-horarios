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
      <strong>Algoritmo ultra-rápido:</strong> Utiliza un algoritmo basado en grafos dirigidos acíclicos (DAG) 
      con backtracking y poda branch-and-bound para encontrar soluciones óptimas o casi-óptimas en segundos.
    </li>
    <li>
      <strong>Respeto de prerrequisitos:</strong> Garantiza que todas las restricciones de prerrequisitos
      entre asignaturas se cumplan mediante ordenamiento topológico.
    </li>
    <li>
      <strong>Evita conflictos de horario:</strong> Asegura que no haya superposiciones de horarios
      entre las asignaturas programadas en el mismo período.
    </li>
    <li>
      <strong>Personalización inteligente:</strong> Permite establecer preferencias como días a evitar,
      franjas horarias preferidas y número máximo de materias por período.
    </li>
    <li>
      <strong>Rendimiento excepcional:</strong> Calcula horarios complejos en segundos en lugar de minutos,
      proporcionando respuestas inmediatas al usuario.
    </li>
  </ul>
  
  <h2>Cómo funciona</h2>
  
  <p>
    La aplicación utiliza un algoritmo avanzado de optimización basado en teoría de grafos y técnicas de 
    búsqueda inteligente para resolver el problema de programación de horarios:
  </p>
  
  <ol>
    <li><strong>Construcción del grafo de dependencias:</strong> Crea un grafo dirigido acíclico (DAG) que representa las relaciones de prerrequisitos entre materias.</li>
    <li><strong>Cálculo de semestres mínimos:</strong> Determina el semestre más temprano posible para cada materia basado en sus prerrequisitos.</li>
    <li><strong>Ordenamiento inteligente:</strong> Prioriza las materias más restringidas primero para optimizar las decisiones de asignación.</li>
    <li><strong>Backtracking con poda:</strong> Usa técnicas de branch-and-bound para explorar eficientemente el espacio de soluciones y encontrar la óptima.</li>
    <li><strong>Verificación de restricciones:</strong> Asegura que no haya conflictos de horario y que se respeten todas las preferencias del usuario.</li>
  </ol>
  
  <h2>Sobre preferencias</h2>
  
  <p>
    Las preferencias del usuario (días a evitar, horarios preferidos, etc.) se aplican como filtros durante 
    la optimización. Si estas preferencias hacen imposible encontrar una solución válida, el algoritmo las 
    ignora automáticamente para garantizar que siempre se pueda generar un horario factible.
  </p>
  
  <h2>Tecnologías utilizadas</h2>
  
  <ul>
    <li><strong>Frontend:</strong> SvelteKit, Tailwind CSS, DaisyUI</li>
    <li><strong>Algoritmos:</strong> Grafos Dirigidos Acíclicos (DAG), Ordenamiento Topológico, Backtracking con Branch-and-Bound</li>
    <li><strong>Optimización:</strong> Algoritmo greedy inteligente con técnicas de poda para máximo rendimiento</li>
  </ul>
  
  <div class="alert alert-info mt-8">
    <div>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span>Esta aplicación es una herramienta de ayuda a la planificación. Siempre verifique los resultados con su plan de estudios oficial.</span>
    </div>
  </div>
</div> 