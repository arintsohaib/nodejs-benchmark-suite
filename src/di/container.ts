import { BenchError } from "../errors/bench-error.js";

/**
 * Minimal composition-root container for constructor injection.
 * Prefer explicit constructors in libraries; use the container at the CLI edge.
 */
export type Factory<T> = (container: Container) => T;

export class Container {
  private readonly factories = new Map<symbol, Factory<unknown>>();
  private readonly singletons = new Map<symbol, unknown>();

  register<T>(token: symbol, factory: Factory<T>): void {
    if (this.singletons.has(token)) {
      this.singletons.delete(token);
    }
    this.factories.set(token, factory as Factory<unknown>);
  }

  registerValue<T>(token: symbol, value: T): void {
    this.factories.delete(token);
    this.singletons.set(token, value);
  }

  resolve<T>(token: symbol): T {
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }
    const factory = this.factories.get(token);
    if (factory === undefined) {
      throw new BenchError(
        "INTERNAL",
        `DI token not registered: ${token.description ?? String(token)}`,
      );
    }
    const value = factory(this) as T;
    this.singletons.set(token, value);
    return value;
  }

  has(token: symbol): boolean {
    return this.singletons.has(token) || this.factories.has(token);
  }
}
