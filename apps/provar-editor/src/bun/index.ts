import { BrowserWindow, BrowserView, Updater } from "electrobun/bun";
import { type ProvarRPCSchema } from "../shared/rpc";
import { getConfig } from "./commands/getConfig";
import { saveConfig } from "./commands/saveConfig";
import { listFiles } from "./commands/listFiles";
import { readFileCommand } from "./commands/readFile";
import { writeFileCommand } from "./commands/writeFile";
import { createFile } from "./commands/createFile";
import { createDirectory } from "./commands/createDirectory";
import { deletePath } from "./commands/deletePath";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

const provarRPC = BrowserView.defineRPC<ProvarRPCSchema>({
	handlers: {
		requests: {
			getConfig,
			saveConfig,
			listFiles,
			readFile: readFileCommand,
			writeFile: writeFileCommand,
			createFile,
			createDirectory,
			deletePath,
		},
	},
});

const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
	title: "Provar Editor",
	url,
	renderer: "cef",
	frame: {
		width: 1200,
		height: 800,
		x: 200,
		y: 200,
	},
	rpc: provarRPC,
	titleBarStyle: "hiddenInset"
});

console.log("Provar Editor started!");
