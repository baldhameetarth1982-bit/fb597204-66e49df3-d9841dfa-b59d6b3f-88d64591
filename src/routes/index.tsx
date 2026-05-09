import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  // Intentionally blank — global navigation shell is mounted in __root.tsx.
  return <div className="min-h-[calc(100vh-4rem)] bg-background" />;
}
