<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { loadClassData } from '$lib/stores';
	
	onMount(() => {
		// Load the class data on application startup
		loadClassData('/mecatronica-2025C1.json');
	});
</script>

<div class="min-h-screen bg-base-200">
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
			<p>Class Scheduler © 2023 - Powered by GLPK.js and SvelteKit</p>
		</div>
	</footer>
</div>
