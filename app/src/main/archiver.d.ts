// archiver 8 ships no types; this is the small part of its API that Atrapo uses.
declare module "archiver" {
  import type { Transform } from "node:stream";
  export class ZipArchive extends Transform {
    constructor(options?: { store?: boolean; forceZip64?: boolean });
    file(path: string, data: { name: string }): this;
    append(source: string | Buffer, data: { name: string }): this;
    finalize(): Promise<void>;
    abort(): this;
  }
}
