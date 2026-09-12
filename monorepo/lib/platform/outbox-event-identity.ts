type OutboxEventScope =
  | Readonly<{ kind: "case"; caseId: string }>
  | Readonly<{ kind: "transition"; transitionId: string }>
  | Readonly<{ kind: "execution"; executionId: string }>
  | Readonly<{ kind: "attempt"; attemptId: string }>;

export function outboxEventIdentity(scope: OutboxEventScope) {
  switch (scope.kind) {
    case "case": return `case:${scope.caseId}`;
    case "transition": return `transition:${scope.transitionId}`;
    case "execution": return `execution:${scope.executionId}`;
    case "attempt": return `attempt:${scope.attemptId}`;
  }
}
