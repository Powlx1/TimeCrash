declare module "*.mjs";
declare module "tracker.ts";
declare module 'ps-node' {
    interface Process {
        pid: number;
        command: string;
        arguments: string[];
    }
    export function lookup(query: { pid?: number }, callback: (err: Error | null, result: Process[]) => void): void;
}

declare module '@nut-tree-fork/nut-js' {
    export const mouse: {
        getPosition(): Promise<{ x: number; y: number }>;
    };
    export class Region {
        x: number;
        y: number;
        width: number;
        height: number;
    }
}

declare module 'get-windows' {
    export function activeWindow(): Promise<{
        owner: {
            processId: number;
            name: string;
            path: string;
        };
        bounds: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    }>;
}