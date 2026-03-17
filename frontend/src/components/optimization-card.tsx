import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users, TrendingUp, DollarSign, Clock, CheckCircle, AlertTriangle } from "lucide-react"

interface StaffAssignment {
  staff_id: string
  staff_name: string
  counter_id: string
  start_time: string | number
  end_time: string | number
  last_moved_at?: string | null
  priority: string
}

interface OptimizationCardProps {
  allocation: {
    id: string
    assignments: StaffAssignment[]
    totalCost: number
    timestamp: string
    status: string
  } | null
  loading?: boolean
  onApply?: (allocationId: string) => void
  onRefresh?: () => void
}

export function OptimizationCard({ allocation, loading, onApply, onRefresh }: OptimizationCardProps) {
  // Re-render every 10s so durations stay current without noisy second-by-second updates.
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 10000)
    return () => clearInterval(timer)
  }, [])

  const formatFromLastMovedAt = (lastMovedAt?: string | null) => {
    if (!lastMovedAt) return "Not assigned"

    const parsed = new Date(lastMovedAt)
    if (Number.isNaN(parsed.getTime())) return "Not assigned"

    const elapsedSeconds = Math.max(0, Math.floor((nowMs - parsed.getTime()) / 1000))
    if (elapsedSeconds < 60) return "Just assigned"
    if (elapsedSeconds < 3600) {
      const minutes = Math.floor(elapsedSeconds / 60)
      return `${minutes} min`
    }

    const hours = Math.floor(elapsedSeconds / 3600)
    const minutes = Math.floor(elapsedSeconds / 60)
    const remainingMinutes = minutes % 60
    return `${hours} hr ${remainingMinutes} min`
  }

  if (loading) {
    return (
      <Card className="prominent-card motion-rise border-primary/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle>Staff Optimization</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Calculating optimal assignments...</p>
        </CardContent>
      </Card>
    )
  }

  if (!allocation) {
    return (
      <Card className="prominent-card motion-rise border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Staff Optimization</CardTitle>
            </div>
            <Button onClick={onRefresh} size="sm" variant="outline">
              Generate Recommendation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No optimization recommendation available. Click "Generate Recommendation" to get AI-powered staff assignments.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const isApplied = allocation.status === 'applied'
  const isPending = allocation.status === 'pending'
  const isInfeasible = allocation.status === 'infeasible'
  const hasAssignments = allocation.assignments.length > 0

  // Group assignments by counter
  const counterAssignments = allocation.assignments.reduce((acc, assignment) => {
    if (!acc[assignment.counter_id]) {
      acc[assignment.counter_id] = []
    }
    acc[assignment.counter_id].push(assignment)
    return acc
  }, {} as Record<string, StaffAssignment[]>)

  return (
    <Card className="prominent-card motion-rise border-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Staff Optimization</CardTitle>
            {isApplied && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                Applied
              </Badge>
            )}
            {isPending && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            )}
            {isInfeasible && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                <AlertTriangle className="h-3 w-3 mr-1" />
                No Feasible Plan
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPending && hasAssignments && (
              <Button 
                onClick={() => onApply?.(allocation.id)} 
                size="sm"
                className="bg-primary hover:bg-primary/90 font-semibold"
              >
                Apply Allocation
              </Button>
            )}
            <Button onClick={onRefresh} size="sm" variant="outline">
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2 p-3 bg-muted/60 rounded-xl border border-border/50">
            <Users className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Staff Assigned</p>
              <p className="text-xl font-extrabold">{allocation.assignments.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/60 rounded-xl border border-border/50">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Counters</p>
              <p className="text-xl font-extrabold">{Object.keys(counterAssignments).length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/60 rounded-xl border border-border/50">
            <DollarSign className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Cost</p>
              <p className="text-xl font-extrabold">${allocation.totalCost}</p>
            </div>
          </div>
        </div>

        {/* Assignments by Counter */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground">Recommended Assignments</h4>
          {!hasAssignments ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No feasible staff assignment was found for current constraints/availability.
              </AlertDescription>
            </Alert>
          ) : Object.entries(counterAssignments).map(([counterId, assignments]) => (
            <div key={counterId} className="border border-border/55 rounded-xl p-4 bg-card/90">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-semibold text-foreground">Counter {counterId}</h5>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                  {assignments.length} staff
                </Badge>
              </div>
              <div className="space-y-2">
                {assignments.map((assignment, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-muted/45 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{assignment.staff_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Time: {formatFromLastMovedAt(assignment.last_moved_at)}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={
                        assignment.priority === 'high' 
                          ? 'bg-destructive/10 text-destructive border-destructive/20'
                          : 'bg-success/10 text-success border-success/20'
                      }
                    >
                      {assignment.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Recommendation Info */}
        <Alert className="bg-primary/10 border-primary/30">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary/90">
            {isPending && hasAssignments && "This allocation is optimized using OR-Tools. Click 'Apply Allocation' to assign staff and send WhatsApp notifications."}
            {isPending && !hasAssignments && "Allocation request completed, but no assignment could be generated with current inputs."}
            {isInfeasible && "OR-Tools returned no feasible assignment. Add available staff or relax constraints, then refresh."}
            {isApplied && "This allocation has been applied. Staff have been notified via WhatsApp."}
          </AlertDescription>
        </Alert>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground text-center">
          Generated at: {new Date(allocation.timestamp).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  )
}
