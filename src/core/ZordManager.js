/**
 * ZordManager - Central Controller
 * Connects the Observer (Eyes) and Brain (Predictor) together
 * Manages target registration and prediction pipeline
 * 
 * @class ZordManager
 */
class ZordManager {
  constructor(config = {}) {
    // Validate required dependencies
    if (!config.observer) {
      throw new Error('ZordManager requires an observer instance');
    }
    if (!config.brain) {
      throw new Error('ZordManager requires a brain instance');
    }
    
    // Store instances
    this.observer = config.observer;
    this.brain = config.brain;
    
    // State
    this.targets = [];
    this.isActive = false;
    this.predictionListeners = [];
    this.unsubscribeFromObserver = null;
    
    console.log('[ZordManager] Initialized');
  }
  
  /**
   * Register clickable targets for prediction
   * @param {string} selector - CSS selector for target elements
   * @returns {number} Number of targets registered
   */
  setTargets(selector) {
    // Query all matching elements
    const elements = document.querySelectorAll(selector);
    
    if (elements.length === 0) {
      console.warn(`[ZordManager] No elements found for selector: ${selector}`);
      this.targets = [];
      return 0;
    }
    
    // Build target data array
    this.targets = Array.from(elements).map((el, index) => {
      const rect = el.getBoundingClientRect();
      
      return {
        id: el.id || `target_${index}`,
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        },
        element: el
      };
    });
    
    console.log(`[ZordManager] Registered ${this.targets.length} targets`);
    return this.targets.length;
  }
  
  /**
   * Start the prediction pipeline
   * Subscribes to observer and begins making predictions
   */
  start() {
    if (this.isActive) {
      console.warn('[ZordManager] Already active');
      return;
    }
    
    if (this.targets.length === 0) {
      console.warn('[ZordManager] No targets registered. Call setTargets() first.');
      return;
    }
    
    this.isActive = true;
    
    // Subscribe to observer's sequence emissions
    this.unsubscribeFromObserver = this.observer.subscribe((sequence) => {
      this._handleSequence(sequence);
    });
    
    console.log('[ZordManager] Pipeline started');
  }
  
  /**
   * Stop the prediction pipeline
   */
  stop() {
    if (!this.isActive) {
      console.warn('[ZordManager] Not active');
      return;
    }
    
    this.isActive = false;
    
    // Unsubscribe from observer
    if (this.unsubscribeFromObserver) {
      this.unsubscribeFromObserver();
      this.unsubscribeFromObserver = null;
    }
    
    console.log('[ZordManager] Pipeline stopped');
  }
  
  /**
   * Register a callback for prediction events
   * @param {Function} callback - Called with prediction result
   * @returns {Function} Unsubscribe function
   */
  onPrediction(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    
    this.predictionListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.predictionListeners.indexOf(callback);
      if (index > -1) {
        this.predictionListeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Refresh target positions (call after DOM changes or scroll)
   * Useful when targets move due to animations, scroll, or layout changes
   */
  refreshTargets() {
    if (this.targets.length === 0) {
      console.warn('[ZordManager] No targets to refresh');
      return;
    }
    
    // Update bounding rects for all targets
    this.targets = this.targets.map(target => {
      const rect = target.element.getBoundingClientRect();
      
      return {
        ...target,
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        }
      };
    });
    
    console.log('[ZordManager] Target positions refreshed');
  }
  
  /**
   * Get current targets
   * @returns {Array} Current target array
   */
  getTargets() {
    return [...this.targets];
  }
  
  /**
   * Get current status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isActive: this.isActive,
      targetCount: this.targets.length,
      listenerCount: this.predictionListeners.length
    };
  }
  
  /**
   * Handle incoming sequence from observer (internal)
   * @private
   */
  _handleSequence(sequence) {
    if (!this.isActive) {
      return;
    }
    
    if (this.targets.length === 0) {
      return;
    }
    
    try {
      // Call brain's predict method
      const prediction = this.brain.predict(sequence, this.targets);
      
      // Emit prediction to all listeners
      this._emitPrediction(prediction);
      
    } catch (error) {
      console.error('[ZordManager] Prediction error:', error);
    }
  }
  
  /**
   * Emit prediction to all registered listeners (internal)
   * @private
   */
  _emitPrediction(prediction) {
    this.predictionListeners.forEach(callback => {
      try {
        callback(prediction);
      } catch (error) {
        console.error('[ZordManager] Listener error:', error);
      }
    });
  }
  
  /**
   * Cleanup and dispose
   */
  dispose() {
    this.stop();
    this.targets = [];
    this.predictionListeners = [];
    console.log('[ZordManager] Disposed');
  }
}

export default ZordManager;