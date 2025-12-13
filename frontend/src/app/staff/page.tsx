"use client"

import { useEffect, useState } from "react"
import { StaffTable } from "@/components/staff-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, BarChart3, Settings, Users, Bell, Download, Upload } from "lucide-react"
import Link from "next/link"
import { getStaffList, getAvailableStaffCount } from "@/api/staffApi"

export default function StaffPage() {
  const [staffData, setStaffData] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, available: 0, onBreak: 0, busy: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [staffResponse, availableResponse] = await Promise.all([
          getStaffList(),
          getAvailableStaffCount()
        ])
        
        if (staffResponse.success) {
          const staff = staffResponse.staff || []
          setStaffData(staff)
          
          // Calculate stats
          const available = staff.filter((s: any) => s.isAvailable).length
          const busy = staff.filter((s: any) => s.currentCounter).length
          const onBreak = staff.length - available - busy
          
          setStats({
            total: staff.length,
            available,
            onBreak: Math.max(0, onBreak),
            busy
          })
        }
      } catch (err: any) {
        console.error("Error fetching staff data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const handleEdit = (staff: any) => {
    console.log("Edit staff:", staff)
    // TODO: Open edit modal/form
  }

  const handleDelete = (id: string) => {
    console.log("Delete staff:", id)
    // TODO: Show confirmation and delete
  }

  const handleAdd = () => {
    console.log("Add new staff")
    // TODO: Open add modal/form
  }

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
