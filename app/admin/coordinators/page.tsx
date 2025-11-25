"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DataTable } from "@/components/ui/data-table"
import { ActionDropdown } from "@/components/ui/action-dropdown"
import { Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Protect } from "@clerk/nextjs"

export default function CoordinatorsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [coordinators, setCoordinators] = useState<Array<{
    id: string
    name: string
    email?: string | null
    phone?: string | null
    institute?: string | null
    gender?: string | null
    dob?: string | null
    photo?: string | null
  }>>([])
  const [schoolNameById, setSchoolNameById] = useState<Record<string, string>>({})

  useEffect(() => {
    const load = async () => {
      try {
        const [coordRes, schoolsRes] = await Promise.all([
          fetch("/api/coordinators", { cache: "no-store" }),
          fetch("/api/schools", { cache: "no-store" }),
        ])
        const [rows, schools] = await Promise.all([coordRes.json(), schoolsRes.json()])
        if (Array.isArray(schools)) {
          const map: Record<string, string> = {}
          for (const s of schools) {
            if (s?.id) map[s.id] = s.name ?? s.id
          }
          setSchoolNameById(map)
        }
        if (Array.isArray(rows)) {
          const mapped = rows.map((r: any) => ({
            id: r.id,
            name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Coordinator",
            email: r.email ?? null,
            phone: r.phone ?? null,
            institute: r.school_id ?? null,
            gender: r.gender ?? null,
            dob: r.dob ? String(r.dob).slice(0, 10) : null,
            photo: r.image_url ?? null,
          }))
          setCoordinators(mapped)
        }
      } catch (e) {
        // ignore for now
      }
    }
    load()
  }, [/* re-run once on mount; schoolNameById not needed here */])

  const handleView = (id: string) => {
    // view coordinator: id
  }

  const handleDelete = async (id: string) => {
    const ok = typeof window !== 'undefined' ? window.confirm('Are you sure you want to delete this coordinator?') : true
    if (!ok) return
    try {
      const res = await fetch(`/api/coordinators?id=${id}`, { method: 'DELETE' })
      let data: any = null
      try { data = await res.json() } catch (_) {}
      if (!res.ok) {
        const msg = data?.error || data?.message || (await res.text().catch(() => 'Failed to delete'))
        throw new Error(`${res.status} ${res.statusText}: ${msg}`)
      }
      setCoordinators((prev) => prev.filter((c) => c.id !== id))
      toast({ title: 'Coordinator deleted' })
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || String(e) || 'Failed to delete coordinator', variant: 'destructive' })
    }
  }

  const handleEdit = (id: string) => {
    router.push(`/admin/coordinators/${id}/edit`)
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
            <h1 className="text-3xl font-bold">Coordinator</h1>
          </div>
          <Button asChild>
            <Link href="/admin/coordinators/add">
              <Plus className="h-4 w-4 mr-2" />
              Add Coordinator
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>COORDINATOR</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={coordinators} searchFields={["name", "email", "phone", "institute"]} title="Coordinators">
              {(paginatedCoordinators) => (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">#</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Photo</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Gender</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">DOB</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Phone</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Institute</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCoordinators.map((coordinator: any, index: number) => (
                        <tr key={coordinator.id} className="border-b hover:bg-gray-50">
                          <td className="py-4 px-4">{index + 1}</td>
                          <td className="py-4 px-4">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={coordinator.photo || "/placeholder.svg"} />
                              <AvatarFallback>{(coordinator.name?.charAt(0) || "C").toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </td>
                          <td className="py-4 px-4 font-medium">{coordinator.name}</td>
                          <td className="py-4 px-4">{coordinator.gender || "—"}</td>
                          <td className="py-4 px-4">{coordinator.dob || "—"}</td>
                          <td className="py-4 px-4">{coordinator.phone}</td>
                          <td className="py-4 px-4">{coordinator.email}</td>
                          <td className="py-4 px-4">{schoolNameById[coordinator.institute as string] || coordinator.institute || "—"}</td>
                          <td className="py-4 px-4">
                            <ActionDropdown
                              onView={() => handleView(coordinator.id)}
                              onEdit={() => handleEdit(coordinator.id)}
                              onDelete={() => handleDelete(coordinator.id)}
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

