import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Server Component — static landing content, no client state needed.
 */
export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Heritage Saturday</h1>
        <p className="text-muted-foreground mt-1">
          Import a roster, set up a game, and view the box score.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>1. Import a roster</CardTitle>
            <CardDescription>
              Upload a CSV/JSON/XLSX/XLS file of teams and players.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" render={<Link href="/imports/new" />}>
              Import Roster
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Set up a game</CardTitle>
            <CardDescription>
              Pick two teams, review depth charts, choose archetypes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" render={<Link href="/games/new" />}>
              New Game
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. View the box score</CardTitle>
            <CardDescription>
              Reachable from the result of any completed game.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              render={<Link href="/imports" />}
            >
              Import History
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
