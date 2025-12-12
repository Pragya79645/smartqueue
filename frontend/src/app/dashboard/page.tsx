import { CounterCard } from "@/components/counter-card"
import { QueueGraph } from "@/components/queue-graph"
import { PredictionCard } from "@/components/prediction-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, AlertTriangle, BarChart3, Settings, Users, Bell } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
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
        <Alert className="mb-6 border-warning/50 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">High Rush Detected</AlertTitle>
          <AlertDescription className="text-warning/80">
            Counter B is experiencing high queue load. Consider reallocating staff from Counter D.
          </AlertDescription>
        </Alert>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-card border border-border/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Total Queue</p>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                Live
              </Badge>
            </div>
            <p className="text-3xl font-bold text-card-foreground">87</p>
          </div>
          <div className="p-4 bg-card border border-border/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Active Staff</p>
            <p className="text-3xl font-bold text-card-foreground">12</p>
          </div>
          <div className="p-4 bg-card border border-border/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Avg Wait Time</p>
            <p className="text-3xl font-bold text-card-foreground">8 min</p>
          </div>
          <div className="p-4 bg-card border border-border/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Efficiency</p>
            <p className="text-3xl font-bold text-success">94%</p>
          </div>
        </div>

        {/* Prediction Card */}
        <div className="mb-8">
          <PredictionCard
            timeframe="Next 15 mins"
            expectedQueue={42}
            rushLevel="high"
            recommendation="Open 2 more counters and assign expert staff to Counter B"
            confidence={89}
          />
        </div>

        {/* Counter Cards Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Live Counter Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CounterCard
              title="Counter A"
              value="12"
              status="open"
            />
            <CounterCard
              title="Counter B"
              value="28"
              status="overloaded"
            />
            <CounterCard
              title="Counter C"
              value="18"
              status="busy"
            />
            <CounterCard
              title="Counter D"
              value="8"
              status="open"
            />
            <CounterCard
              title="Counter E"
              value="21"
              status="busy"
            />
            <CounterCard title="Counter F" value="0" status="open" />
          </div>
        </div>

        {/* Queue Graph */}
        <QueueGraph />
      </main>
    </div>
  )
}
