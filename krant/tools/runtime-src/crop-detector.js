import * as tf from '@tensorflow/tfjs';
import {Detector} from './detector/detector.js';
import {buildModelViewProjectionTransform, computeScreenCoordiate} from './estimation/utils.js';

class CropDetector {
  constructor(width, height, debugMode=false, cropMult=1) {
    this.debugMode = debugMode;
    this.width = width;
    this.height = height;

    // Full-page AR: gebruik een zo groot mogelijk knipvenster (macht van 2,
    // begrensd door het frame) i.p.v. een 256px-postzegel. Bij een gevulde
    // paginaview ziet de matcher dan de lay-outstructuur (kop/kaders) i.p.v.
    // alleen losse glyphs — veel stabielere lock op tekstpagina's.
    let minDimension = Math.min(width, height);
    let cropSize = Math.pow( 2, Math.round( Math.log( minDimension ) / Math.log( 2 ) ) );
    cropSize = Math.floor(Math.min(cropSize * cropMult, width, height));
    this.cropSize = cropSize;

    this.detector = new Detector(cropSize, cropSize, debugMode);

    this.kernelCaches = {};
    this.lastRandomIndex = 4;
  }

  detect(inputImageT) { // crop center
    const startY = Math.floor(this.height / 2 - this.cropSize / 2);
    const startX = Math.floor(this.width / 2 - this.cropSize / 2);
    const result = this._detect(inputImageT, startX, startY);

    if (this.debugMode) {
      result.debugExtra.crop = {startX, startY, cropSize: this.cropSize}; 
    }
    return result;
  }

  detectMoving(inputImageT) { // loop a few locations around center
    const dx = this.lastRandomIndex % 3;
    const dy = Math.floor(this.lastRandomIndex / 3);

    let startY = Math.floor(this.height / 2 - this.cropSize + dy * this.cropSize / 2);
    let startX = Math.floor(this.width / 2 - this.cropSize + dx * this.cropSize / 2);

    // Klemmen binnen het frame. Let op: als cropSize == width/height is
    // maxX/maxY == 0 (nooit -1), anders geeft tf.slice() met een negatieve
    // start "slice() does not support negative begin indexing" en faalt
    // elke detectie (bv. bij 640x480 met crop 480).
    const maxX = Math.max(0, this.width - this.cropSize);
    const maxY = Math.max(0, this.height - this.cropSize);
    if (startX < 0) startX = 0;
    if (startY < 0) startY = 0;
    if (startX > maxX) startX = maxX;
    if (startY > maxY) startY = maxY;

    this.lastRandomIndex = (this.lastRandomIndex + 1) % 9;

    const result = this._detect(inputImageT, startX, startY);
    return result;
  }

  _detect(inputImageT, startX, startY) {
    startX = Math.max(0, Math.min(Math.floor(startX), Math.max(0, this.width - this.cropSize)));
    startY = Math.max(0, Math.min(Math.floor(startY), Math.max(0, this.height - this.cropSize)));
    const cropInputImageT = inputImageT.slice([startY, startX], [this.cropSize, this.cropSize]);
    const {featurePoints, debugExtra} = this.detector.detect(cropInputImageT);
    featurePoints.forEach((p) => {
      p.x += startX;
      p.y += startY;
    });
    if (this.debugMode) {
      debugExtra.projectedImage = cropInputImageT.arraySync();
    }
    cropInputImageT.dispose();
    return {featurePoints: featurePoints, debugExtra};
  }
}

export {
  CropDetector
};
