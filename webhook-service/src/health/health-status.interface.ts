export type DependencyStatus = 'up' | 'down';

export interface HealthStatus {
  status: 'ok' | 'error';
  app: 'up';
  dependencies: {
    postgresql: { status: DependencyStatus };
    redis: { status: DependencyStatus };
  };
}
