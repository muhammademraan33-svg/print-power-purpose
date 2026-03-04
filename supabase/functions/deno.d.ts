/// <reference types="https://deno.land/x/types/index.d.ts" />

declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined
  }
}
