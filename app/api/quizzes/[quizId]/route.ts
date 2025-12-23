import { NextResponse } from 'next/server';
import '@/lib/fetchWithTimeout';
import { getDb } from '@/lib/db';

interface QuizDetails {
  id: string;
  title: string;
  // Add other quiz-specific fields here
}

export async function GET(request: Request, { params }: { params: { quizId: string } }) {
  const { quizId } = params;
  if (!quizId) {
    return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 });
  }

  const db = await getDb();

  try {
    const quiz = await db.get<QuizDetails>('SELECT * FROM quizzes WHERE id = $1', [quizId]);

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    return NextResponse.json(quiz);
  } catch (error) {
    console.error(`Failed to fetch quiz ${quizId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch quiz details' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { quizId: string } }) {
  const { quizId } = params;
  if (!quizId) {
    return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 });
  }

  const db = await getDb();

  try {
    await db.run('DELETE FROM quizzes WHERE id = $1', [quizId]);
    return NextResponse.json({ message: 'Quiz deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Failed to delete quiz ${quizId}:`, error);
    return NextResponse.json({ error: 'Failed to delete quiz' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { quizId: string } }) {
  const { quizId } = params;
  if (!quizId) {
    return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 });
  }

  const { title } = await request.json();
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const db = await getDb();

  try {
    await db.run('UPDATE quizzes SET title = $1 WHERE id = $2', [title, quizId]);
    const updatedQuiz = await db.get<QuizDetails>('SELECT * FROM quizzes WHERE id = $1', [quizId]);
    return NextResponse.json(updatedQuiz);
  } catch (error) {
    console.error(`Failed to update quiz ${quizId}:`, error);
    return NextResponse.json({ error: 'Failed to update quiz' }, { status: 500 });
  }
}
