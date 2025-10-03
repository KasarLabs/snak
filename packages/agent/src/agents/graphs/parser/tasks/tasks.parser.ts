import { TaskType } from "@stypes/graph.types.js";

export function tasks_parser(
  tasks: TaskType[],
  isHumanTask: boolean = false
): string {
  try {
    if (!tasks || tasks.length === 0) {
      return '<tasks-history>\n  <!-- No tasks available -->\n</tasks-history>';
    }

    // Filter tasks based on isHumanTask parameter
    let filteredTasks = tasks;
    if (isHumanTask) {
      // For human tasks, only include tasks that have human steps or human responses
      filteredTasks = tasks.filter(
        (task) =>
          task.isHumanTask ||
          task.human ||
          (task.steps && task.steps.some((step) => step.type === 'human'))
      );
    }

    const formattedTasks: string[] = [];
    filteredTasks.forEach((task) => {
      const escapeXML = (str: string) => {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      formattedTasks.push(
        `  <task name="${task.task?.directive}" id="${task.id}"">`
      );
      formattedTasks.push(`    <status>${escapeXML(task.status)}</status>`);
      if (task.task_verification) {
        formattedTasks.push(
          `    <verification_result>${escapeXML(task.task_verification)}</verification_result>`
        );
      } else if (task.human) {
        formattedTasks.push(
          `    <ai_request>${escapeXML(JSON.stringify(task.thought.speak))}</ai_request>`
        );
        formattedTasks.push(
          `    <human_response>${escapeXML(task.human)}</human_response>`
        );
      }
      formattedTasks.push(`</task>`);
    });
    return formattedTasks.join('\n');
  } catch (error) {
    throw error;
  }
}
