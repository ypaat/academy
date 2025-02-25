import { EventEmitter } from './event-emitter';

interface EngineMessage {
  positionEvaluation?: number;
  possibleMate?: string;
  pv?: string;
  depth?: number;
}

export class Engine extends EventEmitter {
  private worker: Worker | null = null;
  private isReady = false;

  constructor() {
    super();
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      this.worker = new Worker(new URL('./stockfish.worker.js', import.meta.url));

      this.worker.onmessage = (e) => {
        const line = e.data;

        if (line === 'uciok') {
          this.isReady = true;
          this.emit('ready');
          return;
        }

        // Parse evaluation info
        if (line.startsWith('info')) {
          const message: EngineMessage = {};

          // Extract depth
          const depthMatch = line.match(/depth (\d+)/);
          if (depthMatch) {
            message.depth = parseInt(depthMatch[1]);
          }

          // Extract score
          const scoreMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);

          if (scoreMatch) {
            message.positionEvaluation = parseInt(scoreMatch[1]);
          } else if (mateMatch) {
            message.possibleMate = mateMatch[1];
          }

          // Extract principal variation
          const pvMatch = line.match(/pv (.+)/);
          if (pvMatch) {
            message.pv = pvMatch[1];
          }

          this.emit('message', message);
        }
      };

      // Initialize UCI mode
      this.worker.postMessage('uci');
      this.worker.postMessage('setoption name Threads value 4');
      this.worker.postMessage('isready');
    } catch (error) {
      console.error('Failed to initialize Stockfish worker:', error);
    }
  }

  evaluatePosition(fen: string, depth: number = 20) {
    if (!this.worker || !this.isReady) {
      console.warn('Engine not ready or worker not initialized');
      return;
    }

    try {
      this.worker.postMessage('stop');
      this.worker.postMessage('position fen ' + fen);
      this.worker.postMessage('go depth ' + depth);
    } catch (error) {
      console.error('Error evaluating position:', error);
    }
  }

  onMessage(callback: (message: EngineMessage) => void) {
    return this.on('message', callback);
  }

  stop() {
    if (!this.worker) return;
    try {
      this.worker.postMessage('stop');
    } catch (error) {
      console.error('Error stopping engine:', error);
    }
  }

  terminate() {
    if (!this.worker) return;
    try {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    } catch (error) {
      console.error('Error terminating engine:', error);
    }
  }
}