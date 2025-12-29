"use client"

import { useState, useEffect } from "react"
import Link from 'next/link'
import { useRouter, useParams } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { MultiStepForm } from "@/components/forms/multi-step-form"
import { courseTabs } from "@/lib/course-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, CheckCircle, Edit } from "lucide-react"
import { Protect } from "@clerk/nextjs"

export default function EditCoursePage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const [courseData, setCourseData] = useState<any>(null)

  useEffect(() => {
    const fetchCourse = async () => {
      if (courseId) {
        try {
          const res = await fetch(`/api/courses/${courseId}`)
          if (res.ok) {
            let data = await res.json()
            // If the basic course route returns null (course missing), try the details endpoint as a fallback
            if (!data) {
              console.warn(`Course ${courseId} not found at /api/courses. Trying /api/courses/${courseId}/details as fallback.`)
              try {
                const detailsRes = await fetch(`/api/courses/${courseId}/details`)
                if (detailsRes.ok) {
                  data = await detailsRes.json()
                }
              } catch (err) {
                console.warn('Fallback fetch to details endpoint failed:', err)
              }
            }

            const cleanData = {
              ...data,
              title: data.title || '',
              description: data.description || '',
              provider: data.provider || '',
              category: data.category || '',
              level: data.level || '',
              language: data.language || '',
              duration: data.duration || '',
              requirements: data.requirements || '',
              meta_keywords: data.meta_keywords || '',
              meta_description: data.meta_description || '',
              image: data.image || '',
              price: data.price || 0,
              original_price: data.original_price || 0,
              lessons: data.lessons || 0,
              rating: data.rating || 0,
              reviews: data.reviews || 0,
              students: data.students || 0,
              is_free: data.is_free || false
            }
            setCourseData(cleanData)
          }
        } catch (error) {
          console.error('Error fetching course:', error)
        }
      }
    }
    if (courseId) {
      fetchCourse()
    }
  }, [courseId])

  const handleInputChange = (field: string, value: any) => {
    setCourseData({ ...courseData, [field]: value })
  }

  const handleComplete = async () => {
    if (!courseData) return

    try {
      const formData = new FormData()
      Object.entries(courseData).forEach(([key, value]) => {
        // Skip fields that are not columns on the courses table
        if (key === 'curriculum') return;
        if (value === null || value === undefined) return;

        if (key === 'image') {
          if (value instanceof File) {
            formData.append(key, value);
          } else if (typeof value === 'string') {
            // Keep existing image path if no new file is selected
            formData.append(key, value);
          }
        } else if (Array.isArray(value)) {
          // Append each item of the array separately
          value.forEach(item => formData.append(`${key}[]`, item));
        } else {
          formData.append(key, String(value));
        }
      });

      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        body: formData,
      })

      if (res.ok) {
        router.push("/admin/courses")
      } else {
        const errorText = await res.text()
        console.error("Error updating course:", res.status, errorText)
      }
    } catch (error) {
      console.error("Error in handleComplete:", error)
    }
  }



  if (!courseData) {
    return (
      <Protect
      role="admin"
      fallback={<p>Access denied</p>}
      >
      <AdminLayout>
        <div>Loading...</div>
      </AdminLayout>
      </Protect>
    )
  }

  // Filter out the 'Curriculum' tab and map to the expected Step structure
  const formSteps = courseTabs
    .filter(tab => tab.id !== 'curriculum')
    .map(tab => ({ id: tab.id, title: tab.label, icon: tab.icon }));

  const stepContent = [
    <div key="basic" className="space-y-6">
      <h2 className="text-2xl font-bold">Basic Information</h2>
      <div className="space-y-2 mb-6 p-4 border-l-4 border-blue-500 bg-blue-50 rounded-md">
        <h3 className="font-semibold text-lg">Manage Course Content</h3>
        <p className="text-sm text-gray-600">Edit sections, lessons, quizzes, and videos on the dedicated content page.</p>
        <Link href={`/admin/courses/content?courseId=${courseId}`} passHref>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Go to Content Editor
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <Label htmlFor="title">Course Title *</Label>
          <Input id="title" value={courseData.title || ''} onChange={(e) => handleInputChange("title", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="provider">Provider</Label>
          <Input
            id="provider"
            value={courseData.provider || ''}
            onChange={(e) => handleInputChange("provider", e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Course Description *</Label>
        <Textarea
          id="description"
          value={courseData.description || ''}
          onChange={(e) => handleInputChange("description", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={courseData.category || ''}
            onChange={(e) => handleInputChange("category", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="language">Language</Label>
          <Select value={courseData.language || 'English'} onValueChange={(value) => handleInputChange("language", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Spanish">Spanish</SelectItem>
              <SelectItem value="French">French</SelectItem>
              <SelectItem value="German">German</SelectItem>
              <SelectItem value="Chinese">Chinese</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <Label htmlFor="level">Level</Label>
          <Select value={courseData.level || 'Beginner'} onValueChange={(value) => handleInputChange("level", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="duration">Duration</Label>
          <Input
            id="duration"
            value={courseData.duration || ''}
            onChange={(e) => handleInputChange("duration", e.target.value)}
            placeholder="e.g., 10 hours"
          />
        </div>
        <div>
          <Label htmlFor="duration_hours">Duration (Hours)</Label>
          <Input
            id="duration_hours"
            type="number"
            value={courseData.duration_hours || 0}
            onChange={(e) => handleInputChange("duration_hours", Number(e.target.value))}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <Label htmlFor="lessons">Total Lessons</Label>
          <Input
            id="lessons"
            type="number"
            value={courseData.lessons || 0}
            onChange={(e) => handleInputChange("lessons", Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="students">Number of Students</Label>
          <Input
            id="students"
            type="number"
            value={courseData.students || 0}
            onChange={(e) => handleInputChange("students", Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="reviews">Number of Reviews</Label>
          <Input
            id="reviews"
            type="number"
            value={courseData.reviews || 0}
            onChange={(e) => handleInputChange("reviews", Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="rating">Rating (0-5)</Label>
          <Input
            id="rating"
            type="number"
            step="0.1"
            min="0"
            max="5"
            value={courseData.rating || 0}
            onChange={(e) => handleInputChange("rating", Number(e.target.value))}
          />
        </div>
      </div>
    </div>,
    <div key="requirements" className="space-y-6">
      <h2 className="text-2xl font-bold">Course Requirements</h2>
      <div>
        <Label htmlFor="requirements">Course Requirements</Label>
        <Textarea
          id="requirements"
          value={courseData.requirements || ''}
          onChange={(e) => handleInputChange("requirements", e.target.value)}
          placeholder="What prerequisites are needed for this course?"
        />
      </div>
    </div>,

    <div key="outcomes" className="space-y-6">
      <h2 className="text-2xl font-bold">Course Outcomes & Objectives</h2>
      <div>
        <Label htmlFor="objectives">Course Objectives</Label>
        <Textarea
          id="objectives"
          value={Array.isArray(courseData.objectives) ? courseData.objectives.join('\n') : (courseData.objectives || '')}
          onChange={(e) => handleInputChange("objectives", e.target.value.split('\n').filter(line => line.trim()))}
          placeholder="List the main objectives of this course (one per line)"
        />
      </div>
      <div>
        <Label htmlFor="outcomes">Learning Outcomes</Label>
        <Textarea
          id="outcomes"
          value={Array.isArray(courseData.outcomes) ? courseData.outcomes.join('\n') : (courseData.outcomes || '')}
          onChange={(e) => handleInputChange("outcomes", e.target.value.split('\n').filter(line => line.trim()))}
          placeholder="What will students learn? (one per line)"
        />
      </div>
    </div>,
    <div key="pricing" className="space-y-6">
      <h2 className="text-2xl font-bold">Course Pricing</h2>
      <RadioGroup
        value={courseData.is_free ? "free" : "paid"}
        onValueChange={(value) => handleInputChange("is_free", value === "free")}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="free" id="free" />
          <Label htmlFor="free">Free Course</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="paid" id="paid" />
          <Label htmlFor="paid">Paid Course</Label>
        </div>
      </RadioGroup>
      {!courseData.is_free && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              type="number"
              value={courseData.price || 0}
              onChange={(e) => handleInputChange("price", Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="original_price">Original Price</Label>
            <Input
              id="original_price"
              type="number"
              value={courseData.original_price || 0}
              onChange={(e) => handleInputChange("original_price", Number(e.target.value))}
            />
          </div>
        </div>
      )}
    </div>,
    <div key="media" className="space-y-6">
      <h2 className="text-2xl font-bold">Course Media</h2>
      <div>
        <Label htmlFor="thumbnail">Course thumbnail</Label>
        <Input
          id="thumbnail"
          type="file"
          accept="image/*"
          onChange={(e) => handleInputChange("image", e.target.files?.[0] || null)}
        />
        {courseData.image && (
          <img 
            src={typeof courseData.image === 'string' ? courseData.image : URL.createObjectURL(courseData.image)} 
            alt="Course thumbnail" 
            className="mt-4 w-48 h-auto" 
          />
        )}
      </div>
    </div>,
    <div key="seo" className="space-y-6">
      <h2 className="text-2xl font-bold">SEO & Marketing</h2>
      <div>
        <Label htmlFor="meta_description">Meta Description</Label>
        <Textarea
          id="meta_description"
          value={courseData.meta_description || ''}
          onChange={(e) => handleInputChange("meta_description", e.target.value)}
          placeholder="Brief description for search engines (150-160 characters)"
        />
      </div>
      <div>
        <Label htmlFor="meta_keywords">Meta Keywords</Label>
        <Input
          id="meta_keywords"
          value={courseData.meta_keywords || ''}
          onChange={(e) => handleInputChange("meta_keywords", e.target.value)}
          placeholder="Comma-separated keywords for SEO"
        />
      </div>
    </div>,
    <div key="finish" className="space-y-6 text-center">
      <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
      <h2 className="text-2xl font-bold">All Set!</h2>
      <p className="text-gray-600">Click 'Finish' to save your changes.</p>
    </div>
  ];

  return (
    <Protect
    role="admin"
    fallback={<p>Access denied</p>}
    >
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Edit Course</h1>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
        </div>
        <MultiStepForm
          steps={formSteps}
          onComplete={handleComplete}
          className="p-4 border rounded-lg shadow-sm"
        >
          {stepContent}
        </MultiStepForm>
      </div>
    </AdminLayout>
    </Protect>
  )
}
