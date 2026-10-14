// ---------------------------------------------------------------------------
//  ReactExample.jsx — how to use the service inside a React component.
//  This is just an example; adapt the styling to your app.
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { getLiveScores } from "./footballApi"; // the client from footballApi.js

export default function LiveScoresPanel({ competition = "PL" }) {
  const [matches, setMatches] = useState([]);
  const [mock, setMock] = useState(false);
  const [status, setStatus] = useState("loading"); // loading | ok | error

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    getLiveScores(competition)
      .then((body) => {
        if (!alive) return;
        setMatches(body.data || []);
        setMock(Boolean(body.mock));
        setStatus("ok");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [competition]);

  if (status === "loading") return <p>Loading live scores…</p>;
  if (status === "error") return <p>Couldn't load live scores.</p>;

  return (
    <div>
      {mock && (
        <p style={{ color: "#f59e0b" }}>
          Showing sample data — add an API key on the server for live results.
        </p>
      )}
      <ul>
        {matches.map((m) => (
          <li key={m.id}>
            <strong>{m.homeTeam?.name}</strong> {m.score?.home} – {m.score?.away}{" "}
            <strong>{m.awayTeam?.name}</strong>{" "}
            <em>({m.status}{m.minute ? ` ${m.minute}'` : ""})</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
