// Ambient declarations for pi runtime packages.
// The actual types are provided by whichever host (pi or OMP) loads this extension.
// tsconfig paths handles resolution when one of the packages is installed;
// these declarations serve as fallback when neither is available (e.g. CI, dev without pi).
declare module "@mariozechner/pi-coding-agent" {
  export type ExtensionAPI = import("@oh-my-pi/pi-coding-agent").ExtensionAPI;
}
declare module "@oh-my-pi/pi-coding-agent" {
  export interface ExtensionAPI {
    on(event: string, handler: (...args: any[]) => any): void;
    getCommands(): any[];
    sendUserMessage(message: string | any[]): void;
  }
}
