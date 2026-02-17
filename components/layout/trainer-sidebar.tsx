"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  LayoutDashboard,
  FolderTree,
  BookOpen,
  Users,
  School,
  UserCheck,
  GraduationCap,
  Calendar,
  ClipboardList,
  UserPlus,
  Settings,
  BarChart3,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { getCurrentMockUser } from "@/lib/mock-auth"
import { mockTrainers } from "@/lib/mock-data"

const navigationSections = [
  {
    section: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/trainer/dashboard",
        icon: LayoutDashboard,
        privilege: null, // always show
      },
    ],
  },
  {
    section: "Management",
    items: [
      {
        title: "My Batches",
        href: "/trainer/batches",
        icon: Users,
        privilege: null, // always show for trainers
      },
      {
        title: "Students",
        href: "/trainer/students",
        icon: UserPlus,
        privilege: null, // always show for trainers
      },
      {
        title: "Sessions",
        href: "/trainer/sessions",
        icon: Calendar,
        privilege: null,
      },
      {
        title: "New Session",
        href: "/trainer/sessions/new",
        icon: Calendar,
        privilege: null,
      },
    ],
  },
  {
    section: "Learning",
    items: [
      {
        title: "My Levels",
        href: "/trainer/levels",
        icon: FolderTree,
        privilege: null,
      },
      {
        title: "Courses",
        href: "/trainer/courses",
        icon: BookOpen,
        privilege: "manage_courses",
      },
    ],
  },
  {
    section: "Assessment",
    items: [
      {
        title: "Assignments",
        href: "/trainer/assignments",
        icon: ClipboardList,
        privilege: null, // always show
      },
      {
        title: "Grade",
        href: "/trainer/grade",
        icon: GraduationCap,
        privilege: null,
      },
      {
        title: "Reports",
        href: "/trainer/reports",
        icon: BarChart3,
        privilege: null, // always show
      },
    ],
  },
  {
    section: "Settings",
    items: [
      {
        title: "Settings",
        href: "/trainer/settings",
        icon: Settings,
        privilege: null, // always show
      },
    ],
  },
]

export function TrainerSidebar() {
  const pathname = usePathname()
  const [openItems, setOpenItems] = useState<string[]>(["Dashboard"])

  // Get current trainer's privileges
  let privileges: string[] = []
  if (typeof window !== "undefined") {
    const user = getCurrentMockUser()
    if (user) {
      // Try to get privileges from localStorage first
      const localPrivileges = localStorage.getItem(`trainer-privileges-${user.email}`)
      if (localPrivileges) {
        try {
          privileges = JSON.parse(localPrivileges)
        } catch {
          privileges = []
        }
      } else {
        const trainer = mockTrainers.find((t) => t.email === user.email)
        if (trainer) privileges = trainer.privileges || []
      }
    }
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Aiskool</h2>
            <p className="text-sm text-gray-500">Trainer Panel</p>
          </div>
        </div>
        <div className="space-y-6">
          {navigationSections.map((section) => {
            // Filter items based on privileges
            const visibleItems = section.items.filter(
              (item) => !item.privilege || privileges.includes(item.privilege)
            )
            
            if (visibleItems.length === 0) return null

            return (
              <div key={section.section} className="space-y-1">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
                  {section.section}
                </div>
                {visibleItems.map((item) => (
                  <Link key={item.title} href={item.href!}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start font-normal",
                        pathname === item.href && "bg-blue-50 text-blue-700",
                      )}
                    >
                      <item.icon className="h-4 w-4 mr-3" />
                      {item.title}
                    </Button>
                  </Link>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
} 