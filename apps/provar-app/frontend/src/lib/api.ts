// Re-exports of Wails-generated bindings with cleaner import paths.
// Import from "$lib/api" instead of reaching into wailsjs/ directly.

import * as File from '../../wailsjs/go/bindings/File';
import * as Dialog from '../../wailsjs/go/bindings/Dialog';
import * as Shell from '../../wailsjs/go/bindings/Shell';
import * as Project from '../../wailsjs/go/bindings/Project';
import * as Config from '../../wailsjs/go/bindings/Config';
import * as History from '../../wailsjs/go/bindings/History';

export { File, Dialog, Shell, Project, Config, History };