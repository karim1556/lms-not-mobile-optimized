import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'


const isInstructorRoute = createRouteMatcher(['/instructor(.*)'])
const isTrainerRoute = createRouteMatcher(['/trainer(.*)'])
const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isCoordinatorRoute = createRouteMatcher(['/coordinator(.*)'])
const isStudentRoute = createRouteMatcher(['/student(.*)'])
const isCampCoordinatorRoute = createRouteMatcher(['/camp-coordinator(.*)'])


export default clerkMiddleware(async (auth, req) => {
  // Debug trace for routing in development
  // In development, skip Clerk middleware for API routes to avoid external
  // network delays from Clerk affecting local debugging of API endpoints.
  if (process.env.NODE_ENV !== 'production' && req.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  if (process.env.NODE_ENV !== 'production') {
    const p = req.nextUrl.pathname
    const flags = {
      admin: isAdminRoute(req),
      instructor: isInstructorRoute(req),
      trainer: isTrainerRoute(req),
      coordinator: isCoordinatorRoute(req),
      student: isStudentRoute(req),
      campCoordinator: isCampCoordinatorRoute(req),
    }
    console.log('[middleware]', p, flags)
  }

  if (isAdminRoute(req)) {
    try {
      await auth.protect((has) => {
        return has({ role: 'admin' })
      })
    } catch (err) {
      // auth.protect may throw an HTTP access fallback (notFound/redirect) when
      // the user is not authenticated/authorized. Redirect to sign-in instead
      // so the user gets a standard sign-in flow rather than a 404.
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
  }

  if (isInstructorRoute(req)) {
    try {
      await auth.protect((has) => {
        return has({ role: 'instructor' })
      })
    } catch (err) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
  }

  if (isTrainerRoute(req)) {
    try {
      await auth.protect((has) => {
        return has({ role: 'trainer' })
      })
    } catch (err) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
  }

  if (isCoordinatorRoute(req)) {
    await auth.protect((has) => (
      has({ role: 'coordinator' }) ||
      has({ role: 'school_coordinator' }) ||
      has({ role: 'schoolCoordinator' }) ||
      has({ role: 'school-coordinator' }) ||
      has({ role: 'schoolcoordinator' })
    ))
  }

  if (isStudentRoute(req)) {
    try {
      await auth.protect((has) => {
        return has({ role: 'student' })
      })
    } catch (err) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
  }

  if (isCampCoordinatorRoute(req)) {
    try {
      await auth.protect((has) => (
        has({ role: 'campCoordinator' }) ||
        has({ role: 'camp_coordinator' }) ||
        has({ role: 'camp-coordinator' }) ||
        has({ role: 'campcoordinator' })
      ))
    } catch (err) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
  }

  // For org-scoped sections, ensure an active organization is selected
  if (isCoordinatorRoute(req) || isTrainerRoute(req) || isStudentRoute(req) || isCampCoordinatorRoute(req)) {
    const { orgId } = await auth()
    if (!orgId) {
      // No active organization
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
  }

})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}