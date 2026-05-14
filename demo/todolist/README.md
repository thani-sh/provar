# Todo Lists Demo

A full-stack example application demonstrating user authentication and multi-list management. Note that this implementation uses in-memory storage; data will reset when the server restarts.

## Tech Stack

- **Bun:** High-performance, all-in-one JavaScript runtime used as the full-stack server.
- **Frontend:** Built using React and Bun's native bundling capabilities.
- **Backend:** Logic and API routes handled within the Bun environment.
- **Storage:** All data kept in memory.

## Features

- **User Authentication:** Secure registration and login flow.
- **Multi-List Support:** Create and manage separate todo lists under a single account.
- **Fast Development:** Leverages Bun’s integrated bundler and HTTP server for a seamless DX.

## Getting Started

Install dependencies:

```bash
bun install

```

Run the development server:

```bash
bun dev

```

Access the app: Open http://localhost:6001 in your browser.
