<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { selectionComplete } from '$lib/stores';
	
	// Ya no cargamos los datos de clases aquí, esto se hace después de que el usuario seleccione facultad y carrera
</script>

<div class="min-h-screen bg-base-100">
	<div class="navbar bg-primary text-primary-content">
		<div class="flex-1">
			<a href="/" class="btn btn-ghost normal-case text-xl">Planificador de Horarios</a>
		</div>
		<div class="flex-none">
			<ul class="menu menu-horizontal px-1">
				<li><a href="/">Inicio</a></li>
				<li><a href="/about">Acerca de</a></li>
			</ul>
		</div>
	</div>

	<div class="container mx-auto p-4">
		<slot></slot>
	</div>
	
	<footer class="footer footer-center p-4 bg-base-300 text-base-content">
		<div>
			<p>Hecho por <a href="https://www.linkedin.com/in/lisandro-faure-845221216/" target="_blank">Lisandro Faure</a> & <a href="https://www.linkedin.com/in/santiago-amaya-37b0411a7/" target="_blank">Santiago Amaya</a></p>
		</div>
	</footer>
</div>
