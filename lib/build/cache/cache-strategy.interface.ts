// Common interface for the Bonsai build cache strategies
// Unifies the use of the library and package caches

export interface ICacheStrategy<T = any> {
  /**
   * Checks whether the cache is valid for the given target (package or library)
   * @param target Package or library information
   * @returns true when the cache is valid, false otherwise
   */
  isValid(target: T): Promise<boolean>;

  /**
   * Restores the artifacts from the cache (when valid)
   * @param target Package or library information
   * @returns true when the restore succeeded, false otherwise
   */
  read(target: T): Promise<boolean>;

  /**
   * Writes the artifacts to the cache
   * @param target Package or library information
   * @returns true when the write succeeded, false otherwise
   */
  write(target: T): Promise<boolean>;

  /**
   * Clears the cache for the given target
   * @param target Package or library information
   */
  clear(target: T): Promise<void>;
}
