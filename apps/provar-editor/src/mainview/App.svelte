<script lang="ts">
  import { onMount } from 'svelte';
  import { Electroview } from "electrobun/view";
  import type { ProvarRPCSchema } from "../shared/rpc";
  import TestExplorer from './lib/components/TestExplorer.svelte';
  import Canvas from './lib/components/Canvas.svelte';
  import NodeSidePanel from './lib/components/NodeSidePanel.svelte';
  import StartSidePanel from './lib/components/StartSidePanel.svelte';
  import AssistantPanel, { type AssistantMessage } from './lib/components/AssistantPanel.svelte';
  import ConfigPanel from './lib/components/ConfigPanel.svelte';
  import InputModal from './lib/components/InputModal.svelte';
  import ConfigModal from './lib/components/ConfigModal.svelte';
  import { GRAPH_START_ID } from './lib/canvas/constants';
  import type { TestNode, TestFile, ProvarConfig } from '../shared/domain';
  import { generateNodeId } from '../shared/utils';

  const rpcSchema = Electroview.defineRPC<ProvarRPCSchema>({
    maxRequestTime: 120000,
    handlers: {
      messages: {
        workspaceSelected: (params) => {
          console.log('App: Workspace selected via menu:', params.path);
          workspacePath = params.path;
          handleWorkspaceChange();
        },
        workspaceChanged: () => {
          console.log('App: Workspace changed on disk, refreshing files...');
          refreshFiles();
        }
      }
    }
  });

  const electroview = new Electroview({ rpc: rpcSchema });

  // Global State (Runes)
  let workspacePath = $state<string | null>(null);
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
  let assistantPanelShow = $state(false);
  let configPanelShow = $state(false);
  let assistantMessages = $state<AssistantMessage[]>([]);
  let assistantBusy = $state(false);

  let selectedNode = $derived.by(() => {
    if (!currentFileContent || !selectedNodeId) return null;
    return currentFileContent.graph.nodes[selectedNodeId] || null;
  });

  onMount(async () => {
    console.log('App: Mounted, checking config...');
    await handleWorkspaceChange();

    const refreshInterval = setInterval(() => {
      if (workspacePath) {
        refreshFiles();
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  });

  async function handleWorkspaceChange() {
    try {
      const workspaceRes = await electroview.rpc.request.getWorkspace({});
      const configRes = await electroview.rpc.request.getConfig({});

      workspacePath = workspaceRes.path || null;

      if (configRes.config) {
        config = configRes.config;
        await refreshFiles();
      } else {
        if (workspacePath) {
          configModalShow = true;
        }
      }
    } catch (e) {
      console.error('App: Workspace check failed:', e);
      if (workspacePath) {
        configModalShow = true;
      }
    }
  }

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
    assistantPanelShow = false;
    configPanelShow = false;
  }

  async function handleBack() {
    selectedFile = null;
    currentFileContent = null;
    selectedNodeId = null;
    assistantPanelShow = false;
    configPanelShow = false;
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

  async function handleAddNode(fromId: string | null, toId: string | null) {
    if (!currentFileContent || !selectedFile) return;

    console.log('App: Adding node between', fromId, 'and', toId);

    const newNodeId = generateNodeId();
    const newNode: TestNode = {
      title: 'New Action',
      info: 'Describe what this action does...',
      next: toId || undefined,
    };

    // Use a deep-ish clone to trigger Svelte's reactivity correctly
    const newContent = JSON.parse(JSON.stringify(currentFileContent)) as TestFile;
    newContent.graph.nodes[newNodeId] = newNode;

    if (fromId === null) {
      // It's from Start
      newContent.graph.start = newNodeId;
    } else {
      const parentNode = newContent.graph.nodes[fromId];
      if (parentNode) {
        if (!parentNode.next) {
          parentNode.next = newNodeId;
        } else if (Array.isArray(parentNode.next)) {
          if (toId) {
             parentNode.next = parentNode.next.map(id => id === toId ? newNodeId : id);
          } else {
             parentNode.next.push(newNodeId);
          }
        } else {
          // Single string next
          parentNode.next = newNodeId;
        }
      }
    }

    currentFileContent = newContent;
    await electroview.rpc.request.writeFile({ path: selectedFile, content: newContent });
    selectedNodeId = newNodeId;
  }

  async function handleUpdateNode(id: string, updates: Partial<TestNode>) {
    if (!currentFileContent || !selectedFile) return;

    const newContent = JSON.parse(JSON.stringify(currentFileContent)) as TestFile;
    if (newContent.graph.nodes[id]) {
      newContent.graph.nodes[id] = { ...newContent.graph.nodes[id], ...updates };
      currentFileContent = newContent;
      // Note: In a real app, we might want to debounce this.
      await electroview.rpc.request.writeFile({ path: selectedFile, content: newContent });
    }
  }

  async function handleDeleteNode(id: string) {
    if (!currentFileContent || !selectedFile) return;

    if (!confirm('Are you sure you want to delete this node and all its descendants?')) return;

    const newContent = JSON.parse(JSON.stringify(currentFileContent)) as TestFile;
    const idsToDelete = new Set<string>();

    function collectIds(nodeId: string) {
      if (idsToDelete.has(nodeId)) return;
      idsToDelete.add(nodeId);
      const node = newContent.graph.nodes[nodeId];
      if (node) {
        const nexts = Array.isArray(node.next) ? node.next : node.next ? [node.next] : [];
        nexts.forEach(collectIds);
      }
    }

    collectIds(id);

    // Remove from nodes
    idsToDelete.forEach(nodeId => {
      delete newContent.graph.nodes[nodeId];
    });

    // Update parents/start
    if (newContent.graph.start === id) {
      newContent.graph.start = '';
    }

    Object.values(newContent.graph.nodes).forEach(node => {
      if (Array.isArray(node.next)) {
        node.next = (node.next as string[]).filter(nextId => !idsToDelete.has(nextId));
        if ((node.next as string[]).length === 0) delete node.next;
      } else if (node.next && idsToDelete.has(node.next as string)) {
        delete node.next;
      }
    });

    currentFileContent = newContent;
    selectedNodeId = null;
    await electroview.rpc.request.writeFile({ path: selectedFile, content: newContent });
  }

  async function handleAssist(prompt: string) {
    if (assistantBusy) return;

    const userMsgId = Math.random().toString(36).substring(7);
    const assistantMsgId = Math.random().toString(36).substring(7);
    
    assistantMessages = [
      ...assistantMessages, 
      { id: userMsgId, role: 'user', content: prompt, status: 'completed' },
      { id: assistantMsgId, role: 'assistant', content: '', status: 'pending' }
    ];
    
    assistantBusy = true;

    // 1 minute timeout to re-enable input
    const timeoutId = setTimeout(() => {
      if (assistantBusy) {
        assistantBusy = false;
      }
    }, 60000);

    try {
      const res = await electroview.rpc.request.assistEditor({ 
        prompt, 
        path: selectedFile || undefined 
      });

      clearTimeout(timeoutId);
      
      assistantMessages = assistantMessages.map(msg => 
        msg.id === assistantMsgId 
          ? { ...msg, content: res.message, status: 'completed' } 
          : msg
      );

      if (res.action?.type === 'selectFile') {
        await loadFile(res.action.path);
      }
    } catch (e) {
      console.error('App: AI Assist failed:', e);
      clearTimeout(timeoutId);
      assistantMessages = assistantMessages.map(msg => 
        msg.id === assistantMsgId 
          ? { ...msg, content: 'Sorry, I encountered an error. Please try again.', status: 'error' } 
          : msg
      );
    } finally {
      assistantBusy = false;
    }
  }
</script>

<div class="relative h-screen w-full overflow-hidden overscroll-none bg-[#0e1116] font-sans text-zinc-300">
  <div 
    class="absolute inset-0 touch-none overscroll-none"
    onclick={() => {
      assistantPanelShow = false;
      configPanelShow = false;
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') {
        assistantPanelShow = false;
        configPanelShow = false;
      }
    }}
    role="button"
    tabindex="-1"
  >
    {#if !workspacePath}
      <div class="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4">
        <p class="text-xl">Open a workspace to get started</p>
        <div class="flex items-center space-x-2 text-sm text-zinc-600">
            <kbd class="px-2 py-1 bg-zinc-800 rounded border border-zinc-700 font-mono">Cmd/Ctrl + O</kbd>
            <span>to open a folder</span>
        </div>
      </div>
    {:else if currentFileContent}
      <Canvas
        testFile={currentFileContent}
        bind:selectedNodeId
        onAddNode={handleAddNode}
      />
    {:else}
      <div class="flex items-center justify-center h-full text-zinc-500">
        <p>Select a test suite to begin</p>
      </div>
    {/if}
  </div>

  {#if workspacePath}
    <TestExplorer
      files={suites}
      {selectedFile}
      onSelect={loadFile}
      onCreateFile={handleCreateFile}
      onCreateFolder={handleCreateFolder}
      onDelete={handleDelete}
      onShowConfig={() => {
        configPanelShow = !configPanelShow;
        assistantPanelShow = false;
      }}
      onShowAI={() => {
        assistantPanelShow = !assistantPanelShow;
        configPanelShow = false;
      }}
    />
  {/if}

  {#if assistantPanelShow}
    <AssistantPanel 
      onSend={handleAssist} 
      {selectedFile} 
      messages={assistantMessages} 
      isBusy={assistantBusy}
    />
  {:else if configPanelShow}
    <ConfigPanel 
      {config} 
      onSave={handleConfigConfirm} 
    />
  {:else if selectedNodeId === GRAPH_START_ID}
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
      onUpdate={handleUpdateNode}
      onDelete={handleDeleteNode}
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
