# Code Review Prompt Template

This prompt template guides a code review focusing on structural design, SOLID principles, technical debt, and refactoring strategy.

---

## Instructions

Analyze the provided codebase to identify architectural flaws, technical debt, and violations of clean coding practices, then design a structured, low-risk refactoring strategy. Prioritize enterprise software engineering principles over quick fixes. Focus on transforming rigid, tightly coupled, and bloated implementations into highly modular, testable, and scalable systems using standard design patterns and clean code metrics.

---

## Core Evaluation Pillars

### 1. SOLID Principles
*   **Single Responsibility Principle (SRP):** Identify classes, modules, or functions handling multiple concerns (e.g., mixing business rules, data access, logging, or UI logic). Ensure each component has exactly one reason to change.
*   **Open/Closed Principle (OCP):** Detect rigid structures, such as extensive `if-else` or `switch` chains driven by type codes, that require modification whenever a new variant is introduced. Target these for replacement via polymorphism or behavioral design patterns.
*   **Liskov Substitution Principle (LSP):** Ensure derived classes or interface implementations honor the contract of their abstractions without throwing unexpected exceptions or altering expected behaviors.
*   **Interface Segregation Principle (ISP):** Spot bloated, multi-purpose interfaces that force client implementations to depend on methods they do not use. Advocate for lean, role-specific interfaces.
*   **Dependency Inversion Principle (DIP):** Trace dependency directions. Ensure high-level business policies depend on stable abstractions rather than concrete execution details or specific infrastructure components.

### 2. DRY (Don't Repeat Yourself) & Deduplication
*   Isolate copy-pasted blocks, structural redundancies, and mirrored logic across separate modules.
*   Design reusable abstractions, utility wrappers, or base classes to consolidate identical behaviors without introducing artificial or premature coupling.

### 3. Structural Complexity & Code Hygiene
*   **Bloated Modules / Large Files:** Target files exceeding acceptable line-count thresholds. Outline a physical file-splitting strategy to isolate independent domain sub-units.
*   **Deep Nested / Long Functions:** Diagnose methods with high cyclomatic complexity or excessive vertical length. Break them down into small, self-documenting, and single-purpose helper functions.

### 4. Design Patterns & Scalability
*   Introduce proven structural, creational, and behavioral design patterns (e.g., **Factory, Strategy, Observer, Facade, Dependency Injection**) to decouple subsystems and streamline execution paths.

---

## Output Framework

Produce a structured review response covering the following five sections:

### 1. Executive Summary & Code Health Audit
*   A concise, high-level diagnosis of the architectural landscape.
*   Identification of the primary bottlenecks, critical anti-patterns, and systemic risks found in the provided code.

### 2. Technical Debt & Violations Breakdown
For each distinct issue identified, provide a granular breakdown using this format:
*   **Location:** Specific file, class, method, or structural context.
*   **The Violation:** The exact engineering principle violated (e.g., SRP, DRY, Code Bloat).
*   **The Problem & Impact:** Technical explanation of how the current code degrades testability, increases maintenance overhead, or introduces regression risks.

### 3. Target Architecture & Pattern Mapping
*   A blueprint of the proposed state.
*   Explicit justification for each design pattern introduced, detailing exactly how it simplifies execution flow or isolates volatile logic.

### 4. Phased Refactoring Action Plan
A sequential, risk-mitigated execution strategy designed to prevent breaking changes:
*   **Phase 1: Deconstruction (Low Risk):** Splitting oversized files and decomposing long, nested functions into pure helper methods without altering core behavior.
*   **Phase 2: Architectural Realignment (Medium Risk):** Decoupling modules, applying SOLID boundaries, and introducing structural/behavioral design patterns.
*   **Phase 3: Consolidation & Polish (Low Risk):** Merging duplicated logic via DRY principles and running final verification sweeps.

### 5. Code Blueprints (Before vs. After)
*   Provide a side-by-side or sequential code transformation showing a high-impact section of the codebase.
*   The blueprint must clearly contrast the original anti-pattern with the clean, refactored, and highly optimized implementation.
