/** Yield before heavy main-thread work (mesh build, large store updates). */
export function deferMainThreadWork(run: () => void): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      run();
      resolve();
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(finish, { timeout: 48 });
    } else {
      requestAnimationFrame(finish);
    }
  });
}
