"use client"

import { useEffect, useMemo, useState } from "react"
import { RoleLayout } from "@/components/layout/role-layout"
import { TrainerSidebar } from "@/components/layout/trainer-sidebar"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { OrganizationSwitcher, useAuth, useOrganization, useUser } from "@clerk/nextjs"
import { ChevronDown, ChevronUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function TrainerBatchesPage() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth()
  const { organization, isLoaded: orgLoaded } = useOrganization()
  const { user, isLoaded: userLoaded } = useUser()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const [batches, setBatches] = useState<any[]>([])
  const [trainers, setTrainers] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)

  // Sync & load
  useEffect(() => {
    if (!authLoaded || !orgLoaded || !userLoaded) return
    if (!isSignedIn || !organization?.id) return
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        try { await fetch('/api/sync/me', { method: 'POST', cache: 'no-store' }) } catch {}
        const schoolRes = await fetch('/api/me/school', { cache: 'no-store' })
        if (!schoolRes.ok) throw new Error('Failed to resolve school')
        const sch = await schoolRes.json()
        const sid = sch?.schoolId
        if (!sid) throw new Error('No school linked to this organization')
        if (!active) return
        setSchoolId(sid)
        setSchoolName(sch?.name ?? null)

        const [bRes, tRes, sRes] = await Promise.all([
          fetch(`/api/batches?schoolId=${encodeURIComponent(sid)}`, { cache: 'no-store' }),
          fetch(`/api/trainers?schoolId=${encodeURIComponent(sid)}`, { cache: 'no-store' }),
          fetch(`/api/students?schoolId=${encodeURIComponent(sid)}`, { cache: 'no-store' }),
        ])
        if (!bRes.ok) throw new Error('Failed to load batches')
        if (!tRes.ok) throw new Error('Failed to load trainers')
        if (!sRes.ok) throw new Error('Failed to load students')
        const [bjson, tjson, sjson] = await Promise.all([bRes.json(), tRes.json(), sRes.json()])
        if (!active) return
        setBatches(Array.isArray(bjson) ? bjson : [])
        setTrainers(Array.isArray(tjson) ? tjson : [])
        setStudents(Array.isArray(sjson) ? sjson : [])
      } catch (e:any) {
        if (!active) return
        setError(e?.message || 'Failed to load')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [authLoaded, orgLoaded, userLoaded, isSignedIn, organization?.id])

  const myTrainer = useMemo(() => {
    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase()
    if (!email) return null
    return trainers.find((t:any) => (t.email || '').toLowerCase() === email) || null
  }, [trainers, user?.primaryEmailAddress?.emailAddress])

  const myTrainerId = myTrainer?.id as string | undefined
  const myBatches = useMemo(() => {
    if (!myTrainerId) return [] as any[]
    return batches.filter((b:any) => {
      const ids = b.trainer_ids ? String(b.trainer_ids).split(',').filter(Boolean) : []
      return ids.includes(myTrainerId)
    })
  }, [batches, myTrainerId])

  // Get students for a specific batch
  const getStudentsForBatch = (batch: any) => {
    const studentIds = batch.student_ids ? String(batch.student_ids).split(',').filter(Boolean) : []
    return students.filter((s: any) => studentIds.includes(s.id))
  }

  const toggleBatchExpansion = (batchId: string) => {
    setExpandedBatchId(expandedBatchId === batchId ? null : batchId)
  }

  const schoolDisplay = schoolName && schoolName !== 'Unnamed School' ? schoolName : (organization?.name || (schoolId ?? null))

  if (!authLoaded || !orgLoaded || !userLoaded) {
    return (
      <RoleLayout title="Aiskool LMS" subtitle="Trainer Batches" Sidebar={TrainerSidebar}>
        <div className="p-6">Loading...</div>
      </RoleLayout>
    )
  }
  if (!isSignedIn) {
    return (
      <RoleLayout title="Aiskool LMS" subtitle="Trainer Batches" Sidebar={TrainerSidebar}>
        <div className="p-6">Please sign in to continue.</div>
      </RoleLayout>
    )
  }
  if (!organization) {
    return (
      <RoleLayout title="Aiskool LMS" subtitle="Trainer Batches" Sidebar={TrainerSidebar}>
        <div className="p-6">
          <p className="mb-3">Please select an organization to continue.</p>
          <OrganizationSwitcher />
        </div>
      </RoleLayout>
    )
  }

  return (
    <RoleLayout title="Aiskool LMS" subtitle="Trainer Batches" Sidebar={TrainerSidebar}>
      <Card>
        <CardHeader>
          <CardTitle>My Batches</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : error ? error : schoolDisplay ? `School: ${schoolDisplay}` : 'No school linked'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Students</th>
                    <th className="text-left py-3 px-4">Trainers</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myBatches.length === 0 && (
                    <tr><td className="py-3 px-4 text-sm text-muted-foreground" colSpan={5}>No batches assigned</td></tr>
                  )}
                  {myBatches.map((b:any) => {
                    const batchStudents = getStudentsForBatch(b)
                    const isExpanded = expandedBatchId === b.id
                    return (
                      <>
                        <tr key={b.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{b.name}</td>
                          <td className="py-3 px-4">{b.student_count || 0}</td>
                          <td className="py-3 px-4">{b.trainer_count || 0}</td>
                          <td className="py-3 px-4 capitalize">{b.status || 'pending'}</td>
                          <td className="py-3 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleBatchExpansion(b.id)}
                              className="flex items-center gap-1"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              {isExpanded ? 'Hide' : 'View'} Students
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${b.id}-students`} className="bg-gray-50">
                            <td colSpan={5} className="py-4 px-4">
                              <div className="ml-8">
                                <div className="flex items-center gap-2 mb-3">
                                  <Users className="h-5 w-5 text-gray-600" />
                                  <h4 className="font-semibold text-gray-700">Students in {b.name}</h4>
                                </div>
                                {batchStudents.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No students enrolled in this batch yet.</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full border rounded-lg">
                                      <thead className="bg-white">
                                        <tr className="border-b">
                                          <th className="text-left py-2 px-3 text-sm font-medium">Name</th>
                                          <th className="text-left py-2 px-3 text-sm font-medium">Email</th>
                                          <th className="text-left py-2 px-3 text-sm font-medium">Phone</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white">
                                        {batchStudents.map((student: any) => (
                                          <tr key={student.id} className="border-b last:border-0">
                                            <td className="py-2 px-3 text-sm">
                                              {`${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unnamed'}
                                            </td>
                                            <td className="py-2 px-3 text-sm">{student.email || '-'}</td>
                                            <td className="py-2 px-3 text-sm">{student.phone || '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </RoleLayout>
  )
}
