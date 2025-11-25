"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DataTable } from "@/components/ui/data-table"
import { ActionDropdown } from "@/components/ui/action-dropdown"
import { Calendar } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Protect } from "@clerk/nextjs"

export default function EnrolHistoryPage() {
  const { toast } = useToast()
  const [enrollmentHistory, setEnrollmentHistory] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/enrolments', { cache: 'no-store' })
        const rows = await res.json()
        setEnrollmentHistory(Array.isArray(rows) ? rows : [])
      } catch (_) {}
    }
    load()
  }, [])

  const handleDelete = async (id: string) => {
    const ok = typeof window !== 'undefined' ? window.confirm('Delete this enrolment?') : true
    if (!ok) return
    try {
      const res = await fetch(`/api/enrolments?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setEnrollmentHistory(prev => prev.filter(e => e.id !== id))
      toast({ title: 'Enrolment deleted' })
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleView = (id: string) => {
    // view enrolment: id
  }

  return (
    <Protect
    role="admin"
    fallback={<p>Access denied</p>}
    >
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Enrol history</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ENROL HISTORIES</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">July 01, 2025 - July 31, 2025</span>
              </div>
              <Button className="bg-blue-500 hover:bg-blue-600">Filter</Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              data={enrollmentHistory}
              searchFields={["first_name", "last_name", "email", "course_title"]}
              title="Enrollment History"
            >
              {(paginatedHistory) => (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Photo</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">User name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Enrolled course</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Enrolment date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHistory.map((enrollment: any) => (
                        <tr key={enrollment.id} className="border-b hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={"/placeholder.svg"} />
                              <AvatarFallback>{(enrollment.first_name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              <div className="font-medium">{`${enrollment.first_name ?? ''} ${enrollment.last_name ?? ''}`.trim()}</div>
                              <div className="text-sm text-gray-500">{enrollment.email}</div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-blue-600">{enrollment.course_title || enrollment.course_id}</span>
                          </td>
                          <td className="py-4 px-4 text-gray-600">{new Date(enrollment.created_at).toLocaleString()}</td>
                          <td className="py-4 px-4">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                (enrollment.status || 'active') === "active"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {enrollment.status || 'active'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <ActionDropdown
                              onView={() => handleView(enrollment.id)}
                              onDelete={() => handleDelete(enrollment.id)}
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
