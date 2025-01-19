'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useCases, calculateSampleSize, analyzeResults, sequentialAnalysis, validateInputs } from '../utils/abTestingUtils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'
import { ErrorBoundary } from 'react-error-boundary'

// Add these type definitions at the top of the file
type TestResults = {
  controlRate: number;
  variantRate: number;
  confidenceIntervals: {
    control: [number, number];
    variant: [number, number];
  };
  relativeImprovement: number;
  pValue: number;
  significant: boolean;
  conclusion: string;
}

type SequentialAnalysis = Array<{
  sampleSize: number;
  pValue: number;
  relativeImprovement: number;
}>

// Add these validation functions before the component
function isValidTestResults(results: any): results is TestResults {
  return (
    typeof results === 'object' &&
    typeof results.controlRate === 'number' &&
    typeof results.variantRate === 'number' &&
    Array.isArray(results.confidenceIntervals?.control) &&
    Array.isArray(results.confidenceIntervals?.variant) &&
    typeof results.relativeImprovement === 'number' &&
    typeof results.pValue === 'number' &&
    typeof results.significant === 'boolean' &&
    typeof results.conclusion === 'string'
  )
}

function isValidSequentialAnalysis(data: any): data is SequentialAnalysis {
  return Array.isArray(data) && data.every(point => 
    typeof point === 'object' &&
    typeof point.sampleSize === 'number' &&
    typeof point.pValue === 'number' &&
    typeof point.relativeImprovement === 'number'
  )
}

// Add loading indicator component
const LoadingSpinner = () => (
  <div className="flex justify-center items-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
  </div>
)

export default function ABTestingFrameworkWrapper() {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <ABTestingFramework />
    </ErrorBoundary>
  )
}

export function ABTestingFramework() {
  const [params, setParams] = useState({
    baselineRate: 0.1,
    mde: 0.05,
    confidence: 0.95,
    power: 0.8
  })
  const [sampleSize, setSampleSize] = useState(0)
  const [results, setResults] = useState<null | {
    controlRate: number;
    variantRate: number;
    confidenceIntervals: {
      control: [number, number];
      variant: [number, number];
    };
    relativeImprovement: number;
    pValue: number;
    significant: boolean;
    conclusion: string;
  }>(null)
  const [sequentialData, setSequentialData] = useState<Array<{
    sampleSize: number;
    pValue: number;
    relativeImprovement: number;
  }>>([])
  const [activeTab, setActiveTab] = useState('setup')
  const [errors, setErrors] = useState<{
    baselineRate?: string;
    mde?: string;
    confidence?: string;
    power?: string;
    form?: string;
  }>({})
  const [isCalculating, setIsCalculating] = useState(false)
  const [isRunningTest, setIsRunningTest] = useState(false)
  const [isLoadingResults, setIsLoadingResults] = useState(false)

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const numValue = parseFloat(value)
    
    if (isNaN(numValue)) {
      setErrors(prev => ({ ...prev, [name]: 'Please enter a valid number' }))
      return
    }
    
    setParams(prev => ({ ...prev, [name]: numValue }))
    setErrors(prev => ({ ...prev, [name]: null }))
  }, [])

  const handleUseCaseSelect = useCallback((useCase: { baselineRate: number; mde: number }) => {
    setParams(prev => ({
      ...prev,
      baselineRate: useCase.baselineRate,
      mde: useCase.mde
    }))
  }, [])

  const validateForm = useCallback(() => {
    const validationError = validateInputs(params.baselineRate, params.mde, params.confidence, params.power)
    if (validationError) {
      setErrors({ form: validationError })
      return false
    }
    setErrors({})
    return true
  }, [params])

  const calculateSize = useCallback(() => {
    if (!validateForm()) return

    setIsCalculating(true)
    setTimeout(() => {
      try {
        const size = calculateSampleSize(params.baselineRate, params.mde, params.confidence, params.power)
        setSampleSize(size)
        setActiveTab('run')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
        setErrors({ form: errorMessage })
      } finally {
        setIsCalculating(false)
      }
    }, 1000) // Simulate calculation time
  }, [params, validateForm])

  const runTest = useCallback(() => {
    setIsLoadingResults(true)
    setIsRunningTest(true)
    try {
      // Improved simulation with noise and more realistic variation
      const noise = 0.1 // Add some random noise to make it more realistic
      const controlData = Array(sampleSize).fill(0).map(() => 
        Math.random() < (params.baselineRate * (1 + (Math.random() - 0.5) * noise)) ? 1 : 0
      )
      const variantData = Array(sampleSize).fill(0).map(() => 
        Math.random() < (params.baselineRate * (1 + params.mde) * (1 + (Math.random() - 0.5) * noise)) ? 1 : 0
      )
      
      const testResults = analyzeResults(controlData, variantData, params.confidence)
      if (!testResults || !isValidTestResults(testResults)) {
        setErrors({ form: 'Failed to analyze results - invalid data format' })
        return
      }
      
      // Type assertion after validation
      setResults(testResults as TestResults)

      const seqAnalysis = sequentialAnalysis(controlData, variantData, Math.floor(sampleSize / 10), params.confidence)
      if (!seqAnalysis || !isValidSequentialAnalysis(seqAnalysis)) {
        setErrors({ form: 'Failed to generate sequential analysis - invalid data format' })
        return
      }
      
      // Type assertion after validation
      setSequentialData(seqAnalysis as SequentialAnalysis)

      setActiveTab('results')
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Test failed to run'
      setErrors({ form: errorMessage })
    } finally {
      setIsLoadingResults(false)
      setIsRunningTest(false)
    }
  }, [sampleSize, params])

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>A/B Testing Framework</CardTitle>
          <CardDescription>Set up, run, and analyze your A/B tests with ease</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="setup">1. Setup</TabsTrigger>
              <TabsTrigger value="run">2. Run Test</TabsTrigger>
              <TabsTrigger value="results">3. Results</TabsTrigger>
            </TabsList>
            <TabsContent value="setup">
              <Card>
                <CardHeader>
                  <CardTitle>Test Setup</CardTitle>
                  <CardDescription>Choose a use case or set custom parameters</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Label htmlFor="useCase">Select a Use Case</Label>
                    <Select onValueChange={(value) => handleUseCaseSelect(useCases[parseInt(value)])}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a use case" />
                      </SelectTrigger>
                      <SelectContent>
                        {useCases.map((useCase, index) => (
                          <SelectItem key={index} value={index.toString()}>
                            {useCase.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Label htmlFor="baselineRate">Baseline Conversion Rate</Label>
                            <Input
                              id="baselineRate"
                              name="baselineRate"
                              type="number"
                              step="0.01"
                              value={params?.baselineRate ?? ''}
                              onChange={handleInputChange}
                              className={errors?.baselineRate ? "border-red-500" : ""}
                            />
                            {errors?.baselineRate && <p className="text-red-500 text-sm">{errors?.baselineRate}</p>}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>The current conversion rate (between 0 and 1)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Label htmlFor="mde">Minimum Detectable Effect</Label>
                            <Input
                              id="mde"
                              name="mde"
                              type="number"
                              step="0.01"
                              value={params.mde}
                              onChange={handleInputChange}
                              className={errors.mde ? "border-red-500" : ""}
                            />
                            {errors.mde && <p className="text-red-500 text-sm">{errors.mde}</p>}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>The smallest improvement you want to be able to detect (between 0 and 1)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Label htmlFor="confidence">Confidence Level</Label>
                            <Input
                              id="confidence"
                              name="confidence"
                              type="number"
                              step="0.01"
                              value={params.confidence}
                              onChange={handleInputChange}
                              className={errors.confidence ? "border-red-500" : ""}
                            />
                            {errors.confidence && <p className="text-red-500 text-sm">{errors.confidence}</p>}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>The probability that the interval contains the true value (between 0.8 and 1)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Label htmlFor="power">Statistical Power</Label>
                            <Input
                              id="power"
                              name="power"
                              type="number"
                              step="0.01"
                              value={params.power}
                              onChange={handleInputChange}
                              className={errors.power ? "border-red-500" : ""}
                            />
                            {errors.power && <p className="text-red-500 text-sm">{errors.power}</p>}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>The probability of detecting an effect if there is one (between 0.8 and 1)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {errors.form && <Alert variant="destructive" className="mt-4"><AlertDescription>{errors.form}</AlertDescription></Alert>}
                  <Button className="mt-4" onClick={calculateSize} disabled={isCalculating}>
                    {isCalculating ? "Calculating..." : "Calculate Sample Size"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="run">
              <Card>
                <CardHeader>
                  <CardTitle>Run Test</CardTitle>
                  <CardDescription>Start your A/B test with the calculated sample size</CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <AlertTitle>Sample Size Calculated</AlertTitle>
                    <AlertDescription>
                      Required sample size per variant: {sampleSize}
                    </AlertDescription>
                  </Alert>
                  <Progress value={isRunningTest ? 50 : 0} className="mt-4" />
                  <Button className="mt-4" onClick={runTest} disabled={isRunningTest}>
                    {isRunningTest ? "Running Test..." : "Run Test"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="results">
              {results && (
                <Card>
                  <CardHeader>
                    <CardTitle>Test Results</CardTitle>
                    <CardDescription>Analysis of your A/B test</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-lg font-semibold">Control Group</h3>
                        <p>Conversion Rate: {(results.controlRate * 100).toFixed(2)}%</p>
                        <p>Confidence Interval: [{(results.confidenceIntervals.control[0] * 100).toFixed(2)}%, {(results.confidenceIntervals.control[1] * 100).toFixed(2)}%]</p>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Variant Group</h3>
                        <p>Conversion Rate: {(results?.variantRate * 100).toFixed(2)}%</p>
                        <p>Confidence Interval: [{(results?.confidenceIntervals?.variant[0] * 100).toFixed(2)}%, {(results?.confidenceIntervals?.variant[1] * 100).toFixed(2)}%]</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <h3 className="text-lg font-semibold">Analysis</h3>
                      <p>Relative Improvement: {(results.relativeImprovement * 100).toFixed(2)}%</p>
                      <p>P-value: {results.pValue.toFixed(4)}</p>
                      <p>Statistically Significant: {results.significant ? 'Yes' : 'No'}</p>
                      <p className="mt-2 font-semibold">{results.conclusion}</p>
                    </div>
                    {sequentialData.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold mb-4">Sequential Analysis</h3>
                        <ResponsiveContainer width="100%" height={400}>
                          <LineChart data={sequentialData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="sampleSize" />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <RechartsTooltip />
                            <Legend />
                            <Line yAxisId="left" type="monotone" dataKey="pValue" stroke="#8884d8" name="P-value" />
                            <Line yAxisId="right" type="monotone" dataKey="relativeImprovement" stroke="#82ca9d" name="Relative Improvement" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

