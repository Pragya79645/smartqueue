import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users, TrendingUp, DollarSign, Clock, CheckCircle, AlertTriangle } from "lucide-react"

interface StaffAssignment {
  staff_id: string
  staff_name: string
  counter_id: string
  start_time: number
  end_time: number
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
  if (loading) {
    return (
      <Card className="border-primary/20">
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
      <Card className="border-primary/20">
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

  // Group assignments by counter
  const counterAssignments = allocation.assignments.reduce((acc, assignment) => {
    if (!acc[assignment.counter_id]) {
      acc[assignment.counter_id] = []
    }
    acc[assignment.counter_id].push(assignment)
    return acc
  }, {} as Record<string, StaffAssignment[]>)

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Staff Optimization</CardTitle>
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
          </div>
          <div className="flex items-center gap-2">
            {isPending && (
              <Button 
                onClick={() => onApply?.(allocation.id)} 
                size="sm"
                className="bg-primary hover:bg-primary/90"
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
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Users className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Staff Assigned</p>
              <p className="text-lg font-bold">{allocation.assignments.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Counters</p>
              <p className="text-lg font-bold">{Object.keys(counterAssignments).length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <DollarSign className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Cost</p>
              <p className="text-lg font-bold">${allocation.totalCost}</p>
            </div>
          </div>
        </div>

        {/* Assignments by Counter */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Recommended Assignments</h4>
          {Object.entries(counterAssignments).map(([counterId, assignments]) => (
            <div key={counterId} className="border border-border/50 rounded-lg p-4 bg-card">
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
                    className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{assignment.staff_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Time: {assignment.start_time} - {assignment.end_time}
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
        <Alert className="bg-primary/5 border-primary/20">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary/90">
            {isPending && "This allocation is optimized using OR-Tools. Click 'Apply Allocation' to assign staff and send WhatsApp notifications."}
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
