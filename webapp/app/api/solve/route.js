import { NextResponse } from 'next/server';

import { solveScheduleWithConstraints } from '../../../../src/lib/algorithm/entrypoint.js';
import { parseCurriculumPayload } from '@/lib/curriculum-format.js';

function enrichResultWithClasses(classes, result) {
  const classMap = new Map(classes.map((cls) => [cls.id, cls]));
  const scheduleByPeriod = {};

  for (const [classIdRaw, assignment] of Object.entries(result.assignments || {})) {
    const classId = Number(classIdRaw);
    const cls = classMap.get(classId);
    if (!cls) {
      continue;
    }

    const period = assignment.period;
    if (!scheduleByPeriod[period]) {
      scheduleByPeriod[period] = [];
    }

    const option = cls.scheduleOptions?.[assignment.optionIndex] || null;

    scheduleByPeriod[period].push({
      classId,
      className: cls.name,
      optionIndex: assignment.optionIndex,
      filteredOptionIndex: assignment.filteredOptionIndex,
      schedule: option?.schedule || null,
      prerequisites: cls.prerequisites || []
    });
  }

  for (const period of Object.keys(scheduleByPeriod)) {
    scheduleByPeriod[period].sort((a, b) => a.className.localeCompare(b.className, 'es'));
  }

  return {
    ...result,
    scheduleByPeriod
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = parseCurriculumPayload(body?.curriculum);

    if (parsed.classes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'El plan de estudio no tiene materias validas.'
        },
        { status: 400 }
      );
    }

    const solverResult = solveScheduleWithConstraints(parsed.classes, body?.constraints || {}, body?.solverOptions || {});

    if (!solverResult.success) {
      return NextResponse.json(solverResult, { status: 422 });
    }

    return NextResponse.json(enrichResultWithClasses(parsed.classes, solverResult));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected server error'
      },
      { status: 500 }
    );
  }
}
