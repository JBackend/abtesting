import jstat from 'jstat';

export function calculateSampleSize(baselineRate: number, mde: number, confidence: number, power: number): number {
  const alpha = 1 - confidence;
  const zAlpha = jstat.normal.inv(1 - alpha / 2, 0, 1);
  const zBeta = jstat.normal.inv(power, 0, 1);

  const p1 = baselineRate;
  const p2 = p1 * (1 + mde);

  const pPooled = (p1 + p2) / 2;

  const sampleSize = (2 * pPooled * (1 - pPooled) * Math.pow(zAlpha + zBeta, 2)) / Math.pow(p2 - p1, 2);
  return Math.ceil(sampleSize);
}

export function analyzeResults(controlData: number[], variantData: number[], confidence: number) {
  const controlConv = controlData.reduce((sum, val) => sum + val, 0) / controlData.length;
  const variantConv = variantData.reduce((sum, val) => sum + val, 0) / variantData.length;

  const n1 = controlData.length;
  const n2 = variantData.length;

  const pPooled = (controlData.reduce((sum, val) => sum + val, 0) + variantData.reduce((sum, val) => sum + val, 0)) / (n1 + n2);

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));
  const zScore = (variantConv - controlConv) / se;

  const pValue = 2 * (1 - jstat.normal.cdf(Math.abs(zScore), 0, 1));

  const ciControl = jstat.normal.inv(confidence, controlConv, Math.sqrt(controlConv * (1 - controlConv) / n1));
  const ciVariant = jstat.normal.inv(confidence, variantConv, Math.sqrt(variantConv * (1 - variantConv) / n2));

  return {
    controlRate: controlConv,
    variantRate: variantConv,
    relativeImprovement: (variantConv - controlConv) / controlConv,
    pValue,
    significant: pValue < (1 - confidence),
    confidenceIntervals: {
      control: ciControl,
      variant: ciVariant
    }
  };
}

export function sequentialAnalysis(controlData: number[], variantData: number[], minSampleSize: number, confidence: number) {
  const results = [];
  const currentSize = Math.min(controlData.length, variantData.length);

  for (let size = minSampleSize; size <= currentSize; size += minSampleSize) {
    const controlSample = controlData.slice(0, size);
    const variantSample = variantData.slice(0, size);

    const result = analyzeResults(controlSample, variantSample, confidence);
    results.push({
      sampleSize: size,
      pValue: result.pValue,
      relativeImprovement: result.relativeImprovement
    });
  }

  return results;
}

export function validateInputs(
  value: number,
  mde: number,
  confidence: number,
  power: number
): string | null {
  if (value < 0 || value > 1) {
    return 'Value must be between 0 and 1'
  }
  if (mde < 0 || mde > 1) {
    return 'MDE must be between 0 and 1'
  }
  if (confidence < 0.8 || confidence > 1) {
    return 'Confidence must be between 0.8 and 1'
  }
  if (power < 0.8 || power > 1) {
    return 'Power must be between 0.8 and 1'
  }
  return null
}

