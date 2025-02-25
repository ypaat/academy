// Initialize Stockfish from local file
self.importScripts('/stockfish.js');

let stockfish;

self.onmessage = function(e) {
  if (!stockfish) {
    stockfish = STOCKFISH();
    stockfish.onmessage = function(msg) {
      self.postMessage(msg);
    };
  }
  stockfish.postMessage(e.data);
};