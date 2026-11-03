export interface SecurityViolationLog {
  clientIp: string;
  endpoint: string;
  violationCount: number;
  quarantinedUntil: number;
}

export class RateLimitViolationLogger {
  private violations = new Map<string, SecurityViolationLog>();

  public logBreach(clientIp: string, endpoint: string, quarantineDurationSeconds = 300): SecurityViolationLog {
    const existing = this.violations.get(clientIp);
    const count = (existing?.violationCount || 0) + 1;
    const quarantinedUntil = Date.now() + quarantineDurationDuration(count, quarantineDurationSeconds) * 1000;

    const record: SecurityViolationLog = {
      clientIp,
      endpoint,
      violationCount: count,
      quarantinedUntil,
    };
    this.violations.set(clientIp, record);
    return record;
  }
}

function quarantineDurationDuration(count: number, baseSec: number): number {
  return baseSec * Math.min(count, 5);
}
