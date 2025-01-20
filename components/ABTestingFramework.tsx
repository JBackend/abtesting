'use client'

import { useState, useCallback, useEffect } from 'react'
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
import mixpanel from 'mixpanel-browser'
import { useSession, signIn, signOut } from 'next-auth/react'

type TestResults = {
  sampleSize: number;
  pValue: number;
  relativeImprovement: number;
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
    typeof results.sampleSize === 'number' &&
    typeof results.pValue === 'number' &&
    typeof results.relativeImprovement === 'number'
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

// Add the generateTestData function
const generateTestData = (size: number, baseRate: number): number[] => {
  const noise = 0.1;
  return Array(size).fill(0).map(() => 
    Math.random() < (baseRate * (1 + (Math.random() - 0.5) * noise)) ? 1 : 0
  );
};

export default function ABTestingFrameworkWrapper() {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <ABTestingFramework />
    </ErrorBoundary>
  )
}

export function ABTestingFramework() {
  const { data: session, status } = useSession();
  const [params, setParams] = useState({
    baselineRate: 0.1,
    mde: 0.05,
    confidence: 0.95,
    power: 0.8
  })
  const [sampleSize, setSampleSize] = useState<number>(0)
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
  const [sequentialData, setSequentialData] = useState<TestResults[]>([])
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

  useEffect(() => {
    // Initialize Mixpanel
    mixpanel.init('acd65c75b29612117236847e0db6e5e9', {
      debug: process.env.NODE_ENV !== 'production',
      track_pageview: true,
      persistence: 'localStorage'
    });

    // If user is authenticated, identify them
    if (session?.user?.id) {
      mixpanel.identify(session.user.id);
      mixpanel.people.set({
        '$email': session.user.email,
        '$name': session.user.name,
        '$avatar': session.user.image,
        'last_login': new Date().toISOString(),
      });

      // Track login
      mixpanel.track('User Logged In', {
        userId: session.user.id,
        email: session.user.email
      });
    }
  }, [session]);

  // Track tab changes
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, [activeTab]);

  // Track input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Convert string to number explicitly
    const numValue = Number(value);
    
    const error = validateInputs(name, numValue, params, errors);
    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }));
      return;
    }
    
    setParams(prev => ({ ...prev, [name]: numValue }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  }, [validateInputs]);

  // Track sequential analysis updates
  const handleSequentialUpdate = useCallback((data: SequentialAnalysis) => {
    setSequentialData(data);
  }, []);

  // Track test reset
  const handleReset = useCallback(() => {
    setSampleSize(0);
    setResults(null);
    setSequentialData([]);
    setActiveTab('setup');
  }, []);

  // Track export actions
  const handleExport = useCallback(() => {
    // ... existing export logic ...
  }, [results, sequentialData]);

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

  const calculateSize = useCallback(async () => {
    if (!validateForm()) return

    setIsCalculating(true)
    try {
      // Ensure all values are numbers
      const size = calculateSampleSize(
        Number(params.baselineRate),
        Number(params.mde),
        Number(params.confidence),
        Number(params.power)
      )
      if (size <= 0) throw new Error('Invalid sample size calculated')
      setSampleSize(Number(size))
      setActiveTab('run')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setErrors({ form: errorMessage })
    } finally {
      setIsCalculating(false)
    }
  }, [params, validateForm])

  const runTest = useCallback(async () => {
    setIsLoadingResults(true)
    setIsRunningTest(true)

    try {
      if (sampleSize <= 0) throw new Error('Invalid sample size')

      const [controlData, variantData] = await Promise.all([
        generateTestData(Number(sampleSize), params.baselineRate),
        generateTestData(Number(sampleSize), params.baselineRate * (1 + params.mde))
      ])

      const testResults = analyzeResults(controlData, variantData, params.confidence)
      if (!isValidTestResults(testResults)) {
        throw new Error('Invalid test results format')
      }
      setResults({
        ...testResults,
        confidenceIntervals: {
          control: [testResults.confidenceIntervals.control[0], testResults.confidenceIntervals.control[1]],
          variant: [testResults.confidenceIntervals.variant[0], testResults.confidenceIntervals.variant[1]]
        }
      })

      const seqAnalysis = sequentialAnalysis(controlData, variantData, Math.floor(sampleSize / 10), params.confidence)
      if (!isValidSequentialAnalysis(seqAnalysis)) {
        throw new Error('Invalid sequential analysis format')
      }
      setSequentialData(seqAnalysis)
      
      setActiveTab('results')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Test failed to run'
      setErrors({ form: errorMessage })
    } finally {
      setIsLoadingResults(false)
      setIsRunningTest(false)
    }
  }, [sampleSize, params])

  // Add login/logout button
  const AuthButton = () => {
    if (status === "loading") {
      return <div>Loading...</div>;
    }

    if (session?.user) {
      return (
        <div className="flex items-center gap-4">
          <span>{session.user.email}</span>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Sign out
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={() => signIn('github')}
        className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 flex items-center gap-2"
      >
        <GithubIcon className="w-5 h-5" />
        Sign in with GitHub
      </button>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-end p-4 border-b">
        <AuthButton />
      </div>
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

// Simple Github icon component
const GithubIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

