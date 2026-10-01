import {match} from './matching.js';

class Matcher {
  constructor(queryWidth, queryHeight, debugMode = false, scaleStep = 2) {
    this.queryWidth = queryWidth;
    this.queryHeight = queryHeight;
    this.debugMode = debugMode;
    this.scaleStep = Math.max(1, scaleStep | 0);
  }

  matchDetection(keyframes, featurePoints) {
    let debugExtra = {frames: []};

    let bestResult = null;
    // Dev-tuning via sstep: elke N-de schaal volstaat meestal (de schaalbanden
    // per keyframe zijn ruim) — minder schalen = snellere match.
    const scaleStep = this.scaleStep;
    for (let i = 0; i < keyframes.length; i += scaleStep) {
      const {H, matches, debugExtra: frameDebugExtra} = match({keyframe: keyframes[i], querypoints: featurePoints, querywidth: this.queryWidth, queryheight: this.queryHeight, debugMode: this.debugMode});
      debugExtra.frames.push(frameDebugExtra);

      if (H) {
	if (bestResult === null || bestResult.matches.length < matches.length) {
	  bestResult = {keyframeIndex: i, H, matches};
	}
      }
    }

    if (bestResult === null) {
      return {keyframeIndex: -1, debugExtra};
    }

    const screenCoords = [];
    const worldCoords = [];
    const keyframe = keyframes[bestResult.keyframeIndex];
    for (let i = 0; i < bestResult.matches.length; i++) {
      const querypoint = bestResult.matches[i].querypoint;
      const keypoint = bestResult.matches[i].keypoint;
      screenCoords.push({
        x: querypoint.x,
        y: querypoint.y,
      })
      worldCoords.push({
        x: (keypoint.x + 0.5) / keyframe.scale,
        y: (keypoint.y + 0.5) / keyframe.scale,
        z: 0,
      })
    }
    return {screenCoords, worldCoords, keyframeIndex: bestResult.keyframeIndex, debugExtra};
  }
}

export {
  Matcher
}
