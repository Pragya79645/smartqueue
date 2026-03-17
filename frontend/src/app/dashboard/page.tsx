"use client"

import { useEffect, useRef, useState } from "react"
import { CounterCard } from "@/components/counter-card"
import { QueueGraph } from "@/components/queue-graph"
import { PredictionCard } from "@/components/prediction-card"
import { OptimizationCard } from "@/components/optimization-card"
import { CameraFeed } from "@/components/camera-feed"
import { AiDashboard } from "@/components/ai-dashboard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, AlertTriangle, BarChart3, Settings, Users, Bell, CheckCircle2, CircleAlert, ArrowRightLeft } from "lucide-react"
import Link from "next/link"
import { getCurrentQueue, getQueuePrediction } from "@/api/queueApi"
import { getOptimizedAllocation, applyAllocation } from "@/api/allocationApi"
import { applyStaffAllocationState, getStaffList } from "@/api/staffApi"
import { optimizeStaffByCounter } from "@/api/aiApi"

type CounterOptimization = {
  mode: "real-time" | "predicted"
  status: "OK" | "OVERLOADED" | "OVERSTAFFED" | "UNDERUTILIZED"
  required_staff: number
  action: "Add" | "Remove" | "No Change"
  recommendation: string
}

export default function DashboardPage() {
  const [queueData, setQueueData] = useState<any[]>([])
  const [prediction, setPrediction] = useState<any>(null)
  const [optimization, setOptimization] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [optimizationLoading, setOptimizationLoading] = useState(false)
  const [counterOptimization, setCounterOptimization] = useState<Record<string, CounterOptimization>>({})
  const [currentStaffByCounter, setCurrentStaffByCounter] = useState<Record<string, number>>({})
  const [currentStaffNamesByCounter, setCurrentStaffNamesByCounter] = useState<Record<string, string[]>>({})
  const [counterOptimizationLoading, setCounterOptimizationLoading] = useState(false)
  const [applyingSmartAllocation, setApplyingSmartAllocation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const lastMovedAtRef = useRef<Record<string, string>>({})

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

  // Fetch optimization recommendation
  const fetchOptimization = async () => {
    setOptimizationLoading(true)
    try {
      const response = await getOptimizedAllocation()
      if (response.success) {
        setOptimization(response.allocation)
      }
    } catch (err: any) {
      console.error("Error fetching optimization:", err)
      setError("Failed to generate optimization recommendation")
    } finally {
      setOptimizationLoading(false)
    }
  }

  // Apply allocation
  const handleApplyAllocation = async (allocationId: string) => {
    try {
      const response = await applyAllocation(allocationId)
      if (response.success) {
        setSuccessMessage("Allocation applied successfully! Staff have been notified via WhatsApp.")
        setOptimization({ ...optimization, status: 'applied' })
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000)
      }
    } catch (err: any) {
      console.error("Error applying allocation:", err)
      setError("Failed to apply allocation")
    }
  }

  // Load initial optimization on mount
  useEffect(() => {
    if (queueData.length > 0 && !optimization) {
      fetchOptimization()
    }
  }, [queueData])

  // Build rule-based per-counter optimization cards
  useEffect(() => {
    const fetchCounterOptimization = async () => {
      if (queueData.length === 0) {
        setCounterOptimization({})
        return
      }

      try {
        setCounterOptimizationLoading(true)

        const counts: Record<string, number> = {}
        for (const counter of queueData) {
          counts[String(counter.counterId)] = Number(counter.queueSize || 0)
        }

        const staffResponse = await getStaffList()
        const staffList = Array.isArray(staffResponse?.data) ? staffResponse.data : []
        const currentStaff: Record<string, number> = {}
        const currentStaffNames: Record<string, string[]> = {}
        const dynamicStaff: Array<{
          id: string
          current_counter: string | null
          status: "active" | "available" | "break"
        }> = []

        for (const member of staffList) {
          const memberId = String(member.staffId || member.id || member._id || "").trim()
          const availability = String(member.availability || "available").toLowerCase()
          const mappedStatus = availability === "break" || availability === "offline"
            ? "break"
            : availability === "available"
              ? "available"
              : "active"

          if (memberId) {
            dynamicStaff.push({
              id: memberId,
              current_counter: member.currentCounter !== undefined && member.currentCounter !== null
                ? String(member.currentCounter)
                : null,
              status: mappedStatus,
            })
          }

          if (member.currentCounter !== undefined && member.currentCounter !== null) {
            const key = String(member.currentCounter)
            currentStaff[key] = (currentStaff[key] || 0) + 1
            if (!currentStaffNames[key]) {
              currentStaffNames[key] = []
            }
            currentStaffNames[key].push(String(member.name || memberId))
          }
        }

        setCurrentStaffByCounter(currentStaff)
        setCurrentStaffNamesByCounter(currentStaffNames)

        const optimizeResponse = await optimizeStaffByCounter({
          counts,
          staff: dynamicStaff,
          last_moved_at: lastMovedAtRef.current,
        })

        if (optimizeResponse?.success && optimizeResponse?.data) {
          setCounterOptimization(optimizeResponse.data)
          if (optimizeResponse?.last_moved_at && typeof optimizeResponse.last_moved_at === "object") {
            lastMovedAtRef.current = optimizeResponse.last_moved_at
          }
        }
      } catch (err: any) {
        console.error("Error fetching counter optimization:", err)
      } finally {
        setCounterOptimizationLoading(false)
      }
    }

    fetchCounterOptimization()
  }, [queueData])

  const handleApplySmartOptimization = async () => {
    if (queueData.length === 0) {
      setError("No live counter data available to optimize")
      return
    }

    try {
      setApplyingSmartAllocation(true)
      setError(null)

      const counts: Record<string, number> = {}
      for (const counter of queueData) {
        counts[String(counter.counterId)] = Number(counter.queueSize || 0)
      }

      const staffResponse = await getStaffList()
      const staffList = Array.isArray(staffResponse?.data) ? staffResponse.data : []
      const dynamicStaff: Array<{
        id: string
        current_counter: string | null
        status: "active" | "available" | "break"
      }> = []

      for (const member of staffList) {
        const memberId = String(member.staffId || member.id || member._id || "").trim()
        if (!memberId) {
          continue
        }

        const availability = String(member.availability || "available").toLowerCase()
        const mappedStatus = availability === "break" || availability === "offline"
          ? "break"
          : availability === "available"
            ? "available"
            : "active"

        dynamicStaff.push({
          id: memberId,
          current_counter: member.currentCounter !== undefined && member.currentCounter !== null
            ? String(member.currentCounter)
            : null,
          status: mappedStatus,
        })
      }

      const optimizeResponse = await optimizeStaffByCounter({
        counts,
        staff: dynamicStaff,
        last_moved_at: lastMovedAtRef.current,
      })

      const recommendedAllocation = optimizeResponse?.raw?.allocation as Record<string, string[]> | undefined
      if (!recommendedAllocation || typeof recommendedAllocation !== "object") {
        throw new Error("Optimization did not return an allocation map")
      }

      const applyResponse = await applyStaffAllocationState(recommendedAllocation)

      if (optimizeResponse?.success && optimizeResponse?.data) {
        setCounterOptimization(optimizeResponse.data)
      }

      const persistedAllocation = applyResponse?.data?.allocation as Record<string, string[]> | undefined
      if (persistedAllocation && typeof persistedAllocation === "object") {
        const byCounterCount: Record<string, number> = {}
        const byCounterNames: Record<string, string[]> = {}
        const nameById: Record<string, string> = {}

        for (const member of staffList) {
          const memberId = String(member.staffId || member.id || member._id || "").trim()
          if (memberId) {
            nameById[memberId] = String(member.name || memberId)
          }
        }

        for (const [counterId, ids] of Object.entries(persistedAllocation)) {
          byCounterCount[counterId] = Array.isArray(ids) ? ids.length : 0
          byCounterNames[counterId] = Array.isArray(ids)
            ? ids.map((sid) => nameById[sid] || sid)
            : []
        }

        setCurrentStaffByCounter(byCounterCount)
        setCurrentStaffNamesByCounter(byCounterNames)
      }

      setSuccessMessage("Smart optimization applied and persisted to staff allocation state.")
      setTimeout(() => setSuccessMessage(null), 5000)
      setQueueData((prev) => [...prev])
    } catch (err: any) {
      console.error("Error applying smart optimization:", err)
      setError(err.message || "Failed to apply smart optimization")
    } finally {
      setApplyingSmartAllocation(false)
    }
  }

  const getStatusStyles = (status?: string) => {
    if (status === "OK") {
      return {
        card: "border-green-200 bg-green-50/40",
        badge: "bg-green-100 text-green-800 border-green-300",
      }
    }
    if (status === "OVERLOADED") {
      return {
        card: "border-red-200 bg-red-50/40",
        badge: "bg-red-100 text-red-800 border-red-300",
      }
    }
    return {
      card: "border-yellow-200 bg-yellow-50/40",
      badge: "bg-yellow-100 text-yellow-800 border-yellow-300",
    }
  }

  const getStatusIcon = (status?: string) => {
    if (status === "OK") {
      return <CheckCircle2 className="h-4 w-4 text-green-700" />
    }
    if (status === "OVERLOADED") {
      return <CircleAlert className="h-4 w-4 text-red-700" />
    }
    return <AlertTriangle className="h-4 w-4 text-yellow-700" />
  }

  const deriveStaffStatus = (assigned: number, required: number): CounterOptimization["status"] => {
    if (assigned < required) {
      return "OVERLOADED"
    }
    if (assigned > required) {
      return "OVERSTAFFED"
    }
    return "OK"
  }

  const deriveStaffAction = (status: CounterOptimization["status"]): CounterOptimization["action"] => {
    if (status === "OVERLOADED") {
      return "Add"
    }
    if (status === "OVERSTAFFED" || status === "UNDERUTILIZED") {
      return "Remove"
    }
    return "No Change"
  }

  const getTopCardStatus = (counterId: string, queueStatus?: string) => {
    const required = Number(counterOptimization[counterId]?.required_staff ?? 0)
    const assigned = Number(currentStaffByCounter[counterId] || 0)

    // Keep top card state aligned with the same live values shown in staff cards.
    if (required > 0) {
      const derived = deriveStaffStatus(assigned, required)
      if (derived === "OVERLOADED") {
        return "overloaded"
      }
      if (derived === "OK") {
        return "normal"
      }
      return "busy"
    }

    const optimizationStatus = counterOptimization[counterId]?.status
    if (optimizationStatus === "OVERLOADED") {
      return "overloaded"
    }
    if (optimizationStatus === "OK") {
      return "normal"
    }

    if (queueStatus === "critical") {
      return "critical"
    }
    if (queueStatus === "busy") {
      return "busy"
    }
    return "normal"
  }

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
  const overloadedEntries = queueData
    .map((counter) => {
      const counterId = String(counter.counterId)
      const required = Number(counterOptimization[counterId]?.required_staff ?? 0)
      const assigned = Number(currentStaffByCounter[counterId] || 0)
      if (required <= 0) return null
      const status = deriveStaffStatus(assigned, required)
      return status === "OVERLOADED" ? [counterId, status] : null
    })
    .filter(Boolean) as Array<[string, CounterOptimization["status"]]>
  const recommendationList = Object.entries(counterOptimization)
    .map(([counterId, info]) => {
      if (!info?.recommendation || info.recommendation === "No movement suggested") {
        return null
      }
      return `Counter ${counterId}: ${info.recommendation}`
    })
    .filter(Boolean) as string[]
  const primaryRecommendation = recommendationList[0] ||
    (overloadedEntries.length > 0
      ? `Add staff support to Counter ${overloadedEntries[0][0]} immediately.`
      : "No immediate staffing action required.")

  return (
    <div className="min-h-screen bg-background subtle-grid">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/85 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/15 rounded-xl border border-primary/30 shadow-sm">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Queue Intelligence</h1>
                <p className="text-sm font-medium text-muted-foreground">AI-powered queue management</p>
              </div>
            </div>

            <nav className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2 font-semibold">
                  <BarChart3 className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/staff">
                <Button variant="ghost" size="sm" className="gap-2 font-semibold">
                  <Users className="h-4 w-4" />
                  Staff
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="gap-2 font-semibold">
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

      <main className="container mx-auto px-6 py-8 motion-rise">
        {/* Alert Banners */}
        {successMessage && (
          <Alert className="mb-6 border-success/50 bg-success/5">
            <AlertTriangle className="h-4 w-4 text-success" />
            <AlertTitle className="text-success">Success</AlertTitle>
            <AlertDescription className="text-success/80">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {criticalCounters > 0 && (
          <Alert className="mb-6 border-warning/50 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">High Rush Detected</AlertTitle>
            <AlertDescription className="text-warning/80">
              {criticalCounters} counter(s) experiencing critical load. Consider reallocating staff immediately.
            </AlertDescription>
          </Alert>
        )}

        {overloadedEntries.length > 0 && (
          <Alert className="mb-6 border-red-300 bg-red-50/70">
            <CircleAlert className="h-4 w-4 text-red-700" />
            <AlertTitle className="text-red-800">Staffing Alert: Overloaded Counters</AlertTitle>
            <AlertDescription className="text-red-700">
              {overloadedEntries.length} counter(s) are overloaded. Prioritize immediate staff movement or allocation.
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
          <div className="prominent-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Total Queue</p>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-semibold">
                Live
              </Badge>
            </div>
            <p className="text-4xl font-extrabold text-card-foreground">{loading ? "..." : totalQueue}</p>
          </div>
          <div className="prominent-card p-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Active Counters</p>
            <p className="text-4xl font-extrabold text-card-foreground">{loading ? "..." : queueData.length}</p>
          </div>
          <div className="prominent-card p-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Avg Wait Time</p>
            <p className="text-4xl font-extrabold text-card-foreground">{loading ? "..." : `${avgWaitTime} min`}</p>
          </div>
          <div className="prominent-card p-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Critical Load</p>
            <p className="text-4xl font-extrabold text-destructive">{loading ? "..." : criticalCounters}</p>
          </div>
        </div>

        {/* Camera Feed Section */}
        <div className="mb-8">
          <CameraFeed />
        </div>

        {/* AI Analysis Dashboard */}
        <div className="mb-8">
          <AiDashboard />
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

        {/* Optimization Card */}
        <div className="mb-8">
          <OptimizationCard
            allocation={optimization}
            loading={optimizationLoading}
            onApply={handleApplyAllocation}
            onRefresh={fetchOptimization}
            counterIds={queueData.map((counter) => String(counter.counterId))}
          />
        </div>

        {/* Counter Cards Grid */}
        <div className="mb-8">
          <h2 className="section-title mb-4">Live Counter Status</h2>
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
                  status={getTopCardStatus(String(counter.counterId), counter.status)}
                  waitTime={counter.averageWaitTime}
                  details={`Last updated: ${new Date(counter.timestamp).toLocaleTimeString()}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Staff Optimization Cards */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="section-title mb-0">Staff Optimization by Counter</h2>
            <Button
              onClick={handleApplySmartOptimization}
              disabled={counterOptimizationLoading || applyingSmartAllocation || queueData.length === 0}
              className="font-semibold"
            >
              {applyingSmartAllocation ? "Applying..." : "Apply Optimization"}
            </Button>
          </div>
          <div className="mb-4 rounded-2xl border border-primary/35 bg-primary/10 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <ArrowRightLeft className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-foreground">Top Recommendation</p>
                <p className="text-sm text-foreground/85">{primaryRecommendation}</p>
              </div>
            </div>
          </div>
          {counterOptimizationLoading ? (
            <p className="text-muted-foreground">Calculating staff recommendations...</p>
          ) : queueData.length === 0 ? (
            <p className="text-muted-foreground">No counter data available</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {queueData.map((counter) => {
                const counterId = String(counter.counterId)
                const staffInfo = counterOptimization[counterId]
                const currentAssigned = currentStaffByCounter[counterId] || 0
                const requiredStaff = Number(staffInfo?.required_staff ?? 0)
                const effectiveStatus = requiredStaff > 0
                  ? deriveStaffStatus(currentAssigned, requiredStaff)
                  : (staffInfo?.status || "OK")
                const effectiveAction = deriveStaffAction(effectiveStatus)
                const styles = getStatusStyles(effectiveStatus)

                return (
                  <div
                    key={`staff-opt-${counterId}`}
                    className={`prominent-card rounded-2xl border p-5 ${styles.card}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Counter {counterId}</p>
                        <p className="text-2xl font-bold text-foreground">{counter.queueSize || 0} people</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(effectiveStatus)}
                        <Badge variant="outline" className={styles.badge}>
                          {effectiveStatus}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Staff assigned</span>
                        <span className="text-base font-semibold text-foreground">{currentAssigned}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Required staff</span>
                        <span className="text-base font-semibold text-foreground">{requiredStaff}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Action</span>
                        <span className="text-base font-semibold text-foreground">{effectiveAction}</span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-md border border-border/60 bg-card/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Recommended action</p>
                      <p className="text-sm font-medium text-foreground">
                        {staffInfo?.recommendation && staffInfo.recommendation !== "No movement suggested"
                          ? staffInfo.recommendation
                          : effectiveAction}
                      </p>
                    </div>

                    <div className="mt-3 rounded-md border border-border/60 bg-card/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Assigned staff</p>
                      <p className="text-sm font-medium text-foreground">
                        {currentStaffNamesByCounter[counterId] && currentStaffNamesByCounter[counterId].length > 0
                          ? currentStaffNamesByCounter[counterId].join(", ")
                          : "No staff currently assigned"}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Queue Graph */}
        <QueueGraph />
      </main>
    </div>
  )
}

