/**
 * LogicBrain - Deterministic Prediction Engine
 * Uses heuristics (distance + trajectory) to predict click targets
 * No AI/ML dependencies - pure math-based fallback
 * 
 * @class LogicBrain
 */
class LogicBrain {
  constructor(config = {}) {
    // Weights for scoring algorithm
    this.distanceWeight = config.distanceWeight || 0.7;
    this.trajectoryWeight = config.trajectoryWeight || 0.3;
    
    // Viewport dimensions (updated dynamically)
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    
    // Update viewport on resize
    window.addEventListener('resize', () => {
      this.viewportWidth = window.innerWidth;
      this.viewportHeight = window.innerHeight;
    });
  }
  
  /**
   * Predict which target the user will click
   * @param {Array} sequence - Array of frames [{x, y, vx, vy, dt}, ...]
   * @param {Array} targets - Array of target elements [{id, rect}, ...]
   * @returns {Object} Prediction result {probabilities, predictedTargetId, confidence}
   */
  predict(sequence, targets) {
    // Validation
    if (!sequence || sequence.length === 0) {
      return this._createEmptyPrediction(targets);
    }
    
    if (!targets || targets.length === 0) {
      return this._createEmptyPrediction([]);
    }
    
    // Extract last frame (current position and velocity)
    const lastFrame = sequence[sequence.length - 1];
    
    // Convert normalized coordinates to pixels
    const cursorX = lastFrame.x * this.viewportWidth;
    const cursorY = lastFrame.y * this.viewportHeight;
    const velocityX = lastFrame.vx * this.viewportWidth; // normalized velocity to pixel velocity
    const velocityY = lastFrame.vy * this.viewportHeight;
    
    // Calculate score for each target
    const scores = targets.map(target => {
      const score = this._calculateTargetScore(
        cursorX, cursorY,
        velocityX, velocityY,
        target
      );
      
      return {
        id: target.id,
        rawScore: score
      };
    });
    
    // Convert raw scores to probabilities (normalize to sum = 1.0)
    const probabilities = this._normalizeProbabilities(scores);
    
    // Find highest probability target
    const best = probabilities.reduce((max, curr) => 
      curr.p > max.p ? curr : max
    );
    
    return {
      probabilities: probabilities,
      predictedTargetId: best.id,
      confidence: best.p
    };
  }
  
  /**
   * Calculate score for a single target
   * @private
   */
  _calculateTargetScore(cursorX, cursorY, velocityX, velocityY, target) {
    // Calculate target center
    const targetCenterX = target.rect.left + (target.rect.width / 2);
    const targetCenterY = target.rect.top + (target.rect.height / 2);
    
    // 1. Distance Score (70% weight)
    // Closer targets get higher scores
    const distance = Math.sqrt(
      Math.pow(targetCenterX - cursorX, 2) + 
      Math.pow(targetCenterY - cursorY, 2)
    );
    
    // 🔧 FIX 1: Dropped from 500 to 150. Distance score drops off much faster now!
    const distanceScale = 150;
    const distanceScore = Math.exp(-distance / distanceScale);
    
    // 2. Trajectory Score (30% weight)
    // If velocity points toward target, boost score
    const directionX = targetCenterX - cursorX;
    const directionY = targetCenterY - cursorY;
    
    // Normalize direction vector
    const directionMagnitude = Math.sqrt(directionX * directionX + directionY * directionY);
    const normalizedDirX = directionMagnitude > 0 ? directionX / directionMagnitude : 0;
    const normalizedDirY = directionMagnitude > 0 ? directionY / directionMagnitude : 0;
    
    // Normalize velocity vector
    const velocityMagnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    const normalizedVelX = velocityMagnitude > 0 ? velocityX / velocityMagnitude : 0;
    const normalizedVelY = velocityMagnitude > 0 ? velocityY / velocityMagnitude : 0;
    
    // Dot product: -1 (opposite) to 1 (same direction)
    const dotProduct = (normalizedVelX * normalizedDirX) + (normalizedVelY * normalizedDirY);
    
    // Convert dot product to 0-1 scale (0 = opposite, 1 = same direction)
    const trajectoryScore = (dotProduct + 1) / 2;
    
    // 🔧 FIX 2: Only apply trajectory math if the mouse is moving reasonably fast
    const isMoving = velocityMagnitude > 0.05;
    const trajectoryWeight = isMoving ? this.trajectoryWeight : 0;
    const distanceWeightAdjusted = isMoving ? this.distanceWeight : 1.0;
    
    // Combine scores with weights
    const finalScore = (distanceScore * distanceWeightAdjusted) + (trajectoryScore * trajectoryWeight);
    
    return finalScore;
  }
  
  /**
   * Normalize raw scores into probabilities (sum = 1.0)
   * @private
   */
  _normalizeProbabilities(scores) {
    // 🔧 FIX 3: Amplify the differences! (Pseudo-Softmax)
    // By taking the power of 4, the highest score completely dominates the percentage.
    const amplifiedScores = scores.map(item => ({
      id: item.id,
      rawScore: Math.pow(item.rawScore, 4)
    }));

    const totalScore = amplifiedScores.reduce((sum, item) => sum + item.rawScore, 0);
    
    // Handle edge case: all scores are 0
    if (totalScore === 0) {
      const uniformProb = 1.0 / scores.length;
      return scores.map(item => ({
        id: item.id,
        p: uniformProb
      }));
    }
    
    // Normalize to probabilities
    return amplifiedScores.map(item => ({
      id: item.id,
      p: item.rawScore / totalScore
    }));
  }
  
  /**
   * Create empty prediction when no valid input
   * @private
   */
  _createEmptyPrediction(targets) {
    if (targets.length === 0) {
      return {
        probabilities: [],
        predictedTargetId: null,
        confidence: 0
      };
    }
    
    // Return uniform probabilities
    const uniformProb = 1.0 / targets.length;
    const probabilities = targets.map(t => ({
      id: t.id,
      p: uniformProb
    }));
    
    return {
      probabilities: probabilities,
      predictedTargetId: targets[0].id,
      confidence: uniformProb
    };
  }
}

export default LogicBrain;