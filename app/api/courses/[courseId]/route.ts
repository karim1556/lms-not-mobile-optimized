
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function GET(req: NextRequest, { params }: { params: { courseId: string } }) {
  const db = await getDb();
  const course = await db.get("SELECT * FROM courses WHERE id = $1", [params.courseId]);
  return NextResponse.json(course);
}

export async function PUT(req: NextRequest, { params }: { params: { courseId: string } }) {
  const db = await getDb();
  
  try {
    const formData = await req.formData();
    const updates: { [key: string]: any } = {};
    const imageFile = formData.get("image") as File | null;

    // Process form data to build the updates object
    for (const [key, value] of formData.entries()) {
      if (key.endsWith('[]')) {
        // Handle array fields
        const arrayKey = key.slice(0, -2);
        if (!updates[arrayKey]) {
          updates[arrayKey] = [];
        }
        updates[arrayKey].push(value);
      } else if (key === 'image') {
        // Image is handled separately below
        continue;
      } else if (['price', 'original_price', 'lessons', 'rating', 'reviews', 'students', 'duration_hours'].includes(key)) {
        updates[key] = parseFloat(value as string) || 0;
      } else if (key === 'is_free') {
        updates[key] = value === 'true';
      } else {
        updates[key] = value;
      }
    }

    // Handle image upload or existing image path
    const imageValue = formData.get("image");
    if (imageValue instanceof File && imageValue.size > 0) {
      // New file is uploaded, upload to Supabase
      const fileName = `${Date.now()}-${imageValue.name}`;
      const { error: uploadError } = await supabase.storage
        .from('course-thumbnails')
        .upload(fileName, imageValue);

      if (uploadError) {
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('course-thumbnails')
        .getPublicUrl(fileName);

      updates.image = urlData.publicUrl;
    } else if (typeof imageValue === 'string') {
      // Existing image path is passed
      updates.image = imageValue;
    }

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return NextResponse.json({ message: "No fields to update" });
    }

    const setClauses = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    const values = fields.map(field => {
      const value = updates[field];
      // For array fields that are stored as JSON/JSONB, stringify them.
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      return value;
    });
    
    const query = `UPDATE courses SET ${setClauses} WHERE id = $${fields.length + 1}`;
    values.push(params.courseId);

    await db.run(query, values);
    
    return NextResponse.json({ message: "Course updated successfully" });
  } catch (error) {
    console.error('Error updating course:', error);
    return NextResponse.json(
      { error: 'Failed to update course', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { courseId: string } }) {
  const db = await getDb();
  await db.run("DELETE FROM courses WHERE id = $1", [params.courseId]);
  return NextResponse.json({ message: "Course deleted" });
}