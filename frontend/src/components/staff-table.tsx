import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Trash2, UserPlus } from "lucide-react"

interface StaffTableProps {
    staffData: any[]
    loading: boolean
    onEdit: (staff: any) => void
    onDelete: (id: string) => void
    onAdd: () => void
}

export function StaffTable({ staffData, loading, onEdit, onDelete, onAdd }: StaffTableProps) {
    const getSkillLevel = (staff: any) => {
        if (staff.skillLevel) return staff.skillLevel
        const score = Number(staff.performanceScore ?? 0)
        if (score >= 90) return "advanced"
        if (score >= 70) return "intermediate"
        return "basic"
    }

    const getHourlyRate = (staff: any) => {
        if (staff.hourlyRate) return staff.hourlyRate
        const level = getSkillLevel(staff)
        if (level === "advanced") return 22
        if (level === "intermediate") return 18
        return 14
    }

    const getStatusBadge = (staff: any) => {
        if (staff.availability === "busy") {
            const hasCounter = staff.currentCounter !== null && staff.currentCounter !== undefined
            return (
                <Badge variant="outline" className="bg-chart-1/10 text-chart-1 border-chart-1/20">
                    {hasCounter ? `Busy - Counter ${staff.currentCounter}` : "Busy"}
                </Badge>
            )
        }

        if (staff.availability === "available") {
            return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Available</Badge>
        }

        if (staff.availability === "offline") {
            return <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Offline</Badge>
        }

        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">On Break</Badge>
    }

    return (
        <div className="rounded-lg border border-border/50 bg-card">
            <div className="p-4 flex justify-between items-center bg-muted/50 border-b border-border/50">
                <div>
                    <h3 className="font-semibold text-foreground">Staff List</h3>
                    <p className="text-sm text-muted-foreground">Manage your team members</p>
                </div>
                <Button onClick={onAdd} size="sm" className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add Staff
                </Button>
            </div>
            
            {loading ? (
                <div className="p-8 text-center text-muted-foreground">
                    Loading staff data...
                </div>
            ) : staffData.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                    No staff members found. Click "Add Staff" to get started.
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Skill Level</TableHead>
                            <TableHead>Skills</TableHead>
                            <TableHead>Hourly Rate</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {staffData.map((staff) => (
                            <TableRow key={staff.staffId || staff._id || staff.id}>
                                <TableCell className="font-medium">{staff.name}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {getSkillLevel(staff)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {staff.skills?.slice(0, 2).map((skill: string, idx: number) => (
                                            <Badge key={idx} variant="secondary" className="text-xs">
                                                {skill}
                                            </Badge>
                                        ))}
                                        {staff.skills?.length > 2 && (
                                            <Badge variant="secondary" className="text-xs">
                                                +{staff.skills.length - 2}
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>${getHourlyRate(staff)}/hr</TableCell>
                                <TableCell>{getStatusBadge(staff)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => onEdit(staff)}
                                            className="gap-1"
                                        >
                                            <Edit className="h-3 w-3" />
                                            Edit
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => onDelete(staff.staffId || staff._id || staff.id)}
                                            className="gap-1 text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Delete
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    )
}
