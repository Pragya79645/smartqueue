"use client"

import { useEffect, useState } from "react"
import { CounterCard } from "@/components/counter-card"
import { QueueGraph } from "@/components/queue-graph"
import { PredictionCard } from "@/components/prediction-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, AlertTriangle, BarChart3, Settings, Users, Bell } from "lucide-react"
import Link from "next/link"
import { getCurrentQueue, getQueuePrediction } from "@/api/queueApi"
import { getOptimizedAllocation } from "@/api/allocationApi"

export default function DashboardPage() {
  const [queueData, setQueueData] = useState<any[]>([])
  const [prediction, setPrediction] = useState<any>(null)
  const [optimization, setOptimization] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch live queue data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const queueResponse = await getCurrentQueue()
        if (queueResponse.success) {
          setQueueData(queueResponse.data || [])
        }
      } catch (err: any) {
        console.error("Error fetching queue data:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  // Fetch predictions
  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const predictionResponse = await getQueuePrediction(undefined, 15)
        if (predictionResponse.success) {
          setPrediction(predictionResponse.prediction)
        }
      } catch (err: any) {
        console.error("Error fetching predictions:", err)
      }
    }

    if (queueData.length > 0) {
      fetchPredictions()
      const interval = setInterval(fetchPredictions, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [queueData])

  // Calculate stats
  const totalQueue = queueData.reduce((sum, q) => sum + (q.queueSize || 0), 0)
  const avgWaitTime = queueData.length > 0
    ? Math.round(queueData.reduce((sum, q) => sum + (q.averageWaitTime || 0), 0) / queueData.length)
    : 0
  const criticalCounters = queueData.filter(q => q.status === 'critical').length
  const busyCounters = queueData.filter(q => q.status === 'busy').length

  // Determine rush level and recommendation
  const getRushInfo = () => {
    if (!prediction) {
      return {
        rushLevel: "low" as const,
        recommendation: "Queue levels are normal. Continue monitoring.",
        confidence: 0
      }
    }

    const predictedQueue = prediction.predicted_queue || 0
    const currentQueue = totalQueue || 0
    const increase = predictedQueue - currentQueue

    if (increase > 10 || predictedQueue > 30) {
      return {
        rushLevel: "high" as const,
        recommendation: `High rush expected! Queue may increase by ${Math.round(increase)} people. Consider opening additional counters and assigning more staff.`,
        confidence: Math.round((prediction.confidence || 0.75) * 100)
      }
    } else if (increase > 5 || predictedQueue > 20) {
      return {
        rushLevel: "medium" as const,
        recommendation: `Moderate rush expected. Queue may increase by ${Math.round(increase)} people. Monitor closely.`,
        confidence: Math.round((prediction.confidence || 0.75) * 100)
      }
    } else {
      return {
        rushLevel: "low" as const,
        recommendation: "Queue levels expected to remain stable. No immediate action needed.",
        confidence: Math.round((prediction.confidence || 0.75) * 100)
      }
    }
  }

  const rushInfo = getRushInfo()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Queue Intelligence</h1>
                <p className="text-sm text-muted-foreground">AI-powered queue management</p>
              </div>
            </div>

            <nav className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/staff">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Users className="h-4 w-4" />
                  Staff
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
              <Button variant="outline" size="icon">
                <Bell className="h-4 w-4" />
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Alert Banner */}
        {criticalCounters > 0 && (
          <Alert className="mb-6 border-warning/50 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">High Rush Detected</AlertTitle>
            <AlertDescription className="text-warning/80">
              {criticalCounters} counter(s) experiencing critical load. Consider reallocating staff immediately.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="mb-6 border-destructive/50 bg-destructive/5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-destructive">Error</AlertTitle>
            <AlertDescription className="text-destructive/80">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-card border border-border/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Total Queue</p>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                Live
              </Badge>
            </div>
            <p className="text-3xl font-bold text-card-foreground">{loading ? "..." : totalQueue}</p>
          </div>
          <div className="p-4 bg-card border border-border/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Active Counters</p>
            <p className="text-3xl font-bold text-card-foreground">{loading ? "..." : queueData.length}</p>
          </div>
          <div className="p-4 bg-card border border-border/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Avg Wait Time</p>
            <p className="text-3xl font-bold text-card-foreground">{loading ? "..." : `${avgWaitTime} min`}</p>
          </div>
          <div className="p-4 bg-card border border-border/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Critical Load</p>
            <p className="text-3xl font-bold text-destructive">{loading ? "..." : criticalCounters}</p>
          </div>
        </div>

        {/* Prediction Card */}
        {prediction && (
          <div className="mb-8">
            <PredictionCard
              timeframe={`Next ${prediction.minutes_ahead || 15} mins`}
              expectedQueue={Math.round(prediction.predicted_queue || 0)}
              rushLevel={rushInfo.rushLevel}
              recommendation={rushInfo.recommendation}
              confidence={rushInfo.confidence}
            />
          </div>
        )}

        {/* Counter Cards Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Live Counter Status</h2>
          {loading ? (
            <p className="text-muted-foreground">Loading counter data...</p>
          ) : queueData.length === 0 ? (
            <p className="text-muted-foreground">No counter data available</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {queueData.map((counter) => (
                <CounterCard
                  key={counter.counterId}
                  title={`Counter ${counter.counterId}`}
                  value={counter.queueSize?.toString() || "0"}
                  status={counter.status || "normal"}
                />
              ))}
            </div>
          )}
        </div>

        {/* Queue Graph */}
        <QueueGraph />
      </main>
    </div>
  )
}
