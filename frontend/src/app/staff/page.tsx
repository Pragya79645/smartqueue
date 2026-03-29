"use client"

import { useEffect, useRef, useState } from "react"
import { StaffTable } from "@/components/staff-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Activity, AlertTriangle, ArrowRightLeft, BarChart3, Settings, Users, Bell, Download, Upload, CheckCircle2, CircleAlert, X, UserPlus } from "lucide-react"
import Link from "next/link"
import { getCurrentQueue } from "@/api/queueApi"
import { optimizeStaffByCounter } from "@/api/aiApi"
import { applyStaffAllocationState, createStaff, deleteStaff, getStaffList, updateStaff } from "@/api/staffApi"

type CounterOptimization = {
  mode: "real-time" | "predicted"
  status: "OK" | "OVERLOADED" | "OVERSTAFFED" | "UNDERUTILIZED"
  required_staff: number
  action: "Add" | "Remove" | "No Change"
  recommendation: string
}

const SKILL_OPTIONS = ["general", "loan", "account", "cashier", "inquiry", "premium"]
const SKILL_LEVELS = ["basic", "intermediate", "advanced"] as const
type SkillLevel = typeof SKILL_LEVELS[number]

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
  const [applyingSmartAllocation, setApplyingSmartAllocation] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddSubmitting, setIsAddSubmitting] = useState(false)
  const [addFormError, setAddFormError] = useState<string | null>(null)
  const [newStaff, setNewStaff] = useState({
    staffId: "",
    name: "",
    email: "",
    phone: "",
    skillLevel: "intermediate" as SkillLevel,
    skills: ["general"] as string[],
    shiftStart: "09:00",
    shiftEnd: "17:00",
  })
  const lastMovedAtRef = useRef<Record<string, string>>({})

  const resetAddStaffForm = () => {
    setNewStaff({
      staffId: "",
      name: "",
      email: "",
      phone: "",
      skillLevel: "intermediate",
      skills: ["general"],
      shiftStart: "09:00",
      shiftEnd: "17:00",
    })
    setAddFormError(null)
  }

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
    resetAddStaffForm()
    setIsAddModalOpen(true)
  }

  const toggleSkill = (skill: string) => {
    setNewStaff((prev) => {
      const hasSkill = prev.skills.includes(skill)
      if (hasSkill) {
        const next = prev.skills.filter((s) => s !== skill)
        return {
          ...prev,
          skills: next.length > 0 ? next : ["general"],
        }
      }
      return {
        ...prev,
        skills: [...prev.skills, skill],
      }
    })
  }

  const handleSubmitAddStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAddFormError(null)

    const normalizedId = newStaff.staffId.trim().toUpperCase()
    const normalizedName = newStaff.name.trim()
    const normalizedEmail = newStaff.email.trim().toLowerCase()
    const normalizedPhone = newStaff.phone.trim()

    if (!normalizedId || !normalizedName || !normalizedEmail || !normalizedPhone) {
      setAddFormError("Staff ID, name, email, and phone are required.")
      return
    }

    if (!normalizedEmail.includes("@")) {
      setAddFormError("Please enter a valid email address.")
      return
    }

    if (newStaff.skills.length === 0) {
      setAddFormError("Select at least one skill.")
      return
    }

    try {
      setIsAddSubmitting(true)
      await createStaff({
        staffId: normalizedId,
        name: normalizedName,
        email: normalizedEmail,
        phone: normalizedPhone,
        skillLevel: newStaff.skillLevel,
        skills: newStaff.skills,
        performanceScore: levelToScore(newStaff.skillLevel),
        shiftStart: newStaff.shiftStart,
        shiftEnd: newStaff.shiftEnd,
      })

      setIsAddModalOpen(false)
      resetAddStaffForm()
      await fetchData()
      setSuccessMessage("Staff member added successfully.")
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err: any) {
      console.error("Error adding staff:", err)
      setAddFormError(err?.message || "Failed to create staff member")
    } finally {
      setIsAddSubmitting(false)
    }
  }

  const handleApplySmartOptimization = async () => {
    if (queueData.length === 0) {
      setPageError("No live counter data available to optimize")
      return
    }

    try {
      setApplyingSmartAllocation(true)
      setPageError(null)

      const counts: Record<string, number> = {}
      for (const counter of queueData) {
        counts[String(counter.counterId)] = Number(counter.queueSize || 0)
      }

      const dynamicStaff: Array<{
        id: string
        current_counter: string | null
        status: "active" | "available" | "break"
      }> = []

      for (const member of staffData) {
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

      await applyStaffAllocationState(recommendedAllocation)

      if (optimizeResponse?.success && optimizeResponse?.data) {
        setCounterOptimization(optimizeResponse.data)
      }

      await fetchData()
      setSuccessMessage("Smart optimization applied and persisted to staff allocation state.")
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err: any) {
      console.error("Error applying smart optimization:", err)
      setPageError(err.message || "Failed to apply smart optimization")
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

  const overloadedEntries = queueData
    .map((counter) => {
      const counterId = String(counter.counterId)
      const staffInfo = counterOptimization[counterId]
      const requiredStaff = Number(staffInfo?.required_staff ?? 0)
      const assignedStaff = Number(currentStaffByCounter[counterId] || 0)
      const effectiveStatus = requiredStaff > 0
        ? deriveStaffStatus(assignedStaff, requiredStaff)
        : (staffInfo?.status || "OK")
      return { counterId, effectiveStatus }
    })
    .filter((entry) => entry.effectiveStatus === "OVERLOADED")

  const topRecommendation =
    Object.entries(counterOptimization)
      .map(([counterId, info]) => ({ counterId, rec: info?.recommendation }))
      .find((entry) => entry.rec && entry.rec !== "No movement suggested")?.rec ||
    (overloadedEntries.length > 0
      ? `Add staff support to Counter ${overloadedEntries[0].counterId} immediately.`
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
        {successMessage && (
          <Alert className="mb-6 border-success/50 bg-success/5">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertTitle className="text-success">Success</AlertTitle>
            <AlertDescription className="text-success/80">{successMessage}</AlertDescription>
          </Alert>
        )}

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
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-foreground mb-0">Staff Optimization by Counter</h3>
              <Button
                onClick={handleApplySmartOptimization}
                disabled={counterOptimizationLoading || applyingSmartAllocation || queueData.length === 0}
                className="font-semibold"
              >
                {applyingSmartAllocation ? "Applying..." : "Apply Optimization"}
              </Button>
            </div>
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
                  const requiredStaff = Number(staffInfo?.required_staff ?? 0)
                  const assignedNames = staffData
                    .filter((member: any) => String(member.currentCounter ?? "") === counterId)
                    .map((member: any) => String(member.name || member.staffId || member.id || member._id || ""))
                    .filter(Boolean)
                  const effectiveStatus = requiredStaff > 0
                    ? deriveStaffStatus(currentAssigned, requiredStaff)
                    : (staffInfo?.status || "OK")
                  const effectiveAction = deriveStaffAction(effectiveStatus)
                  const styles = getStatusStyles(effectiveStatus)

                  return (
                    <div key={`staff-opt-${counterId}`} className={`rounded-xl border p-5 ${styles.card}`}>
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
                          <span className="font-semibold text-foreground">{currentAssigned}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Required staff</span>
                          <span className="font-semibold text-foreground">{staffInfo?.required_staff ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Action</span>
                          <span className="font-semibold text-foreground">{effectiveAction}</span>
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
                          {assignedNames.length > 0 ? assignedNames.join(", ") : "No staff currently assigned"}
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

        {isAddModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            onClick={() => {
              if (!isAddSubmitting) {
                setIsAddModalOpen(false)
              }
            }}
          >
            <div
              className="w-full max-w-2xl rounded-2xl border border-border/60 bg-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border/50 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Add Staff Member</h3>
                    <p className="text-sm text-muted-foreground">Create a new team profile for allocation and scheduling.</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isAddSubmitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleSubmitAddStaff} className="space-y-5 p-5">
                {addFormError && (
                  <Alert className="border-destructive/50 bg-destructive/5">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-destructive/90">{addFormError}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="staff-id">Staff ID</Label>
                    <Input
                      id="staff-id"
                      value={newStaff.staffId}
                      onChange={(e) => setNewStaff((prev) => ({ ...prev, staffId: e.target.value }))}
                      placeholder="S004"
                      disabled={isAddSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-name">Full Name</Label>
                    <Input
                      id="staff-name"
                      value={newStaff.name}
                      onChange={(e) => setNewStaff((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="John Doe"
                      disabled={isAddSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-email">Email</Label>
                    <Input
                      id="staff-email"
                      type="email"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="john@company.com"
                      disabled={isAddSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-phone">Phone</Label>
                    <Input
                      id="staff-phone"
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91 9876543210"
                      disabled={isAddSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="staff-level">Skill Level</Label>
                  <select
                    id="staff-level"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={newStaff.skillLevel}
                    onChange={(e) => setNewStaff((prev) => ({ ...prev, skillLevel: e.target.value as SkillLevel }))}
                    disabled={isAddSubmitting}
                  >
                    {SKILL_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Skills</Label>
                  <div className="flex flex-wrap gap-2 rounded-md border border-border/60 bg-muted/30 p-3">
                    {SKILL_OPTIONS.map((skill) => {
                      const selected = newStaff.skills.includes(skill)
                      return (
                        <Button
                          key={skill}
                          type="button"
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          onClick={() => toggleSkill(skill)}
                          disabled={isAddSubmitting}
                          className="capitalize"
                        >
                          {skill}
                        </Button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="shift-start">Shift Start</Label>
                    <Input
                      id="shift-start"
                      type="time"
                      value={newStaff.shiftStart}
                      onChange={(e) => setNewStaff((prev) => ({ ...prev, shiftStart: e.target.value }))}
                      disabled={isAddSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shift-end">Shift End</Label>
                    <Input
                      id="shift-end"
                      type="time"
                      value={newStaff.shiftEnd}
                      onChange={(e) => setNewStaff((prev) => ({ ...prev, shiftEnd: e.target.value }))}
                      disabled={isAddSubmitting}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-border/50 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={isAddSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isAddSubmitting} className="min-w-28">
                    {isAddSubmitting ? "Saving..." : "Add Staff"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
