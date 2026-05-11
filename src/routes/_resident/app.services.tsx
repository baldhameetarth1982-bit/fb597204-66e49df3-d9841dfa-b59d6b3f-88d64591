import { createFileRoute } from "@tanstack/react-router";
import {
  Shield,
  Car,
  AlertCircle,
  Sparkles,
  Wrench,
  PackageSearch,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_resident/app/services")({
  head: () => ({ meta: [{ title: "Services — SocioHub" }] }),
  component: ServicesScreen,
});

const primary = [
  {
    title: "Visitors / Guard",
    desc: "Approve guests, view gate logs",
    icon: Shield,
    accent: "bg-primary/10 text-primary",
  },
  {
    title: "Vehicles",
    desc: "Register cars & two-wheelers",
    icon: Car,
    accent: "bg-primary/10 text-primary",
  },
  {
    title: "Complaints",
    desc: "Raise & track society issues",
    icon: AlertCircle,
    accent: "bg-destructive/10 text-destructive",
  },
];

const more = [
  { title: "Daily Help", icon: Sparkles },
  { title: "Maintenance", icon: Wrench },
  { title: "Lost & Found", icon: PackageSearch },
];

function ServicesScreen() {
  return (
    <div className="px-5 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
        <p className="text-sm text-muted-foreground">
          Everything your society needs, in one place.
        </p>
      </header>

      <section className="space-y-3">
        {primary.map(({ title, desc, icon: Icon, accent }) => (
          <button
            key={title}
            type="button"
            className="w-full text-left active:scale-[0.99] transition-transform"
          >
            <Card className="rounded-2xl">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl grid place-items-center ${accent}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </button>
        ))}
      </section>

      <section>
        <h2 className="px-1 mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          More
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {more.map(({ title, icon: Icon }) => (
            <button
              key={title}
              type="button"
              className="rounded-2xl bg-secondary/60 hover:bg-secondary p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
            >
              <span className="h-10 w-10 rounded-xl bg-background grid place-items-center text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium text-center">{title}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
