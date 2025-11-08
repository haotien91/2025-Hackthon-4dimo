import { EventCard } from "@/components/event-card";
import { ScrollableRow } from "@/components/scrollable-row";
import { featuredEvents, upcomingEvents } from "@/lib/mock-events";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">


      <section className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-6 md:px-10 lg:px-16">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">
              熱門展演
            </h2>
          </div>
          <ScrollableRow
            itemWidth="min-w-[340px] md:min-w-[340px] lg:min-w-[360px]"
            itemHeight="h-[300px] md:h-[340px]"
          >
            {featuredEvents.map((event) => (
              <EventCard key={event.eventId} event={event} />
            ))}
          </ScrollableRow>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">
              近期展演
            </h2>
          </div>
          <ScrollableRow
            itemWidth="min-w-[340px] md:min-w-[340px] lg:min-w-[360px]"
            itemHeight="h-[300px] md:h-[340px]"
          >
            {upcomingEvents.map((event) => (
              <EventCard key={event.eventId} event={event} />
            ))}
          </ScrollableRow>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16 md:px-10 lg:px-16">
          <div className="grid w-full grid-cols-3 gap-4">
            <ActionCard icon="🎟️" title="找展演" href="/explore" />
            <ActionCard icon="📍" title="找身邊" href="/nearby" />
            <ActionCard icon="💎" title="找記憶" href="/memory" />
          </div>
        </div>
      </section>
    </main>
  );
}

type ActionCardProps = {
  icon: string;
  title: string;
  href?: string;
};

function ActionCard({ icon, title, href = "#" }: ActionCardProps) {
  return (
    <Link
      href={href}
      className="group flex w-full flex-col items-center gap-3 rounded-2xl bg-white px-6 py-6 text-center shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
    >
      <span className="text-3xl">{icon}</span>
      <span className="text-sm font-semibold text-slate-900">{title}</span>
    </Link>
  );
}
