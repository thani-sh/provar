<script lang="ts">
  import { Greet } from '../wailsjs/go/main/App.js'

  let name = $state('')
  let result = $state('Please enter your name below 👇')

  async function greet(): Promise<void> {
    result = await Greet(name)
  }
</script>

<main>
  <h1>provar</h1>
  <p>{result}</p>
  <div class="row">
    <input bind:value={name} placeholder="Name" type="text" />
    <button onclick={greet}>Greet</button>
  </div>
</main>

<style>
  main {
    max-width: 480px;
    margin: 4rem auto;
    padding: 0 1rem;
    font-family: system-ui, sans-serif;
  }

  h1 {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
  }

  p {
    margin: 0 0 1.5rem;
    color: #666;
  }

  .row {
    display: flex;
    gap: 0.5rem;
  }

  input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    font: inherit;
  }

  button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    background: #111;
    color: #fff;
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: #333;
  }
</style>