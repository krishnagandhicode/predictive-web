/**
 * ZordObserver - The "Eyes" of ZORD
 * Tracks mouse movements and maintains a sliding window of the last 16 frames
 * 
 * @class ZordObserver
 */
class ZordObserver {
  constructor(config = {}) {
    // Configuration
    this.windowSize = config.windowSize || 16;
    this.samplingRate = config.samplingRate || 16; // milliseconds between samples
    
    // State
    this.isActive = false;
    this.isRecording = false;
    this.slidingWindow = [];
    this.sessionBuffer = [];
    this.subscribers = [];
    
    // Tracking variables
    this.lastPosition = { x: 0, y: 0 };
    this.lastTimestamp = 0;
    this.lastSampleTime = 0;
    
    // Viewport dimensions
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    
    // Bind event handlers
    this._handleMouseMove = this._handleMouseMove.bind(this);
    this._handleClick = this._handleClick.bind(this);
    this._handleResize = this._handleResize.bind(this);
  }
  
  /**
   * Start tracking mouse movements
   */
  start() {
    if (this.isActive) {
      console.warn('[ZordObserver] Already active');
      return;
    }
    
    this.isActive = true;
    
    // Attach event listeners
    document.addEventListener('mousemove', this._handleMouseMove, { passive: true });
    document.addEventListener('click', this._handleClick);
    window.addEventListener('resize', this._handleResize);
    
    // Initialize tracking
    this.lastTimestamp = Date.now();
    this.lastSampleTime = Date.now();
    
    console.log('[ZordObserver] Started');
  }
  
  /**
   * Stop tracking mouse movements
   */
  stop() {
    if (!this.isActive) {
      console.warn('[ZordObserver] Not active');
      return;
    }
    
    this.isActive = false;
    
    // Remove event listeners
    document.removeEventListener('mousemove', this._handleMouseMove);
    document.removeEventListener('click', this._handleClick);
    window.removeEventListener('resize', this._handleResize);
    
    console.log('[ZordObserver] Stopped');
  }
  
  /**
   * Subscribe to sliding window updates
   * @param {Function} callback - Called with window array when it reaches 16 frames
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }
  
  /**
   * Start recording frames to session buffer
   */
  startRecording() {
    this.isRecording = true;
    this.sessionBuffer = [];
    console.log('[ZordObserver] Recording started');
  }
  
  /**
   * Stop recording frames
   */
  stopRecording() {
    this.isRecording = false;
    console.log('[ZordObserver] Recording stopped');
  }
  
  /**
   * Export recorded session as JSON
   * @returns {string} JSON string containing session data and metadata
   */
  exportSession() {
    const sessionData = {
      frames: this.sessionBuffer,
      metadata: {
        totalFrames: this.sessionBuffer.length,
        viewportWidth: this.viewportWidth,
        viewportHeight: this.viewportHeight,
        windowSize: this.windowSize,
        samplingRate: this.samplingRate,
        timestamp: new Date().toISOString()
      }
    };
    
    return JSON.stringify(sessionData, null, 2);
  }
  
  /**
   * Get current sliding window
   * @returns {Array} Current window of frames
   */
  getWindow() {
    return [...this.slidingWindow];
  }
  
  /**
   * Clear all buffers
   */
  reset() {
    this.slidingWindow = [];
    this.sessionBuffer = [];
    this.lastPosition = { x: 0, y: 0 };
    this.lastTimestamp = 0;
    console.log('[ZordObserver] Reset');
  }
  
  /**
   * Handle mouse move events (internal)
   * @private
   */
  _handleMouseMove(event) {
    const now = Date.now();
    
    // Throttle sampling
    if (now - this.lastSampleTime < this.samplingRate) {
      return;
    }
    
    // Calculate time delta
    const dt = now - this.lastTimestamp;
    
    // Normalize coordinates (0.0 to 1.0)
    const x = event.clientX / this.viewportWidth;
    const y = event.clientY / this.viewportHeight;
    
    // Calculate velocity (normalized units per millisecond)
    const vx = dt > 0 ? (x - this.lastPosition.x) / dt : 0;
    const vy = dt > 0 ? (y - this.lastPosition.y) / dt : 0;
    
    // Create frame object
    const frame = { x, y, vx, vy, dt };
    
    // Add to sliding window
    this.slidingWindow.push(frame);
    
    // Maintain window size
    if (this.slidingWindow.length > this.windowSize) {
      this.slidingWindow.shift();
    }
    
    // If recording, add to session buffer
    if (this.isRecording) {
      this.sessionBuffer.push({
        ...frame,
        timestamp: now,
        rawX: event.clientX,
        rawY: event.clientY
      });
    }
    
    // Emit to subscribers when window is full
    if (this.slidingWindow.length === this.windowSize) {
      this._notifySubscribers([...this.slidingWindow]);
    }
    
    // Update tracking state
    this.lastPosition = { x, y };
    this.lastTimestamp = now;
    this.lastSampleTime = now;
  }
  
  /**
   * Handle click events (internal)
   * @private
   */
  _handleClick(event) {
    // If recording, mark click in session buffer
    if (this.isRecording) {
      this.sessionBuffer.push({
        type: 'click',
        x: event.clientX / this.viewportWidth,
        y: event.clientY / this.viewportHeight,
        rawX: event.clientX,
        rawY: event.clientY,
        timestamp: Date.now(),
        target: event.target.tagName,
        targetId: event.target.id || null
      });
    }
  }
  
  /**
   * Handle window resize (internal)
   * @private
   */
  _handleResize() {
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
  }
  
  /**
   * Notify all subscribers (internal)
   * @private
   */
  _notifySubscribers(window) {
    this.subscribers.forEach(callback => {
      try {
        callback(window);
      } catch (error) {
        console.error('[ZordObserver] Subscriber error:', error);
      }
    });
  }
}

export default ZordObserver;