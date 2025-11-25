"use client"

import { useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { ActionDropdown } from "@/components/ui/action-dropdown"
import { Plus } from "lucide-react"
import { mockAssignments } from "@/lib/mock-data"
import { Protect } from "@clerk/nextjs"

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState(mockAssignments)

  const handleView = (id: number) => {
    // view assignment: id
  }

  const handleEdit = (id: number) => {
    // edit assignment: id
  }

  const handleDelete = (id: number) => {
    setAssignments(assignments.filter((assignment) => assignment.id !== id))
  }

  return (
    <Protect
    role="admin"
    fallback={<p>Access denied</p>}
    >
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Assignments</h1>
            <p className="text-muted-foreground">Manage all assignments across batches</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Assignment
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ASSIGNMENTS</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={assignments} searchFields={["title", "batch", "course", "trainer"]} title="Assignments">
              {(paginatedAssignments) => (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">#</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Title</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Batch</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Course</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Due Date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Submissions</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Max Score</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAssignments.map((assignment, index) => (
                        <tr key={assignment.id} className="border-b hover:bg-gray-50">
                          <td className="py-4 px-4">{index + 1}</td>
                          <td className="py-4 px-4 font-medium">{assignment.title}</td>
                          <td className="py-4 px-4">{assignment.batch}</td>
                          <td className="py-4 px-4">{assignment.course}</td>
                          <td className="py-4 px-4">{assignment.dueDate}</td>
                          <td className="py-4 px-4">{assignment.submissions}</td>
                          <td className="py-4 px-4">{assignment.maxScore}</td>
                          <td className="py-4 px-4">
                            <Badge variant={assignment.status === "active" ? "default" : "secondary"}>
                              {assignment.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <ActionDropdown
                              onView={() => handleView(assignment.id)}
                              onEdit={() => handleEdit(assignment.id)}
                              onDelete={() => handleDelete(assignment.id)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DataTable>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
    </Protect>
  )
}
