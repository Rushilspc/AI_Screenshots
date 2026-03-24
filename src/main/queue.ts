import { CaptureJob } from "./capture";

export type QueueHandler = (job: CaptureJob) => Promise<void>;

export class PriorityQueue {
  private readonly high: CaptureJob[] = [];
  private readonly normal: CaptureJob[] = [];
  private readonly low: CaptureJob[] = [];
  private running = false;

  constructor(private readonly handler: QueueHandler) {}

  enqueue(job: CaptureJob): void {
    if (job.priority === "high") this.high.push(job);
    else if (job.priority === "normal") this.normal.push(job);
    else this.low.push(job);
    void this.run();
  }

  size(): number {
    return this.high.length + this.normal.length + this.low.length + (this.running ? 1 : 0);
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.hasPending()) {
        const job = this.next();
        if (!job) continue;
        await this.handler(job);
      }
    } finally {
      this.running = false;
    }
  }

  private hasPending(): boolean {
    return this.high.length > 0 || this.normal.length > 0 || this.low.length > 0;
  }

  private next(): CaptureJob | undefined {
    return this.high.shift() ?? this.normal.shift() ?? this.low.shift();
  }
}
