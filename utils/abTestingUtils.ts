import jstat from 'jstat';

export const useCases = [
  {
    name: "E-commerce Button Color",
    description: "Testing if changing the 'Add to Cart' button color from blue to green increases conversions",
    baselineRate: 0.05,
    mde: 0.2,
  },
  {
    name: "Landing Page Headline",
    description: "Comparing two different headlines on a landing page to see which one leads to more sign-ups",
    baselineRate: 0.1,
    mde: 0.15,
  },
  {
    name: "Email Subject Line",
    description: "Testing two different email subject lines to improve open rates",
    baselineRate: 0.22,
    mde: 0.1,
  },
];

export function validateInputs(baselineRate: number, mde: number, confidence: number, power: number): string | null {
  if (baselineRate <= 0 || baselineRate >= 1) return "Baseline rate must be between 0 and 1";
  if (mde <= 0 || mde >= 1) return "Minimum detectable effect must be between 0 and 1";
  if (confidence <= 0.8 || confidence >= 1) return "Confidence level must be between 0.8 and 1";
  if (power <= 0.8 || power >= 1) return "Statistical power must be between 0.8 and 1";
  return null;
}

export function calculateSampleSize(baselineRate: number, mde: number, confidence: number, power: number): number {
  const validationError = validateInputs(baselineRate, mde, confidence, power);
  if (validationError) throw new Error(validationError);

  const alpha = 1 - confidence;
  const zAlpha = jstat.normal.inv(1 - alpha/2, 0, 1);
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

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1/n1 + 1/n2));
  const zScore = (variantConv - controlConv) / se;

  const pValue = 2 * (1 - jstat.normal.cdf(Math.abs(zScore), 0, 1));

  const zAlpha = jstat.normal.inv(1 - (1 - confidence) / 2, 0, 1); // Z-score for the confidence level

// Calculate the confidence intervals manually
const ciControl = [
  controlConv - zAlpha * Math.sqrt(controlConv * (1 - controlConv) / n1),
  controlConv + zAlpha * Math.sqrt(controlConv * (1 - controlConv) / n1)
];

const ciVariant = [
  variantConv - zAlpha * Math.sqrt(variantConv * (1 - variantConv) / n2),
  variantConv + zAlpha * Math.sqrt(variantConv * (1 - variantConv) / n2)
];


  const significant = pValue < (1 - confidence);
  let conclusion = "The test results are inconclusive.";
  if (significant) {
    conclusion = variantConv > controlConv
      ? "The variant outperformed the control group significantly."
      : "The control group outperformed the variant significantly.";
  }

  return {
    controlRate: controlConv,
    variantRate: variantConv,
    relativeImprovement: (variantConv - controlConv) / controlConv,
    pValue,
    significant,
    confidenceIntervals: {
      control: ciControl,
      variant: ciVariant
    },
    conclusion
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

