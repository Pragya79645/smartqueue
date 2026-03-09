"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Activity,
  Users
} from "lucide-react"
import { getAiAnalysis, checkAiHealth, type AiAnalysisResponse } from "@/api/aiApi"

export function AiDashboard() {
  const [aiData, setAiData] = useState<AiAnalysisResponse | null>(null)
  const [aiHealth, setAiHealth] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch AI analysis
  const fetchAiData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [analysisData, healthData] = await Promise.all([
        getAiAnalysis(15),
        checkAiHealth()
      ])
      
      setAiData(analysisData)
      setAiHealth(healthData.success && healthData.ai_engine_status === 'online')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch AI data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAiData()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchAiData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Activity className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading AI Analysis...</span>
      </div>
    )
  }

  const prediction = aiData?.analysis?.prediction
  const currentState = aiData?.analysis?.current_state

  return (
    <div className="space-y-6">
      {/* Header with AI Health Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">AI Analysis Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Real-time predictions and insights
            </p>
          </div>
        </div>
        
        <Badge 
          variant={aiHealth ? "default" : "destructive"}
          className="flex items-center gap-2"
        >
          {aiHealth ? (
            <><CheckCircle2 className="h-4 w-4" /> AI Engine Online</>
          ) : (
            <><XCircle className="h-4 w-4" /> AI Engine Offline</>
          )}
        </Badge>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="ml-2">{error}</span>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Prediction Card */}
        {prediction && (
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle>Queue Prediction</CardTitle>
                </div>
                <Badge variant="outline" className="bg-primary/10">
                  {prediction.confidence}% confident
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Next {prediction.minutes_ahead} minutes
                </p>
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl font-bold">{prediction.predicted_queue}</p>
                  <span className="text-sm text-muted-foreground">customers</span>
                  <Badge
                    variant={prediction.trend === 'increasing' ? 'destructive' : 'default'}
                    className="ml-2"
                  >
                    {prediction.change > 0 ? '+' : ''}{prediction.change}
                  </Badge>
                </div>
              </div>

              {/* Rush Level Indicator */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rush Level:</span>
                <Badge
                  variant={
                    prediction.rush_level === 'high'
                      ? 'destructive'
                      : prediction.rush_level === 'medium'
                      ? 'default'
                      : 'outline'
                  }
                  className={
                    prediction.rush_level === 'high'
                      ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : prediction.rush_level === 'medium'
                      ? 'bg-warning/10 text-warning border-warning/20'
                      : 'bg-success/10 text-success border-success/20'
                  }
                >
                  {prediction.rush_level.toUpperCase()}
                </Badge>
              </div>

              {/* Recommendation */}
              <div className="flex gap-2 p-3 bg-muted/50 rounded-lg border">
                <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {prediction.recommendation}
                </p>
              </div>

              {/* Trend */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Trend:</span>
                <span className={
                  prediction.trend === 'increasing' 
                    ? 'text-destructive font-medium' 
                    : 'text-success font-medium'
                }>
                  {prediction.trend === 'increasing' ? '↗ Increasing' : '↘ Decreasing'}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current State Card */}
        {currentState && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Current Queue State</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Queue</p>
                  <p className="text-2xl font-bold">{currentState.total_queue}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Counters</p>
                  <p className="text-2xl font-bold">{currentState.counter_count}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Queue</p>
                  <p className="text-xl font-semibold">{currentState.average_queue}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Queue</p>
                  <p className="text-xl font-semibold">{currentState.max_queue}</p>
                </div>
              </div>

              {/* Counter Status */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Counter Details:</p>
                <div className="space-y-2">
                  {currentState.counters.map((counter) => (
                    <div
                      key={counter.id}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Counter {counter.id}</span>
                        <Badge
                          variant={
                            counter.status === 'critical'
                              ? 'destructive'
                              : counter.status === 'busy'
                              ? 'default'
                              : 'outline'
                          }
                          className="text-xs"
                        >
                          {counter.status}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{counter.queue} people</p>
                        <p className="text-xs text-muted-foreground">
                          ~{counter.wait_time} min wait
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Timestamp */}
      {aiData && (
        <p className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(aiData.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  )
}
