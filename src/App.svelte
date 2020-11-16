<script lang="ts">
	import RandExp from 'randexp';
	export let name: string;
	let regex: string = '(1[0-2]|0[1-9])(:[0-5][0-9]){2} (A|P)M';
	let data: string = '';
	let count: number = 10;
	let error: boolean = false;
	$: {
		try {
			const text = [];
			const randexp = new RandExp(regex);
			for (let i = 0; i < count; i++) {
				text.push(randexp.gen());
			}
			data = text.join('\n');
			error = false;
		} catch {
			error = true;
			data = 'Bad Regex :(';
		}
	}
</script>

<main>
	<h1>Hello {name}!</h1>
	<input bind:value={regex} placeholder="Enter Regex">
	{#if !error}
		<label>
			<input type=range bind:value={count} min=0 max=50>
			<br>
			{count} strings coming right up!
		</label>
	{/if}
	<pre>{data}</pre>
	
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		padding: 1em;
		max-width: 50vw;
		margin: 0 auto;
	}

	input {
		width: 100%;
	}
	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	@media (max-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>