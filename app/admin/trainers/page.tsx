"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function TrainersPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [trainers, setTrainers] = useState<Array<{
    id: string
    name: string
    email?: string | null
    phone?: string | null
    institute?: string | null
    gender?: string | null
    dob?: string | null
    photo?: string | null
    status?: string | null
  }>>([])
  const [schoolNameById, setSchoolNameById] = useState<Record<string, string>>({})
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("")

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const schoolsRes = await fetch("/api/schools", { cache: "no-store" })
        const schools = await schoolsRes.json()
        if (Array.isArray(schools)) {
          const map: Record<string, string> = {}
          for (const s of schools) {
            if (s?.id) map[s.id] = s.name ?? s.id
          }
          setSchoolNameById(map)
          setSchools(schools)
        }
      } catch (_) {}
    }
    loadInitial()
  }, [])

  // Load trainers when selectedSchoolId changes (or initial when not selected)
  useEffect(() => {
    const loadTrainers = async () => {
      try {
        const url = selectedSchoolId ? `/api/trainers?schoolId=${selectedSchoolId}` : `/api/trainers`
        const rowsRes = await fetch(url, { cache: "no-store" })
        const rows = await rowsRes.json()
        if (Array.isArray(rows)) {
          const mapped = rows.map((r: any) => ({
            id: r.id,
            name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Trainer",
            email: r.email ?? null,
            phone: r.phone ?? null,
            institute: r.school_id ?? null,
            gender: r.gender ?? null,
            dob: r.dob ? String(r.dob).slice(0, 10) : null,
            photo: r.image_url ?? null,
            status: r.status ?? null,
          }))
          setTrainers(mapped)
        } else {
          setTrainers([])
        }
      } catch (_) {
        setTrainers([])
      }
    }
    loadTrainers()
  }, [selectedSchoolId])

  const handleView = (id: string) => {
    // view trainer: id
  }

  const handleEdit = (id: string) => {
    router.push(`/admin/trainers/${id}/edit`)
  }

  const handleDelete = async (id: string) => {
    const ok = typeof window !== 'undefined' ? window.confirm('Are you sure you want to delete this trainer?') : true
    if (!ok) return
    try {
      const schoolParam = selectedSchoolId ? `&schoolId=${selectedSchoolId}` : ''
      const res = await fetch(`/api/trainers?id=${id}${schoolParam}`, { method: 'DELETE' })
      let data: any = null
      try { data = await res.json() } catch (_) {}
      if (!res.ok) {
        const msg = data?.error || data?.message || (await res.text().catch(() => 'Failed to delete'))
        throw new Error(`${res.status} ${res.statusText}: ${msg}`)
      }
      setTrainers((prev) => prev.filter((c) => c.id !== id))
      toast({ title: 'Trainer deleted' })
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || String(e) || 'Failed to delete trainer', variant: 'destructive' })
    }
  }

  return (
    <Protect role="admin" fallback={<p>Access denied</p>}>
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trainer</h1>
          </div>
          <Button asChild>
            <Link href={selectedSchoolId ? `/admin/trainers/add?schoolId=${selectedSchoolId}` : "/admin/trainers/add"}>
              <Plus className="h-4 w-4 mr-2" />
              Add Trainer
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>TRAINER</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-3">
              <div className="w-72">
                <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name || s.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DataTable data={trainers} searchFields={["name", "email", "phone", "institute"]} title="Trainers">
              {(paginatedTrainers) => (
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
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTrainers.map((trainer: any, index: number) => (
                        <tr key={trainer.id} className="border-b hover:bg-gray-50">
                          <td className="py-4 px-4">{index + 1}</td>
                          <td className="py-4 px-4">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={trainer.photo || "/placeholder.svg"} />
                              <AvatarFallback>{(trainer.name?.charAt(0) || 'T').toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </td>
                          <td className="py-4 px-4 font-medium">{trainer.name}</td>
                          <td className="py-4 px-4">{trainer.gender || "—"}</td>
                          <td className="py-4 px-4">{trainer.dob || "—"}</td>
                          <td className="py-4 px-4">{trainer.phone}</td>
                          <td className="py-4 px-4">{trainer.email}</td>
                          <td className="py-4 px-4">{schoolNameById[trainer.institute as string] || trainer.institute || "—"}</td>
                          <td className="py-4 px-4">{trainer.status || '—'}</td>
                          <td className="py-4 px-4">
                            <ActionDropdown
                              onView={() => handleView(trainer.id)}
                              onEdit={() => handleEdit(trainer.id)}
                              onDelete={() => handleDelete(trainer.id)}
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
