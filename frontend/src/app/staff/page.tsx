"use client"

import { useEffect, useRef, useState } from "react"
import { StaffTable } from "@/components/staff-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Activity, AlertTriangle, ArrowRightLeft, BarChart3, Settings, Users, Bell, Download, Upload, CheckCircle2, CircleAlert } from "lucide-react"
import Link from "next/link"
import { getCurrentQueue } from "@/api/queueApi"
import { optimizeStaffByCounter } from "@/api/aiApi"
import { createStaff, deleteStaff, getStaffList, updateStaff } from "@/api/staffApi"

type CounterOptimization = {
  mode: "real-time" | "predicted"
  status: "OK" | "OVERLOADED" | "UNDERUTILIZED"
  required_staff: number
  action: "Add" | "Remove" | "No Change"
  recommendation: string
}

const SKILL_OPTIONS = ["general", "loan", "account", "cashier", "inquiry", "premium"]
const SKILL_LEVELS = ["basic", "intermediate", "advanced"] as const

const levelToScore = (level: string) => {
  switch (level) {
    case "advanced":
      return 95
    case "basic":
      return 60
    default:
      return 80
  }
}

const scoreToLevel = (score?: number) => {
  if ((score ?? 0) >= 90) return "advanced"
  if ((score ?? 0) >= 70) return "intermediate"
  return "basic"
}

export default function StaffPage() {
  const [staffData, setStaffData] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, available: 0, onBreak: 0, busy: 0 })
  const [queueData, setQueueData] = useState<any[]>([])
  const [counterOptimization, setCounterOptimization] = useState<Record<string, CounterOptimization>>({})
  const [currentStaffByCounter, setCurrentStaffByCounter] = useState<Record<string, number>>({})
  const [counterOptimizationLoading, setCounterOptimizationLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const lastMovedAtRef = useRef<Record<string, string>>({})

  const fetchData = async () => {
    try {
      const [staffResponse, queueResponse] = await Promise.all([getStaffList(), getCurrentQueue()])

      const staff = Array.isArray(staffResponse?.data) ? staffResponse.data : []
      setStaffData(staff)

      const available = staff.filter((s: any) => s.availability === "available").length
      const busy = staff.filter((s: any) => s.availability === "busy" || s.currentCounter !== null).length
      const onBreak = staff.filter((s: any) => s.availability === "break").length

      setStats({
        total: staff.length,
        available,
        onBreak,
        busy,
      })

      const liveQueue = Array.isArray(queueResponse?.data) ? queueResponse.data : []
      setQueueData(liveQueue)
    } catch (err: any) {
      console.error("Error fetching staff page data:", err)
      setPageError(err.message || "Failed to fetch staff page data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

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

        const currentStaff: Record<string, number> = {}
        const dynamicStaff: Array<{
          id: string
          current_counter: string | null
          status: "active" | "available" | "break"
        }> = []

        for (const member of staffData) {
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
          }
        }

        setCurrentStaffByCounter(currentStaff)

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
  }, [queueData, staffData])

  const handleEdit = (staff: any) => {
    const staffIdentifier = staff.staffId || staff.id || staff._id
    if (!staffIdentifier) {
      window.alert("Invalid staff ID")
      return
    }

    const nextAvailability = window.prompt(
      "Update availability (available | busy | break | offline)",
      staff.availability || "available"
    )

    if (!nextAvailability) return
    if (!["available", "busy", "break", "offline"].includes(nextAvailability)) {
      window.alert("Invalid availability value.")
      return
    }

    const skillsInput = window.prompt(
      `Update skills (comma separated). Allowed: ${SKILL_OPTIONS.join(", ")}`,
      Array.isArray(staff.skills) ? staff.skills.join(",") : "general"
    )

    if (!skillsInput) return

    const parsedSkills = skillsInput
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const invalidSkills = parsedSkills.filter((skill) => !SKILL_OPTIONS.includes(skill))
    if (parsedSkills.length === 0 || invalidSkills.length > 0) {
      window.alert(`Invalid skills. Use only: ${SKILL_OPTIONS.join(", ")}`)
      return
    }

    const currentSkillLevel = scoreToLevel(staff.performanceScore)
    const nextSkillLevel = window.prompt(
      `Update skill level (${SKILL_LEVELS.join(" | ")})`,
      currentSkillLevel
    )

    if (!nextSkillLevel) return
    if (!SKILL_LEVELS.includes(nextSkillLevel as any)) {
      window.alert("Invalid skill level.")
      return
    }

    updateStaff(staffIdentifier, {
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      skills: parsedSkills,
      availability: nextAvailability as "available" | "busy" | "break" | "offline",
      shiftStart: staff.shiftStart || "09:00",
      shiftEnd: staff.shiftEnd || "17:00",
      skillLevel: nextSkillLevel,
      performanceScore: levelToScore(nextSkillLevel),
    })
      .then(() => fetchData())
      .catch((err: any) => {
        console.error("Error updating staff:", err)
        window.alert("Failed to update staff details")
      })
  }

  const handleDelete = (id: string) => {
    if (!id) {
      window.alert("Invalid staff ID")
      return
    }

    const confirmed = window.confirm("Delete this staff member?")
    if (!confirmed) return

    deleteStaff(id)
      .then(() => fetchData())
      .catch((err: any) => {
        console.error("Error deleting staff:", err)
        window.alert("Failed to delete staff member")
      })
  }

  const handleAdd = () => {
    const staffId = window.prompt("Staff ID (example: S001)")
    if (!staffId) return
    const name = window.prompt("Staff name")
    if (!name) return
    const email = window.prompt("Staff email")
    if (!email) return
    const phone = window.prompt("Staff phone")
    if (!phone) return

    const skillsInput = window.prompt(
      `Skills (comma separated). Allowed: ${SKILL_OPTIONS.join(", ")}`,
      "general"
    )
    if (!skillsInput) return

    const parsedSkills = skillsInput
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const invalidSkills = parsedSkills.filter((skill) => !SKILL_OPTIONS.includes(skill))
    if (parsedSkills.length === 0 || invalidSkills.length > 0) {
      window.alert(`Invalid skills. Use only: ${SKILL_OPTIONS.join(", ")}`)
      return
    }

    const skillLevel = window.prompt(`Skill level (${SKILL_LEVELS.join(" | ")})`, "intermediate")
    if (!skillLevel) return
    if (!SKILL_LEVELS.includes(skillLevel as any)) {
      window.alert("Invalid skill level.")
      return
    }

    createStaff({
      staffId,
      name,
      email,
      phone,
      skillLevel,
      skills: parsedSkills,
      performanceScore: levelToScore(skillLevel),
      shiftStart: "09:00",
      shiftEnd: "17:00",
    })
      .then(() => fetchData())
      .catch((err: any) => {
        console.error("Error adding staff:", err)
        window.alert(err.message || "Failed to create staff member")
      })
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

  const overloadedEntries = Object.entries(counterOptimization).filter(
    ([, info]) => info?.status === "OVERLOADED"
  )

  const topRecommendation =
    Object.entries(counterOptimization)
      .map(([counterId, info]) => ({ counterId, rec: info?.recommendation }))
      .find((entry) => entry.rec && entry.rec !== "No movement suggested")?.rec ||
    (overloadedEntries.length > 0
      ? `Add staff support to Counter ${overloadedEntries[0][0]} immediately.`
      : "No immediate staffing action required.")

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
        {pageError && (
          <Alert className="mb-6 border-destructive/50 bg-destructive/5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-destructive">Error</AlertTitle>
            <AlertDescription className="text-destructive/80">{pageError}</AlertDescription>
          </Alert>
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">Staff Management</h2>
              <p className="text-muted-foreground">Manage your team, track availability, and optimize assignments</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-card border border-border/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Total Staff</p>
              <p className="text-3xl font-bold text-card-foreground">{loading ? "..." : stats.total}</p>
            </div>
            <div className="p-4 bg-card border border-border/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Available</p>
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  Active
                </Badge>
              </div>
              <p className="text-3xl font-bold text-success">{loading ? "..." : stats.available}</p>
            </div>
            <div className="p-4 bg-card border border-border/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">On Break</p>
              <p className="text-3xl font-bold text-warning">{loading ? "..." : stats.onBreak}</p>
            </div>
            <div className="p-4 bg-card border border-border/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Busy</p>
              <p className="text-3xl font-bold text-chart-1">{loading ? "..." : stats.busy}</p>
            </div>
          </div>

          {overloadedEntries.length > 0 && (
            <Alert className="mb-6 border-red-300 bg-red-50/70">
              <CircleAlert className="h-4 w-4 text-red-700" />
              <AlertTitle className="text-red-800">Staffing Alert: Overloaded Counters</AlertTitle>
              <AlertDescription className="text-red-700">
                {overloadedEntries.length} counter(s) are overloaded. Prioritize immediate staff movement.
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <ArrowRightLeft className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Top Recommendation</p>
                <p className="text-sm text-muted-foreground">{topRecommendation}</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-bold text-foreground mb-4">Staff Optimization by Counter</h3>
            {counterOptimizationLoading ? (
              <p className="text-muted-foreground">Calculating staff recommendations...</p>
            ) : queueData.length === 0 ? (
              <p className="text-muted-foreground">No live counter data available</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {queueData.map((counter) => {
                  const counterId = String(counter.counterId)
                  const staffInfo = counterOptimization[counterId]
                  const currentAssigned = currentStaffByCounter[counterId] || 0
                  const styles = getStatusStyles(staffInfo?.status)

                  return (
                    <div key={`staff-opt-${counterId}`} className={`rounded-xl border p-5 ${styles.card}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Counter {counterId}</p>
                          <p className="text-2xl font-bold text-foreground">{counter.queueSize || 0} people</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(staffInfo?.status)}
                          <Badge variant="outline" className={styles.badge}>
                            {staffInfo?.status || "UNDERUTILIZED"}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Staff assigned</span>
                          <span className="font-semibold text-foreground">{currentAssigned}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Required staff</span>
                          <span className="font-semibold text-foreground">{staffInfo?.required_staff ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Action</span>
                          <span className="font-semibold text-foreground">{staffInfo?.action || "No Change"}</span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-md border border-border/60 bg-card/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Recommended action</p>
                        <p className="text-sm font-medium text-foreground">
                          {staffInfo?.recommendation && staffInfo.recommendation !== "No movement suggested"
                            ? staffInfo.recommendation
                            : staffInfo?.action || "No Change"}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <StaffTable 
          staffData={staffData}
          loading={loading}
          onEdit={handleEdit} 
          onDelete={handleDelete} 
          onAdd={handleAdd} 
        />
      </main>
    </div>
  )
}
