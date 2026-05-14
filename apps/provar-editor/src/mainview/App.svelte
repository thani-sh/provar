<script lang="ts">
  import { onMount } from 'svelte';
  import { Electroview } from "electrobun/view";
  import type { ProvarRPCSchema } from "../shared/rpc";
  import TestExplorer from './lib/components/TestExplorer.svelte';
  import Canvas from './lib/components/Canvas.svelte';
  import NodeSidePanel from './lib/components/NodeSidePanel.svelte';
  import StartSidePanel from './lib/components/StartSidePanel.svelte';
  import InputModal from './lib/components/InputModal.svelte';
  import ConfigModal from './lib/components/ConfigModal.svelte';
  import { GRAPH_START_ID } from './lib/canvas/constants';
  import type { TestNode, TestFile, ProvarConfig } from '../shared/domain';

  const rpcSchema = Electroview.defineRPC<ProvarRPCSchema>({
    handlers: {
      messages: {}
    }
  });

  const electroview = new Electroview({ rpc: rpcSchema });

  // Global State (Runes)
  let suites = $state<string[]>([]);
  let currentFileContent = $state<TestFile | null>(null);
  let selectedFile = $state<string | null>(null);
  let selectedNodeId = $state<string | null>(null);
  let config = $state<ProvarConfig | null>(null);

  // Modal State
  let modalShow = $state(false);
  let modalTitle = $state('');
  let modalPlaceholder = $state('');
  let modalParentPath = $state('');
  let modalType = $state<'file' | 'folder'>('file');
  let modalFileType = $state<'suite' | 'node'>('suite');
  let configModalShow = $state(false);

  let selectedNode = $derived.by(() => {
    if (!currentFileContent || !selectedNodeId) return null;
    return currentFileContent.graph.nodes[selectedNodeId] || null;
  });

  onMount(async () => {
    console.log('App: Mounted, checking config...');
    try {
      const configRes = await electroview.rpc.request.getConfig({});
      if (configRes.config) {
        config = configRes.config;
        await refreshFiles();
      } else {
        configModalShow = true;
      }
    } catch (e) {
      console.error('App: Initial check failed:', e);
      configModalShow = true;
    }
  });

  async function handleConfigConfirm(newConfig: ProvarConfig) {
    console.log('App: handleConfigConfirm called with:', newConfig);
    try {
      const res = await electroview.rpc.request.saveConfig({ config: newConfig });
      if (res.success) {
        config = newConfig;
        configModalShow = false;
        await refreshFiles();
      } else {
        alert('Failed to save configuration. Please check your workspace permissions.');
      }
    } catch (e) {
      console.error('App: Failed to save config:', e);
    }
  }

  async function loadFile(path: string) {
    selectedFile = path;
    console.log('App: Loading file:', path);
    const res = await electroview.rpc.request.readFile({ path });
    currentFileContent = res.content;
    selectedNodeId = null;
  }

  async function handleBack() {
    selectedFile = null;
    currentFileContent = null;
    selectedNodeId = null;
  }

  async function refreshFiles() {
    const res = await electroview.rpc.request.listFiles({});
    suites = [...res.suites, ...res.nodes];
  }

  function handleCreateFile(parentPath: string, type: 'suite' | 'node') {
    modalType = 'file';
    modalFileType = type;
    modalTitle = type === 'suite' ? 'New test suite' : 'New shared node';
    modalPlaceholder = type === 'suite' ? 'Enter suite name...' : 'Enter node name...';
    modalParentPath = parentPath;
    modalShow = true;
  }

  function handleCreateFolder(parentPath: string) {
    modalType = 'folder';
    modalTitle = 'New Folder';
    modalPlaceholder = 'Enter folder name...';
    modalParentPath = parentPath;
    modalShow = true;
  }

  async function handleDelete(path: string) {
    const isFolder = !path.endsWith('.yml');
    const typeLabel = path.endsWith('.spec.yml') ? 'test suite' : path.endsWith('.node.yml') ? 'shared node' : 'folder';
    
    if (confirm(`Are you sure you want to delete this ${typeLabel}?`)) {
      try {
        const res = await electroview.rpc.request.deletePath({ path });
        if (res.success) {
          if (selectedFile === path || (isFolder && selectedFile?.startsWith(path))) {
            handleBack();
          }
          await refreshFiles();
        }
      } catch (e) {
        console.error('App: Failed to delete:', e);
      }
    }
  }

  async function handleModalConfirm(name: string) {
    console.log('App: handleModalConfirm called with:', name);
    modalShow = false;
    if (!name) {
      console.log('App: No name provided, returning');
      return;
    }

    try {
      let dir = modalParentPath.endsWith('.yml') ? modalParentPath.split('/').slice(0, -1).join('/') : modalParentPath;
      
      // If we're creating a file, ensure it goes to the right base directory if we're at the root level context
      if (modalType === 'file') {
        if (modalFileType === 'suite' && !dir.startsWith('.provar/suites')) {
          dir = '.provar/suites';
        } else if (modalFileType === 'node' && !dir.startsWith('.provar/nodes')) {
          dir = '.provar/nodes';
        }
      }

      console.log('App: Resolved directory:', dir);

      if (modalType === 'file') {
        const extension = modalFileType === 'node' ? '.node.yml' : '.spec.yml';
        const path = `${dir}/${name}${extension}`;
        console.log(`App: Requesting file creation: ${path}`);
        const res = await electroview.rpc.request.createFile({ path, name });
        console.log('App: createFile response:', res);
        await refreshFiles();
        await loadFile(path);
      } else {
        const path = `${dir}/${name}`;
        console.log(`App: Requesting directory creation: ${path}`);
        const res = await electroview.rpc.request.createDirectory({ path });
        console.log('App: createDirectory response:', res);
        await refreshFiles();
      }
    } catch (e) {
      console.error('App: Failed to create item:', e);
    }
  }
</script>

<div class="relative h-screen w-full overflow-hidden overscroll-none bg-[#0e1116] font-sans text-zinc-300">
  <main class="absolute inset-0 touch-none overscroll-none">
    {#if currentFileContent}
      <Canvas
        testFile={currentFileContent}
        bind:selectedNodeId
      />
    {:else}
      <div class="flex items-center justify-center h-full text-zinc-500">
        <p>Select a test suite to begin</p>
      </div>
    {/if}
  </main>

  <TestExplorer
    files={suites}
    {selectedFile}
    onSelect={loadFile}
    onCreateFile={handleCreateFile}
    onCreateFolder={handleCreateFolder}
    onDelete={handleDelete}
  />

  {#if selectedNodeId === GRAPH_START_ID}
    <StartSidePanel
      title={currentFileContent?.name}
      info={currentFileContent?.graph.info}
      config={{
        startNode: currentFileContent?.graph.start,
        nodes: Object.keys(currentFileContent?.graph.nodes || {}).length,
      }}
    />
  {:else if selectedNode && selectedNodeId}
    <NodeSidePanel
      node={selectedNode}
      nodeId={selectedNodeId}
    />
  {/if}

  <InputModal
    show={modalShow}
    title={modalTitle}
    placeholder={modalPlaceholder}
    onConfirm={handleModalConfirm}
    onCancel={() => (modalShow = false)}
  />

  <ConfigModal
    show={configModalShow}
    onConfirm={handleConfigConfirm}
  />
</div>
