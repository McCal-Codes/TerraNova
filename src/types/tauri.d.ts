declare module "@tauri-apps/api";
declare module "@tauri-apps/plugin-dialog" {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export function ask(message: string, options?: Record<string, any>): Promise<boolean>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export function open(options?: Record<string, any>): Promise<string | string[] | null>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export function save(options?: Record<string, any>): Promise<string | null>;
}
