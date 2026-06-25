/**
 * Path constants describing the canonical on-disk layout of a Provar project.
 *
 * These are the single source of truth for the project-local directory
 * structure. Apps and libs must import from here instead of hand-rolling
 * `.provar`-string concatenation — if `.provar` ever changes to
 * `.provar-project`, updating this file is enough.
 *
 * `PROVAR_DIR` is the marker directory the engine `loadProject` looks for
 * when crawling up from a project path. `TESTS_DIR` and `CONFIG_FILE` are
 * project-relative paths built from it and are the constants downstream
 * code should consume; `PROVAR_DIR` itself is rarely needed by app code.
 */

/**
 * PROVAR_DIR is the default directory name containing Provar configuration
 * and tests at the root of a project.
 */
export const PROVAR_DIR = ".provar";

/**
 * TESTS_DIR is the project-relative directory path where Provar test files
 * are located.
 */
export const TESTS_DIR = `${PROVAR_DIR}/tests`;

/**
 * CONFIG_FILE is the project-relative configuration file path for a Provar
 * project.
 */
export const CONFIG_FILE = `${PROVAR_DIR}/config.yml`;