<script lang="ts">
  import { ChevronDown, File, Folder, Search } from 'lucide-svelte';
  import { projectStore } from '../stores/project-store.svelte';
  import { editorStore } from '../stores/editor-store.svelte';
  import { uiStore } from '../stores/ui-store.svelte';
  import { File as FileApi } from '../api';
  import type { TestFile } from '../types';

  type TreeNode = {
    type: 'folder' | 'file';
    name: string;
    path: string;
    children?: TreeNode[];
  };

  let query = $state('');
  let closedFolders = $state<Set<string>>(new Set());

  let tree = $derived.by(() => {
    const filtered = query
      ? projectStore.tests.filter((p) =>
          p.toLowerCase().includes(query.toLowerCase()),
        )
      : projectStore.tests;
    const root: TreeNode[] = [];
    for (const file of filtered) {
      const parts = file.split('/');
      let level = root;
      let currentPath = '';
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFile = i === parts.length - 1;
        let node = level.find((n) => n.name === part);
        if (!node) {
          node = {
            type: isFile ? 'file' : 'folder',
            name: part,
            path: currentPath,
            ...(isFile ? {} : { children: [] }),
          };
          level.push(node);
        }
        if (!isFile) level = node.children!;
      }
    }
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const n of nodes) if (n.children) sortNodes(n.children);
    };
    sortNodes(root);
    return root;
  });

  function toggleFolder(path: string) {
    const next = new Set(closedFolders);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    closedFolders = next;
  }

  async function selectFile(path: string) {
    if (!projectStore.path) return;
    try {
      const content = await FileApi.ReadTestFile(
        `${projectStore.path}/${path}`,
      );
      const parsed = JSON.parse(content) as TestFile;
      editorStore.loadFile(path, parsed);
    } catch (e) {
      console.error('TestExplorer: failed to load file', path, e);
    }
  }
</script>

{#snippet treeNode(node: TreeNode, depth: number)}
  {#if node.type === 'folder'}
    <button
      type="button"
      class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center rounded py-1 pr-2 text-left text-xs text-zinc-300 hover:bg-[#21262d]"
      style="padding-left: {depth * 14 + 8}px"
      onclick={() => toggleFolder(node.path)}
    >
      <ChevronDown
        class="mr-1 h-3.5 w-3.5 text-zinc-500 transition-transform {closedFolders.has(
          node.path,
        )
          ? '-rotate-90'
          : ''}"
      />
      <Folder class="mr-2 h-3.5 w-3.5 fill-zinc-400/20 text-zinc-400" />
      <span>{node.name}</span>
    </button>
    {#if !closedFolders.has(node.path)}
      {#each node.children! as child}
        {@render treeNode(child, depth + 1)}
      {/each}
    {/if}
  {:else}
    <button
      type="button"
      class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-2 rounded py-1 pr-2 text-left text-xs hover:text-zinc-200 {editorStore.selectedFilePath ===
      node.path
        ? 'bg-[#21262d] text-zinc-200'
        : 'text-zinc-400'}"
      style="padding-left: {depth * 14 + 26}px"
      onclick={() => selectFile(node.path)}
    >
      <File
        class="h-3.5 w-3.5 shrink-0 {editorStore.selectedFilePath === node.path
          ? 'text-blue-400'
          : 'text-zinc-500'}"
      />
      <span class="truncate">{node.name}</span>
    </button>
  {/if}
{/snippet}

{#if uiStore.isSidebarOpen}
  <aside
    class="absolute top-0 bottom-0 left-0 z-20 flex w-[260px] flex-col border-r border-zinc-800 bg-[#161b22]/50 pt-[64px] backdrop-blur-md"
  >
    <div class="px-3 pt-3 pb-2">
      <div class="relative">
        <Search class="absolute top-2 right-2.5 h-3.5 w-3.5 text-zinc-500" />
        <input
          type="text"
          placeholder="Search files"
          bind:value={query}
          class="w-full rounded-full border border-zinc-700/30 bg-[#21262d] py-1.5 pr-3 pl-3 text-xs text-zinc-300 placeholder-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 focus:outline-none"
        />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="mt-1 pb-4">
        {#if tree.length === 0}
          <p class="px-4 pt-4 text-xs text-zinc-500">
            {projectStore.tests.length === 0
              ? 'No test files in this project yet.'
              : 'No files match the search.'}
          </p>
        {:else}
          {#each tree as node}
            {@render treeNode(node, 0)}
          {/each}
        {/if}
      </div>
    </div>
  </aside>
{/if}