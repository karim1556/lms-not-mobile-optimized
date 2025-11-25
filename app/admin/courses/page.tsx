"use client"

import { useState, useMemo, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { CourseStats } from "@/components/courses/course-stats"
import { CourseFilters } from "@/components/courses/course-filters"
import { DataTable } from "@/components/ui/data-table"
import { ActionDropdown } from "@/components/ui/action-dropdown"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { Protect } from "@clerk/nextjs"

export default function CoursesPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<any[]>([])
  const [filters, setFilters] = useState({
    category: "all",
    status: "all",
    instructor: "all",
    price: "all",
    levelId: "all" as string | "all",
  })

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        if (filters.levelId && filters.levelId !== 'all') {
          const res = await fetch(`/api/levels/${filters.levelId}/courses`)
          const data = await res.json()
          setCourses(Array.isArray(data) ? data : [])
        } else {
          const res = await fetch("/api/courses")
          const data = await res.json()
          setCourses(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error("Error fetching courses:", error)
        setCourses([])
      }
    }
    fetchCourses()
  }, [filters.levelId])

  // Calculate stats
  const stats = useMemo(
    () => {
      if (!Array.isArray(courses)) return { active: 0, pending: 0, free: 0, paid: 0 }
      
      return {
        active: courses.filter((c) => c.status === "Active").length,
        pending: courses.filter((c) => c.status === "Pending").length,
        free: courses.filter((c) => c.is_free).length,
        paid: courses.filter((c) => !c.is_free).length,
      }
    },
    [courses],
  )

  // Filter courses based on selected filters
  const filteredCourses = useMemo(() => {
    if (!Array.isArray(courses)) return []
    
    return courses.filter((course) => {
      if (filters.category !== "all" && course.category.toLowerCase() !== filters.category) return false
      if (filters.price !== "all") {
        if (filters.price === "free" && !course.is_free) return false
        if (filters.price === "paid" && course.is_free) return false
      }
      return true
    })
  }, [courses, filters])

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleApplyFilters = () => {
    // filters applied
  }

  const handleAction = async (action: string, course: any) => {
    switch (action) {
      case "view":
        window.open(`/courses/${course.id}`, "_blank")
        break
      case "edit":
        router.push(`/admin/courses/${course.id}/edit`)
        break
      case "sections":
        router.push(`/admin/courses/${course.id}/edit`)
        break
      case "delete":
        await fetch(`/api/courses/${course.id}`, { method: "DELETE" })
        setCourses(courses.filter((c) => c.id !== course.id))
        break
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
          <h1 className="text-3xl font-bold">📚 Courses</h1>
          <Button onClick={() => router.push("/admin/courses/add")} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add new course
          </Button>
        </div>

        <CourseStats stats={stats} />

        <CourseFilters filters={filters} onFilterChange={handleFilterChange} onApplyFilters={handleApplyFilters} />

        <DataTable data={filteredCourses} searchFields={["title", "provider"]} title="Course Management">
          {(paginatedData) => (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium">#</th>
                    <th className="text-left p-4 font-medium">Title</th>
                    <th className="text-left p-4 font-medium">Category</th>
                    <th className="text-left p-4 font-medium">Level</th>
                    <th className="text-left p-4 font-medium">Lesson and section</th>
                    <th className="text-left p-4 font-medium">Enrolled student</th>
                    <th className="text-left p-4 font-medium">Price</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((course, index) => (
                    <tr key={course.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">{index + 1}</td>
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-blue-600">{course.title}</div>
                          <div className="text-sm text-gray-500">Provider: {course.provider}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary">{course.category}</Badge>
                      </td>
                      <td className="p-4">
                        {course.level ? (
                          <Badge variant="outline">{course.level}</Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <div>Total section: N/A</div>
                          <div>Total lesson: {course.lessons}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">Total enrolment: {course.reviews}</div>
                      </td>
                      <td className="p-4 font-medium">{course.is_free ? "Free" : `₹${course.price}`}</td>
                      <td className="p-4">
                        <ActionDropdown
                          actions={[
                            { label: "View course on frontend", value: "view" },
                            { label: "Edit this course", value: "edit" },
                            { label: "Section and lesson", value: "sections" },
                            { label: "Delete", value: "delete", variant: "destructive" },
                          ]}
                          onAction={(action) => handleAction(action, course)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataTable>
      </div>
    </AdminLayout>
    </Protect>
  )
}
