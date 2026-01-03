"use client"

import { SchoolFilter } from "@/components/school-filter"
import { Card, CardContent } from "@/components/ui/card"
import { Grid, List, RefreshCw, MapPin, Users, Phone, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
// Use plain <img> in this client page to avoid Next/Image runtime issues
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type UISchool = {
  id: string | number
  name: string
  location?: string | null
  type?: string | null
  size?: string | null
  description?: string | null
  logo?: string | null
  students?: number | null
  phone?: string | null
  email?: string | null
  address?: string | null
}

export default function SchoolsPage() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [filters, setFilters] = useState({
    type: "All types",
    location: "All locations",
    size: "All",
  })

  const [schools, setSchools] = useState<UISchool[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchStatus, setFetchStatus] = useState<string | null>(null)

  const typeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of schools) if (s.type) set.add(s.type)
    return Array.from(set)
  }, [schools])
  const locationOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of schools) if (s.location) set.add(s.location)
    return Array.from(set)
  }, [schools])

  const sizeBucket = (count?: number | null) => {
    if (count == null) return null
    if (count < 500) return "Small (< 500)"
    if (count <= 1500) return "Medium (500-1500)"
    return "Large (> 1500)"
  }

  useEffect(() => {
    const load = async () => {
      // enforce a client-side timeout so the UI doesn't hang indefinitely
      const controller = new AbortController()
      const timeoutMs = 8000
      const id = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/schools`
        console.log("Fetching schools from:", url)
        const res = await fetch(url, { cache: "no-store", signal: controller.signal })
        clearTimeout(id)
        console.log("Schools fetch status:", res.status, res.statusText)
        setFetchStatus(`${res.status} ${res.statusText}`)
        const data = await res.json().catch((e) => {
          console.log("Failed to parse /api/schools JSON", e)
          setFetchError(String(e))
          return null
        })
        if (!res.ok) {
          console.log("/api/schools returned error", data)
          setFetchError(data?.error ? String(data.error) : `HTTP ${res.status}`)
        }
        const mapped: UISchool[] = (Array.isArray(data) ? data : []).map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          logo: s.logo_url,
          students: s.student_count ?? null,
          phone: s.phone,
          email: s.email,
          address: [s.address_line1, s.address_line2].filter(Boolean).join(", "),
          location: [s.city, s.state, s.country].filter(Boolean).join(", "),
          type: s.accreditation || null,
          size: null,
        }))
        setSchools(mapped)
      } catch (e: any) {
        clearTimeout(id)
        console.log("Failed to load schools", e)
        if (e?.name === 'AbortError') {
          setFetchError(`Request timed out after ${timeoutMs}ms`)
        } else {
          setFetchError(String(e))
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      if (filters.type !== "All types" && school.type !== filters.type) return false
      if (filters.location !== "All locations" && school.location !== filters.location) return false
      if (filters.size !== "All" && sizeBucket(school.students) !== filters.size) return false
      return true
    })
  }, [filters, schools])

  const handleLearnMore = (schoolId: string | number) => {
    router.push(`/schools/${schoolId}`)
  }

  const handleContact = (school: any) => {
    // Open contact modal or navigate to contact page
    window.open(`mailto:${school.email}`, "_blank")
  }

  const handleRefresh = () => {
    setFilters({
      type: "All types",
      location: "All locations",
      size: "All",
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
     

      {/* Breadcrumb */}
      <div className="bg-gray-800 text-white px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <nav className="text-sm">
            <span className="text-gray-300">Home</span>
            <span className="mx-2">/</span>
            <span className="text-gray-300">Schools</span>
            <span className="mx-2">/</span>
            <span>All category</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <p className="text-blue-600 font-medium">Showing on this page: {filteredSchools.length}</p>
          <div className="flex items-center gap-2">
            <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")}>
              <Grid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Filter */}
          <div className="lg:col-span-1">
            <SchoolFilter onFilterChange={setFilters} types={typeOptions} locations={locationOptions} sizes={["Small (< 500)", "Medium (500-1500)", "Large (> 1500)"]} />
          </div>

          {/* Schools Grid */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="text-center py-12 text-gray-500">
                <div>Loading...</div>
                {fetchStatus && <div className="mt-2 text-sm">Status: {fetchStatus}</div>}
                {fetchError && <div className="mt-2 text-sm text-red-600">Error: {fetchError}</div>}
              </div>
            ) : filteredSchools.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No results found</p>
                <Button onClick={handleRefresh} className="mt-4">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-6"}>
                {filteredSchools.map((school) => (
                  <Card key={school.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className={viewMode === "grid" ? "space-y-4" : "grid grid-cols-1 md:grid-cols-4 gap-6"}>
                        <div
                          className={viewMode === "grid" ? "flex justify-center" : "md:col-span-1 flex justify-center"}
                        >
                          <img
                            src={String(school.logo || "/placeholder.svg")}
                            alt={school.name}
                            width={200}
                            height={150}
                            className="w-full max-w-[200px] h-auto object-contain"
                          />
                        </div>
                        <div className={viewMode === "grid" ? "space-y-4" : "md:col-span-3 space-y-4"}>
                          <div>
                            <h3 className="text-xl font-bold text-blue-600 mb-1">{school.name}</h3>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {school.type && <Badge variant="secondary">{school.type}</Badge>}
                              <Badge variant="outline" className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {school.location}
                              </Badge>
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {school.students} students
                              </Badge>
                            </div>
                          </div>

                          <p className="text-gray-700 text-sm leading-relaxed">{school.description}</p>

                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{school.address}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              <span>{school.phone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              <span>{school.email}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button
                              className="bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-600 hover:to-purple-700"
                              onClick={() => handleLearnMore(school.id)}
                            >
                              Learn More
                            </Button>
                            <Button variant="outline" onClick={() => handleContact(school)}>
                              Contact
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
