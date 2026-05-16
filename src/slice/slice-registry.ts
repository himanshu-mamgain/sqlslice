import { Slice } from './slice';

export class SliceRegistry {
  private readonly slices = new Map<string, Slice<any, any>>();

  register(slice: Slice<any, any>): this {
    if (this.slices.has(slice.name)) {
      throw new Error(`Slice "${slice.name}" is already registered.`);
    }
    this.slices.set(slice.name, slice);
    return this;
  }

  get<
    TParams = Record<string, unknown>,
    TResult = Record<string, unknown>,
  >(name: string): Slice<TParams, TResult> {
    const slice = this.slices.get(name) as
      | Slice<TParams, TResult>
      | undefined;
    if (!slice) {
      throw new Error(`Slice "${name}" not found in registry.`);
    }
    return slice;
  }

  has(name: string): boolean {
    return this.slices.has(name);
  }

  list(): string[] {
    return Array.from(this.slices.keys());
  }

  get size(): number {
    return this.slices.size;
  }
}
