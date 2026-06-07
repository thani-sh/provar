<script lang="ts">
  import { Sparkles, File, User, Bot } from "lucide-svelte";

  export type AssistantMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    status?: "pending" | "completed" | "error";
  };

  let {
    onSend,
    selectedFile = null,
    messages = [],
    isBusy = false,
  }: {
    onSend: (message: string) => void;
    selectedFile?: string | null;
    messages?: AssistantMessage[];
    isBusy?: boolean;
  } = $props();

  let message = $state("");
  let fileName = $derived(selectedFile?.split("/").pop());

  function handleSend() {
    if (!message.trim() || isBusy) return;
    onSend(message);
    message = "";
  }

  type InlineToken =
    | { type: "text"; text: string }
    | { type: "bold"; text: string }
    | { type: "italic"; text: string }
    | { type: "code"; text: string };

  type BlockToken =
    | { type: "heading"; level: number; text: string }
    | { type: "code-block"; language: string; code: string }
    | { type: "list"; ordered: boolean; items: string[] }
    | { type: "paragraph"; text: string };

  function parseInlineTokens(text: string): InlineToken[] {
    const tokens: InlineToken[] = [];
    let index = 0;

    while (index < text.length) {
      // 1. Inline code: `code`
      if (text.startsWith("`", index)) {
        const closingIndex = text.indexOf("`", index + 1);
        if (closingIndex !== -1) {
          tokens.push({
            type: "code",
            text: text.slice(index + 1, closingIndex),
          });
          index = closingIndex + 1;
          continue;
        }
      }

      // 2. Bold: **text** or __text__
      if (text.startsWith("**", index) || text.startsWith("__", index)) {
        const marker = text.slice(index, index + 2);
        const closingIndex = text.indexOf(marker, index + 2);
        if (closingIndex !== -1) {
          tokens.push({
            type: "bold",
            text: text.slice(index + 2, closingIndex),
          });
          index = closingIndex + 2;
          continue;
        }
      }

      // 3. Italic: *text* or _text_
      if (text.startsWith("*", index) || text.startsWith("_", index)) {
        const marker = text.charAt(index);
        const closingIndex = text.indexOf(marker, index + 1);
        if (closingIndex !== -1) {
          tokens.push({
            type: "italic",
            text: text.slice(index + 1, closingIndex),
          });
          index = closingIndex + 1;
          continue;
        }
      }

      // If we get here, either we are not at a special character, or we are at one but it has no closing match.
      // We should find the next special character starting from index + 1.
      let nextSpecial = -1;
      for (let i = index + 1; i < text.length; i++) {
        const char = text.charAt(i);
        if (char === "`" || char === "*" || char === "_") {
          nextSpecial = i;
          break;
        }
      }

      if (nextSpecial === -1) {
        // No more special characters, push everything else as text
        tokens.push({ type: "text", text: text.slice(index) });
        break;
      } else {
        // Push everything from index to nextSpecial as text
        tokens.push({ type: "text", text: text.slice(index, nextSpecial) });
        index = nextSpecial;
      }
    }

    // Combine consecutive text tokens for efficiency
    const mergedTokens: InlineToken[] = [];
    for (const t of tokens) {
      const lastToken = mergedTokens[mergedTokens.length - 1];
      if (t.type === "text" && lastToken && lastToken.type === "text") {
        lastToken.text += t.text;
      } else {
        mergedTokens.push(t);
      }
    }

    return mergedTokens;
  }

  function parseMarkdownToTokens(text: string): BlockToken[] {
    const lines = text.split(/\r?\n/);
    const tokens: BlockToken[] = [];
    let inCodeBlock = false;
    let codeLanguage = "";
    let codeLines: string[] = [];

    let inList = false;
    let listOrdered = false;
    let listItems: string[] = [];

    const commitList = () => {
      if (inList && listItems.length > 0) {
        tokens.push({ type: "list", ordered: listOrdered, items: listItems });
        listItems = [];
        inList = false;
      }
    };

    for (const line of lines) {
      // Handle code block
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          // End of code block
          tokens.push({
            type: "code-block",
            language: codeLanguage,
            code: codeLines.join("\n"),
          });
          codeLines = [];
          inCodeBlock = false;
        } else {
          // Start of code block
          commitList();
          inCodeBlock = true;
          codeLanguage = line.trim().slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Handle Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        commitList();
        const level = headingMatch[1]?.length ?? 1;
        const headingText = headingMatch[2]?.trim() ?? "";
        tokens.push({ type: "heading", level, text: headingText });
        continue;
      }

      // Handle Unordered Lists
      const ulMatch = line.match(/^(\*|-)\s+(.*)$/);
      if (ulMatch) {
        if (!inList || listOrdered) {
          commitList();
          inList = true;
          listOrdered = false;
        }
        listItems.push(ulMatch[2]?.trim() ?? "");
        continue;
      }

      // Handle Ordered Lists
      const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (olMatch) {
        if (!inList || !listOrdered) {
          commitList();
          inList = true;
          listOrdered = true;
        }
        listItems.push(olMatch[2]?.trim() ?? "");
        continue;
      }

      // Handle Blank Lines
      if (line.trim() === "") {
        commitList();
        continue;
      }

      // Standard Paragraph text
      commitList();
      tokens.push({ type: "paragraph", text: line.trim() });
    }

    commitList();

    if (inCodeBlock && codeLines.length > 0) {
      tokens.push({
        type: "code-block",
        language: codeLanguage,
        code: codeLines.join("\n"),
      });
    }

    return tokens;
  }
</script>

<div class="flex h-full w-full flex-col">
  <div
    class="flex items-center justify-between border-b border-zinc-800/50 px-6 pt-3 pb-4"
  >
    <h2 class="text-sm font-semibold text-zinc-200">AI Assistant</h2>
  </div>

  <div class="flex-1 space-y-6 overflow-y-auto p-6">
    {#if messages.length === 0}
      <div class="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4">
        <p class="text-sm leading-relaxed text-zinc-300">
          I'm here to help you build and refine your tests. You can ask me to:
        </p>
        <ul class="mt-3 list-inside list-disc space-y-2 text-xs text-zinc-400">
          <li>Generate new test steps based on a description</li>
          <li>Refactor existing test flows</li>
          <li>Add validation checks to your nodes</li>
          <li>Explain how a test works</li>
        </ul>
        <p
          class="mt-4 border-t border-zinc-800/50 pt-3 text-[11px] text-zinc-500 italic"
        >
          Tip: You can use the assistant with or without a selected file. When a
          file is open, it will be used as context for your requests.
        </p>
      </div>
    {:else}
      {#each messages as msg}
        <div class="flex gap-3 {msg.role === 'user' ? 'flex-row-reverse' : ''}">
          <div
            class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-[#21262d]"
          >
            {#if msg.role === "user"}
              <User size={16} class="text-zinc-400" />
            {:else}
              <Bot size={16} class="text-indigo-400" />
            {/if}
          </div>
          <div
            class="flex flex-col gap-1 {msg.role === 'user' ? 'items-end' : ''}"
          >
            <div
              class="rounded-2xl px-4 py-2 text-sm leading-relaxed {msg.role ===
              'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800/50 text-zinc-200'}"
            >
              {#if msg.role === "assistant" && msg.status === "pending"}
                <span class="text-zinc-400 italic">Thinking...</span>
              {:else}
                <div class="flex flex-col gap-1">
                  {#each parseMarkdownToTokens(msg.content) as token}
                    {#if token.type === "heading"}
                      {#if token.level === 1}
                        <h1 class="mt-2 mb-1 text-base font-bold text-zinc-100">
                          {token.text}
                        </h1>
                      {:else if token.level === 2}
                        <h2 class="mt-2 mb-1 text-sm font-bold text-zinc-100">
                          {token.text}
                        </h2>
                      {:else}
                        <h3 class="mt-2 mb-0.5 text-xs font-bold text-zinc-200">
                          {token.text}
                        </h3>
                      {/if}
                    {:else if token.type === "code-block"}
                      <pre
                        class="my-1.5 overflow-x-auto rounded-lg border border-zinc-800/80 bg-zinc-950 p-3 font-mono text-[11px] whitespace-pre text-zinc-300"><code
                          >{token.code}</code
                        ></pre>
                    {:else if token.type === "list"}
                      {#if token.ordered}
                        <ol
                          class="my-1 list-decimal space-y-0.5 pl-5 text-zinc-300"
                        >
                          {#each token.items as item}
                            <li>
                              {#each parseInlineTokens(item) as inline}
                                {#if inline.type === "text"}
                                  {inline.text}
                                {:else if inline.type === "bold"}
                                  <strong
                                    class="font-bold {msg.role === 'user'
                                      ? 'text-white'
                                      : 'text-zinc-100'}">{inline.text}</strong
                                  >
                                {:else if inline.type === "italic"}
                                  <em
                                    class="italic {msg.role === 'user'
                                      ? 'text-indigo-100'
                                      : 'text-zinc-300'}">{inline.text}</em
                                  >
                                {:else if inline.type === "code"}
                                  <code class="font-mono">{inline.text}</code>
                                {/if}
                              {/each}
                            </li>
                          {/each}
                        </ol>
                      {:else}
                        <ul
                          class="my-1 list-disc space-y-0.5 pl-5 text-zinc-300"
                        >
                          {#each token.items as item}
                            <li>
                              {#each parseInlineTokens(item) as inline}
                                {#if inline.type === "text"}
                                  {inline.text}
                                {:else if inline.type === "bold"}
                                  <strong
                                    class="font-bold {msg.role === 'user'
                                      ? 'text-white'
                                      : 'text-zinc-100'}">{inline.text}</strong
                                  >
                                {:else if inline.type === "italic"}
                                  <em
                                    class="italic {msg.role === 'user'
                                      ? 'text-indigo-100'
                                      : 'text-zinc-300'}">{inline.text}</em
                                  >
                                {:else if inline.type === "code"}
                                  <code class="font-mono">{inline.text}</code>
                                {/if}
                              {/each}
                            </li>
                          {/each}
                        </ul>
                      {/if}
                    {:else if token.type === "paragraph"}
                      <p
                        class="my-0.5 {msg.role === 'user'
                          ? 'text-white'
                          : 'text-zinc-200'}"
                      >
                        {#each parseInlineTokens(token.text) as inline}
                          {#if inline.type === "text"}
                            {inline.text}
                          {:else if inline.type === "bold"}
                            <strong
                              class="font-bold {msg.role === 'user'
                                ? 'text-white'
                                : 'text-zinc-100'}">{inline.text}</strong
                            >
                          {:else if inline.type === "italic"}
                            <em
                              class="italic {msg.role === 'user'
                                ? 'text-indigo-100'
                                : 'text-zinc-300'}">{inline.text}</em
                            >
                          {:else if inline.type === "code"}
                            <code class="font-mono">{inline.text}</code>
                          {/if}
                        {/each}
                      </p>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <div class="border-t border-zinc-800/50 p-4">
    {#if fileName}
      <div class="mb-2 flex items-center px-1">
        <div
          class="flex items-center gap-1 rounded-full border border-zinc-700/50 bg-[#21262d] py-0.5 pr-2 pl-1.5 text-[10px] text-zinc-400"
        >
          <File size={10} class="text-zinc-500" />
          <span class="max-w-[150px] truncate">{fileName}</span>
        </div>
      </div>
    {/if}
    <div class="relative">
      <textarea
        bind:value={message}
        placeholder="Type your request here..."
        class="min-h-[100px] w-full resize-none rounded-lg border border-zinc-700/50 bg-[#0d1117] p-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none {isBusy
          ? 'cursor-not-allowed opacity-50'
          : ''}"
        onkeydown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !isBusy) {
            e.preventDefault();
            handleSend();
          } else if (e.key === "Enter" && !e.shiftKey && isBusy) {
            e.preventDefault();
          }
        }}
      ></textarea>
    </div>
    <p class="mt-2 text-center text-[10px] text-zinc-500">
      AI can make mistakes. Check important info.
    </p>
  </div>
</div>
