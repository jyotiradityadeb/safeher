type ShakeCallback = () => void;

type ShakeOptions = {
  threshold?: number;
  minShakes?: number;
  windowMs?: number;
};

export async function startShakeSosMonitor(
  onShake: ShakeCallback,
  options: ShakeOptions = {}
): Promise<() => void> {
  try {
    const sensors = await import("expo-sensors");
    const threshold = options.threshold ?? 1.9;
    const minShakes = options.minShakes ?? 3;
    const windowMs = options.windowMs ?? 1400;
    let last = Date.now();
    let shakes = 0;

    sensors.Accelerometer.setUpdateInterval(250);
    const sub = sensors.Accelerometer.addListener((reading: { x: number; y: number; z: number }) => {
      const now = Date.now();
      const deltaSeconds = (now - last) / 1000;
      last = now;
      const magnitude = Math.sqrt(reading.x ** 2 + reading.y ** 2 + reading.z ** 2);
      const shakeForce = Math.abs(magnitude - 1) / Math.max(deltaSeconds, 0.001);

      if (shakeForce > threshold) {
        shakes += 1;
      }

      setTimeout(() => {
        shakes = Math.max(0, shakes - 1);
      }, windowMs);

      if (shakes >= minShakes) {
        shakes = 0;
        onShake();
      }
    });
    return () => sub.remove();
  } catch {
    return () => undefined;
  }
}
