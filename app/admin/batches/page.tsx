"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { ActionDropdown } from "@/components/ui/action-dropdown"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Protect } from "@clerk/nextjs"

export default function BatchesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [batches, setBatches] = useState<Array<{
    id: string
    name: string
    status?: string | null
    student_count?: number
    trainer_count?: number
    course_id?: string | null
  }>>([])
  const [courseMap, setCourseMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const load = async () => {
      try {
        const [bRes, cRes] = await Promise.all([
          fetch('/api/batches', { cache: 'no-store' }),
          fetch('/api/courses', { cache: 'no-store' }),
        ])
        const [bRows, cRows] = await Promise.all([bRes.json(), cRes.json()])
        if (Array.isArray(cRows)) {
          const map: Record<string, string> = {}
          for (const c of cRows) map[c.id] = c.title || c.name || c.id
          setCourseMap(map)
        }
        if (Array.isArray(bRows)) {
          setBatches(bRows)
        }
      } catch (_) {}
    }
    load()
  }, [])

  const handleView = (id: string) => {
    // view batch: id
  }

  const handleEdit = (id: string) => {
    router.push(`/admin/batches/${id}/edit`)
  }

  const handleDelete = async (id: string) => {
    const ok = typeof window !== 'undefined' ? window.confirm('Delete this batch?') : true
    if (!ok) return
    try {
      const res = await fetch(`/api/batches?id=${id}`, { method: 'DELETE' })
      let data: any = null
      try { data = await res.json() } catch (_) {}
      if (!res.ok) {
        const msg = data?.error || data?.message || (await res.text().catch(() => 'Failed to delete'))
        throw new Error(`${res.status} ${res.statusText}: ${msg}`)
      }
      setBatches(prev => prev.filter(b => b.id !== id))
      toast({ title: 'Batch deleted' })
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || String(e) || 'Failed to delete batch', variant: 'destructive' })
    }
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
            <h1 className="text-3xl font-bold">Batch</h1>
          </div>
          <Button asChild>
            <Link href="/admin/batches/add">
              <Plus className="h-4 w-4 mr-2" />
              Add Batch
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>BATCH</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={batches} searchFields={["name", "status"]} title="Batches">
              {(paginatedBatches) => (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">#</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Batch Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Trainers</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Course</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Students</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Schedule</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBatches.map((batch: any, index: number) => (
                        <tr key={batch.id} className="border-b hover:bg-gray-50">
                          <td className="py-4 px-4">{index + 1}</td>
                          <td className="py-4 px-4">{batch.name}</td>
                          <td className="py-4 px-4">{batch.trainer_count ?? 0}</td>
                          <td className="py-4 px-4">{batch.course_id ? (courseMap[batch.course_id] || batch.course_id) : '—'}</td>
                          <td className="py-4 px-4">
                            <span className="text-sm">{batch.student_count ?? 0}{batch.max_students ? `/${batch.max_students}` : ''}</span>
                          </td>
                          <td className="py-4 px-4">
                            <Badge
                              variant={
                                batch.status === "verified" ? "default" : batch.status === "pending" ? "secondary" : "outline"
                              }
                            >
                              {batch.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 max-w-xs">
                            <div className="text-sm text-gray-700 truncate" title={batch.schedule || ''}>
                              {batch.schedule ? batch.schedule : '—'}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <ActionDropdown
                              onView={() => handleView(batch.id)}
                              onEdit={() => handleEdit(batch.id)}
                              onDelete={() => handleDelete(batch.id)}
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
