import { Filter } from "nostr-tools/lib/types/filter";
import { Event } from "nostr-tools/lib/types/core";
import { useRelays } from "../../hooks/useRelays";
import { useEffect, useState } from "react";
import { Analytics } from "../PollResults/Analytics";
import { SubCloser } from "nostr-tools/lib/types/abstract-pool";
import { nip13 } from "nostr-tools";
import { pool } from "../../singletons";

interface FetchResultsProps {
  pollEvent: Event;
  filterPubkeys?: string[];
  difficulty?: number;
}
export const FetchResults: React.FC<FetchResultsProps> = ({
  pollEvent,
  filterPubkeys,
  difficulty,
}) => {
  const [respones, setResponses] = useState<Event[] | undefined>();
  const [closer, setCloser] = useState<SubCloser | undefined>();
  const relays = pollEvent.tags
    .filter((t) => t[0] === "relay")
    ?.map((r) => r[1]);
  const pollExpiration = pollEvent.tags.filter(
    (t) => t[0] === "endsAt"
  )?.[0]?.[1];
  const { relays: userRelays } = useRelays();
  const getUniqueLatestEvents = (events: Event[]) => {
    const eventMap = new Map<string, Event>();

    events.forEach((event) => {
      if (
        !eventMap.has(event.pubkey) ||
        event.created_at > eventMap.get(event.pubkey)!.created_at
      ) {
        if (difficulty && nip13.getPow(event.id) < difficulty) {
          return;
        }
        eventMap.set(event.pubkey, event);
      }
    });

    return Array.from(eventMap.values());
  };

  const handleResultEvent = (event: Event) => {
    setResponses((prevResponses) => [...(prevResponses || []), event]);
  };

  const fetchVoteEvents = (filterPubkeys: string[]) => {
    if (closer) {
      closer.close();
      setResponses(undefined);
    }
    let resultFilter: Filter = {
      "#e": [pollEvent.id],
      kinds: [1070, 1018],
    };
    if (difficulty) {
      resultFilter["#W"] = [difficulty.toString()];
    }
    if (filterPubkeys?.length) {
      resultFilter.authors = filterPubkeys;
    }
    if (pollExpiration) {
      resultFilter.until = Number(pollExpiration);
    }
    const useRelays = relays?.length ? relays : userRelays;
    let newCloser = pool.subscribeMany(useRelays, [resultFilter], {
      onevent: handleResultEvent,
    });
    setCloser(newCloser);
  };

  useEffect(() => {
    fetchVoteEvents(filterPubkeys || []);
    return () => {
      if (closer) closer.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPubkeys]);

  return (
    <>
      <Analytics
        pollEvent={pollEvent}
        responses={getUniqueLatestEvents(respones || [])}
      />
    </>
  );
};
