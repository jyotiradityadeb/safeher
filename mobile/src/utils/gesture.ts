export type GesturePoint = {
  x: number;
  y: number;
  t: number;
};

export type GestureFeatures = {
  coordinates: number[][];
  duration_ms: number;
  average_speed: number;
  max_speed: number;
  total_distance: number;
  direction_changes: number;
};

const distance = (a: GesturePoint, b: GesturePoint) => Math.hypot(b.x - a.x, b.y - a.y);

export function extractGestureFeatures(points: GesturePoint[]): GestureFeatures {
  if (points.length < 2) {
    return {
      coordinates: points.map((point) => [point.x, point.y]),
      duration_ms: 0,
      average_speed: 0,
      max_speed: 0,
      total_distance: 0,
      direction_changes: 0,
    };
  }

  let totalDistance = 0;
  let maxSpeed = 0;
  let directionChanges = 0;
  let previousAngle: number | null = null;

  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[index - 1];
    const segmentDistance = distance(previous, current);
    const deltaTime = Math.max(current.t - previous.t, 1);
    const speed = segmentDistance / deltaTime;
    totalDistance += segmentDistance;
    maxSpeed = Math.max(maxSpeed, speed);

    const angle = Math.atan2(current.y - previous.y, current.x - previous.x);
    if (previousAngle !== null && Math.abs(angle - previousAngle) > Math.PI / 4) {
      directionChanges += 1;
    }
    previousAngle = angle;
  }

  const duration = points[points.length - 1].t - points[0].t;
  return {
    coordinates: points.map((point) => [point.x, point.y]),
    duration_ms: duration,
    average_speed: duration > 0 ? totalDistance / duration : 0,
    max_speed: maxSpeed,
    total_distance: totalDistance,
    direction_changes: directionChanges,
  };
}
