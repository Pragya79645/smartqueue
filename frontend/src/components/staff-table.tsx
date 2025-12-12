import { Button } from "@/components/ui/button"

interface StaffTableProps {
    onEdit: (staff: any) => void
    onDelete: (id: string) => void
    onAdd: () => void
}

export function StaffTable({ onEdit, onDelete, onAdd }: StaffTableProps) {
    // Mock data
    const staffMembers = [
        { id: "1", name: "Alice Johnson", role: "Manager", status: "Active" },
        { id: "2", name: "Bob Smith", role: "Clerk", status: "Busy" },
    ]

    return (
        <div className="rounded-md border">
            <div className="p-4 flex justify-between items-center bg-muted/50">
                <h3 className="font-semibold">Staff List</h3>
                <Button onClick={onAdd} size="sm">Add Staff</Button>
            </div>
            <div className="p-4">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left font-medium p-2">Name</th>
                            <th className="text-left font-medium p-2">Role</th>
                            <th className="text-left font-medium p-2">Status</th>
                            <th className="text-right font-medium p-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staffMembers.map((staff) => (
                            <tr key={staff.id} className="border-b last:border-0 hover:bg-muted/50">
                                <td className="p-2">{staff.name}</td>
                                <td className="p-2">{staff.role}</td>
                                <td className="p-2">{staff.status}</td>
                                <td className="p-2 text-right space-x-2">
                                    <Button variant="ghost" size="sm" onClick={() => onEdit(staff)}>Edit</Button>
                                    <Button variant="destructive" size="sm" onClick={() => onDelete(staff.id)}>Delete</Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
