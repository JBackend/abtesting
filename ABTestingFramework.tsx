'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { calculateSampleSize, analyzeResults, sequentialAnalysis } from './utils/statistics'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function ABTestingFramework() {
  const [params, setParams] = useState({
    baselineRate: 0.1,
    mde: 0.05,
    confidence: 0.95,
    power: 0.8
  })
  const [sampleSize, setSampleSize] = useState(0)
  const [results, setResults] = useState(null)
  const [sequentialData, setSequentialData] = useState([])

  const handleInputChange = (e) => {
    setParams({ ...params, [e.target.name]: parseFloat(e.target.value) })
  }

  const calculateSize = () => {
    const size = calculateSampleSize(params.baselineRate, params.mde, params.confidence, params.power)
    setSampleSize(size)
  }

  const runTest = () => {
    // Simulate test data
    const controlData = Array(sampleSize).fill(0).map(() => Math.random() < params.baselineRate ? 1 : 0)
    const variantData = Array(sampleSize).fill(0).map(() => Math.random() < (params.baselineRate * (1 + params.mde)) ? 1 : 0)

    const testResults = analyzeResults(controlData, variantData, params.confidence)
    setResults(testResults)

    const seqAnalysis = sequentialAnalysis(controlData, variantData, Math.floor(sampleSize / 10), params.confidence)
    setSequentialData(seqAnalysis)
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>A/B Testing Framework</CardTitle>
          <CardDescription>Set your test parameters and analyze results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="baselineRate">Baseline Conversion Rate</Label>
              <Input id="baselineRate" name="baselineRate" type="number" step="0.01" value={params.baselineRate} onChange={handleInputChange} />
            </div>
            <div>
              <Label htmlFor="mde">Minimum Detectable Effect</Label>
              <Input id="mde" name="mde" type="number" step="0.01" value={params.mde} onChange={handleInputChange} />
            </div>
            <div>
              <Label htmlFor="confidence">Confidence Level</Label>
              <Input id="confidence" name="confidence" type="number" step="0.01" value={params.confidence} onChange={handleInputChange} />
            </div>
            <div>
              <Label htmlFor="power">Statistical Power</Label>
              <Input id="power" name="power" type="number" step="0.01" value={params.power} onChange={handleInputChange} />
            </div>
          </div>
          <Button className="mt-4" onClick={calculateSize}>Calculate Sample Size</Button>
          {sampleSize > 0 && (
            <div className="mt-4">
              <p>Required sample size per variant: {sampleSize}</p>
              <Button className="mt-2" onClick={runTest}>Run Test</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {results && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Control Conversion Rate: {results.controlRate.toFixed(4)}</p>
            <p>Variant Conversion Rate: {results.variantRate.toFixed(4)}</p>
            <p>Relative Improvement: {(results.relativeImprovement * 100).toFixed(2)}%</p>
            <p>P-value: {results.pValue.toFixed(4)}</p>
            <p>Statistically Significant: {results.significant ? 'Yes' : 'No'}</p>
          </CardContent>
        </Card>
      )}

      {sequentialData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sequential Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={sequentialData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sampleSize" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="pValue" stroke="#8884d8" name="P-value" />
                <Line yAxisId="right" type="monotone" dataKey="relativeImprovement" stroke="#82ca9d" name="Relative Improvement" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

