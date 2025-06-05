<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { selectionComplete } from '$lib/stores';
	
	// Ya no cargamos los datos de clases aquí, esto se hace después de que el usuario seleccione facultad y carrera
</script>

<svelte:head>
	<title>Planificador de Horarios</title>
</svelte:head>

<div class="min-h-screen bg-base-100">
	<div class="navbar bg-primary text-primary-content">
		<div class="flex-1">
			<a href="/" class="btn btn-ghost normal-case text-xl">Planificador de Horarios</a>
		</div>
		<div class="flex-none">
			<!-- Enlaces ocultos temporalmente
			<ul class="menu menu-horizontal px-1">
				<li><a href="/">Inicio</a></li>
				<li><a href="/about">Acerca de</a></li>
			</ul>
			-->
		</div>
	</div>

	<div class="container mx-auto p-4">
		<slot></slot>
	</div>
	
	<footer class="footer footer-center p-4 bg-base-300 text-base-content">
		<div class="w-full">
			<p class="text-sm md:text-base text-center break-words">
				Hecho por 
				<a href="https://www.linkedin.com/in/lisandro-faure-845221216/" target="_blank" class="link link-hover">Lisandro Faure</a> 
				<span class="hidden sm:inline">&</span><span class="sm:hidden"><br /></span>
				<a href="https://www.linkedin.com/in/santiago-amaya-37b0411a7/" target="_blank" class="link link-hover">Santiago Amaya</a>
			</p>
		</div>
	</footer>
</div>
