/**
 * SupervisorAgent tracks Gemini API status and manages fallback to free-agent mode.
 */
export class SupervisorAgent {
  private isGeminiAvailable: boolean = true;
  private lastErrorTime: number = 0;
  private readonly ERROR_THRESHOLD = 3;
  private errorCount = 0;

  constructor() {}

  public async checkGeminiAvailability(): Promise<boolean> {
    // Basic check: if we have had too many errors recently, mark as unavailable
    if (this.errorCount >= this.ERROR_THRESHOLD) {
      this.isGeminiAvailable = false;
    }
    return this.isGeminiAvailable;
  }

  public reportError(error: any) {
    this.errorCount++;
    this.lastErrorTime = Date.now();
    console.error(`[SupervisorAgent] Reported error count: ${this.errorCount}`);
  }

  public resetErrors() {
    this.errorCount = 0;
    this.isGeminiAvailable = true;
  }
}

export const supervisor = new SupervisorAgent();
