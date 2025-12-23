import '@/lib/fetchWithTimeout'
import { NextResponse } from 'next/server';
import { getDb, sql } from '@/lib/db';

interface QuizOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
}

interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  sort_order: number;
  options: QuizOption[];
}

export async function GET(request: Request, { params }: { params: { quizId: string } }) {
  const quizId = params.quizId;
  const db = await getDb();

  try {
    const questions = await db.all<QuizQuestion>(
      'SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY sort_order',
      [quizId]
    );

    for (const question of questions) {
      const options = await db.all<QuizOption>(
        'SELECT * FROM quiz_options WHERE question_id = $1',
        [question.id]
      );
      question.options = options;
    }

    return NextResponse.json(questions);
  } catch (error) {
    console.error('Failed to fetch quiz questions:', error);
    return NextResponse.json({ error: 'Failed to fetch quiz questions' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { quizId: string } }) {
  const quizId = params.quizId;
  const { question_text, options } = await request.json();

  if (!question_text || !options || !Array.isArray(options) || options.length === 0) {
    return NextResponse.json({ error: 'Question text and at least one option are required' }, { status: 400 });
  }

  try {
    const newQuestion = await sql.begin(async (tx) => {
      const maxOrderResult = await tx.unsafe(
        'SELECT MAX(sort_order) as max_order FROM quiz_questions WHERE quiz_id = $1',
        [quizId]
      );
      const newSortOrder = (maxOrderResult[0].max_order || 0) + 1;

      const [question] = await tx.unsafe(
        'INSERT INTO quiz_questions (quiz_id, question_text, sort_order) VALUES ($1, $2, $3) RETURNING *',
        [quizId, question_text, newSortOrder]
      );

      const insertedOptions = [];
      for (const option of options) {
        const [insertedOption] = await tx.unsafe(
          'INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES ($1, $2, $3) RETURNING *',
          [question.id, option.option_text, option.is_correct]
        );
        insertedOptions.push(insertedOption);
      }

      return { ...question, options: insertedOptions };
    });

    return NextResponse.json(newQuestion, { status: 201 });
  } catch (error) {
    console.error('Failed to create quiz question:', error);
    return NextResponse.json({ error: 'Failed to create quiz question' }, { status: 500 });
  }
}
