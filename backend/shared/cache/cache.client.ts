export interface SetOptions {
  expiration?: {
    type: "EX";
    value: number;
  };
}

export abstract class CacheClient implements AsyncDisposable {
  abstract readonly isOpen: boolean;
  abstract get(key: string): Promise<string | null>;
  abstract set(
    key: string,
    value: string,
    options?: SetOptions,
  ): Promise<unknown>;
  abstract setEx(key: string, ttl: number, value: string): Promise<unknown>;
  abstract close(): Promise<void>;
  [Symbol.asyncDispose](): PromiseLike<void> {
    return this.close();
  }
}
