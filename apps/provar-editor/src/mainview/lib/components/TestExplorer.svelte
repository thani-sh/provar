<script lang="ts">
	import { ChevronDown, File, Folder, Search } from 'lucide-svelte';

	let {
		files = [],
		selectedFile = null,
		onSelect = () => {},
    onCreateFile = () => {},
    onCreateFolder = () => {},
    onDelete = () => {}
	} = $props<{
		files?: string[];
		selectedFile?: string | null;
		onSelect?: (file: string) => void;
    onCreateFile?: (parentPath: string, type: 'suite' | 'node') => void;
    onCreateFolder?: (parentPath: string) => void;
    onDelete?: (path: string) => void;
	}>();

	type TreeNode = {
		type: 'folder' | 'file';
		name: string;
		path: string;
		children?: TreeNode[];
	};

	let tree = $derived.by(() => {
		const root: TreeNode[] = [];
		for (const file of files) {
			const parts = file.split('/');
			let currentLevel = root;
			let currentPath = '';

			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				currentPath = currentPath ? `${currentPath}/${part}` : part;
				const isFile = i === parts.length - 1;

				let existingNode = currentLevel.find((n) => n.name === part);
				if (!existingNode) {
					existingNode = {
						type: isFile ? 'file' : 'folder',
						name: part,
						path: currentPath,
						...(isFile ? {} : { children: [] })
					};
					currentLevel.push(existingNode);
				}

				if (!isFile) {
					currentLevel = existingNode.children!;
				}
			}
		}

		const sortTree = (nodes: TreeNode[]) => {
			nodes.sort((a, b) => {
				if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
			for (const node of nodes) {
				if (node.children) sortTree(node.children);
			}
		};
		sortTree(root);
		return root;
	});

	let closedFolders = $state<Set<string>>(new Set());
  let contextMenu = $state<{ x: number, y: number, path: string, type: 'file' | 'folder' } | null>(null);

	function toggleFolder(e: Event, path: string) {
		e.stopPropagation();
		const newSet = new Set(closedFolders);
		if (newSet.has(path)) {
			newSet.delete(path);
		} else {
			newSet.add(path);
		}
		closedFolders = newSet;
	}

  function handleContextMenu(e: MouseEvent, path: string, type: 'file' | 'folder') {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { x: e.clientX, y: e.clientY, path, type };
  }

  function closeContextMenu() {
    contextMenu = null;
  }
</script>

<svelte:window onclick={closeContextMenu} />

{#snippet treeNode(node: TreeNode, depth: number)}
	{#if node.type === 'folder'}
		<div
			role="button"
			tabindex="0"
			class="mx-2 flex cursor-pointer items-center rounded py-1 pr-2 text-xs text-zinc-300 select-none hover:bg-[#21262d]"
			style="padding-left: {depth * 14 + 8}px"
			onclick={(e) => toggleFolder(e, node.path)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggleFolder(e, node.path);
				}
			}}
			oncontextmenu={(e) => handleContextMenu(e, node.path, 'folder')}
		>
			<ChevronDown
				class="mr-1 h-3.5 w-3.5 text-zinc-500 transition-transform {closedFolders.has(node.path)
					? '-rotate-90'
					: ''}"
			/>
			<Folder class="mr-2 h-3.5 w-3.5 fill-zinc-400/20 text-zinc-400" />
			<span>{node.name}</span>
		</div>
		{#if !closedFolders.has(node.path)}
			<div>
				{#each node.children! as child}
					{@render treeNode(child, depth + 1)}
				{/each}
			</div>
		{/if}
	{:else}
		<div
			role="button"
			tabindex="0"
			class="mx-2 flex cursor-pointer items-center rounded py-1 pr-2 text-xs select-none hover:bg-[#21262d] {selectedFile ===
			node.path
				? 'bg-[#21262d] text-zinc-200'
				: 'text-zinc-400'}"
			style="padding-left: {depth * 14 + 26}px"
			onclick={() => onSelect(node.path)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onSelect(node.path);
				}
			}}
			oncontextmenu={(e) => handleContextMenu(e, node.path, 'file')}
		>
			<File
				class="mr-2 h-3.5 w-3.5 {selectedFile === node.path ? 'text-blue-400' : 'text-zinc-500'}"
			/>
			<span class="truncate">{node.name}</span>
		</div>
	{/if}
{/snippet}

<aside
	class="absolute top-8 bottom-2 left-2 z-20 flex w-[260px] flex-col rounded-xl border border-zinc-800/80 bg-[#161b22]/50 shadow-2xl backdrop-blur-md"
  oncontextmenu={(e) => handleContextMenu(e, '.provar', 'folder')}
>
	<div class="px-3 pt-4 pb-2">
		<div class="relative">
			<Search class="absolute top-2 right-2.5 h-3.5 w-3.5 text-zinc-500" />
			<input
				type="text"
				placeholder="Search files"
				class="w-full rounded-full border border-zinc-700/30 bg-[#21262d] py-1.5 pr-3 pl-3 text-xs text-zinc-300 placeholder-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 focus:outline-none"
			/>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto">
		<div class="mt-1 pb-4">
			<div>
				{#each tree as node}
					{@render treeNode(node, 0)}
				{/each}
			</div>
		</div>
	</div>
</aside>

{#if contextMenu}
  <div
    class="fixed z-[100] min-w-[140px] rounded-lg border border-zinc-800 bg-[#161b22] p-1 shadow-xl"
    style="top: {contextMenu.y}px; left: {contextMenu.x}px"
  >
    {#if contextMenu.type === 'folder'}
      {#if contextMenu.path === '.provar'}
        <button
          class="w-full rounded px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-[#21262d]"
          onclick={() => { onCreateFile('.provar/suites', 'suite'); closeContextMenu(); }}
        >
          New test suite
        </button>
        <button
          class="w-full rounded px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-[#21262d]"
          onclick={() => { onCreateFile('.provar/nodes', 'node'); closeContextMenu(); }}
        >
          New shared node
        </button>
      {:else}
        {#if contextMenu.path.startsWith('.provar/suites')}
          <button
            class="w-full rounded px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-[#21262d]"
            onclick={() => { onCreateFolder(contextMenu!.path); closeContextMenu(); }}
          >
            New Folder
          </button>
          <button
            class="w-full rounded px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-[#21262d]"
            onclick={() => { onCreateFile(contextMenu!.path, 'suite'); closeContextMenu(); }}
          >
            New test suite
          </button>
        {/if}

        {#if contextMenu.path === '.provar/nodes'}
          <button
            class="w-full rounded px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-[#21262d]"
            onclick={() => { onCreateFile(contextMenu!.path, 'node'); closeContextMenu(); }}
          >
            New shared node
          </button>
        {/if}

        {#if contextMenu.path !== '.provar/suites' && contextMenu.path !== '.provar/nodes'}
          <div class="my-1 border-t border-zinc-800"></div>
          <button
            class="w-full rounded px-3 py-1.5 text-left text-xs text-red-400 hover:bg-[#21262d]"
            onclick={() => { onDelete(contextMenu!.path); closeContextMenu(); }}
          >
            Delete folder
          </button>
        {/if}
      {/if}
    {:else}
      {#if contextMenu.path.endsWith('.spec.yml')}
        <button
          class="w-full rounded px-3 py-1.5 text-left text-xs text-red-400 hover:bg-[#21262d]"
          onclick={() => { onDelete(contextMenu!.path); closeContextMenu(); }}
        >
          Delete test suite
        </button>
      {:else if contextMenu.path.endsWith('.node.yml')}
        <button
          class="w-full rounded px-3 py-1.5 text-left text-xs text-red-400 hover:bg-[#21262d]"
          onclick={() => { onDelete(contextMenu!.path); closeContextMenu(); }}
        >
          Delete shared node
        </button>
      {/if}
    {/if}
  </div>
{/if}
