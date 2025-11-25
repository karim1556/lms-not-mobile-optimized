"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DataTable } from "@/components/ui/data-table"
import { ActionDropdown } from "@/components/ui/action-dropdown"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Protect } from "@clerk/nextjs"

export default function StudentsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [students, setStudents] = useState<Array<{
    id: string
    name: string
    email?: string | null
    phone?: string | null
    photo?: string | null
  }>>([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/students", { cache: "no-store" })
        const rows = await res.json()
        if (Array.isArray(rows)) {
          const mapped = rows.map((r: any) => ({
            id: r.id,
            name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Student",
            email: r.email ?? null,
            phone: r.phone ?? null,
            photo: r.image_url ?? null,
          }))
          setStudents(mapped)
        }
      } catch (_) {}
    }
    load()
  }, [])

  const handleView = (id: string) => {
    // view student: id
  }

  const handleEdit = (id: string) => {
    router.push(`/admin/students/${id}/edit`)
  }

  const handleDelete = async (id: string) => {
    const ok = typeof window !== 'undefined' ? window.confirm('Are you sure you want to delete this student?') : true
    if (!ok) return
    try {
      const res = await fetch(`/api/students?id=${id}`, { method: 'DELETE' })
      let data: any = null
      try { data = await res.json() } catch (_) {}
      if (!res.ok) {
        const msg = data?.error || data?.message || (await res.text().catch(() => 'Failed to delete'))
        throw new Error(`${res.status} ${res.statusText}: ${msg}`)
      }
      setStudents((prev) => prev.filter((s) => s.id !== id))
      toast({ title: 'Student deleted' })
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || String(e) || 'Failed to delete student', variant: 'destructive' })
    }
  }

  return (
    <Protect role="admin" fallback={<p>Access denied</p>}>
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Student</h1>
          </div>
          <Button asChild>
            <Link href="/admin/students/add">
              <Plus className="h-4 w-4 mr-2" />
              Add student
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>STUDENT</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={students} searchFields={["name", "email", "phone"]} title="Students">
              {(paginatedStudents) => (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">#</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Photo</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Phone</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedStudents.map((student: any, index: number) => (
                        <tr key={student.id} className="border-b hover:bg-gray-50">
                          <td className="py-4 px-4">{index + 1}</td>
                          <td className="py-4 px-4">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={student.photo || "/placeholder.svg"} />
                              <AvatarFallback>{(student.name?.charAt(0) || 'S').toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-medium">{student.name}</div>
                          </td>
                          <td className="py-4 px-4">{student.email}</td>
                          <td className="py-4 px-4">{student.phone || '—'}</td>
                          <td className="py-4 px-4">
                            <ActionDropdown
                              onView={() => handleView(student.id)}
                              onEdit={() => handleEdit(student.id)}
                              onDelete={() => handleDelete(student.id)}
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
