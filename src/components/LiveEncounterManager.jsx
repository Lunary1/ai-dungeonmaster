"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function LiveEncounterManager({
  campaignId,
  sessionActive = false,
  isDM = false,
}) {
  // Encounter state
  const [encounter, setEncounter] = useState(null);
  const [encounterActive, setEncounterActive] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentTurn, setCurrentTurn] = useState(0);

  // Initiative tracking
  const [initiativeOrder, setInitiativeOrder] = useState([]);
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    name: "",
    initiative: "",
    hp: "",
    ac: "",
    type: "npc", // 'pc', 'npc', 'monster'
  });

  // Combat tracking
  const [conditions, setConditions] = useState({});
  const [concentrationChecks, setConcentrationChecks] = useState([]);

  // Quick actions
  const [quickNotes, setQuickNotes] = useState("");
  const [lastAction, setLastAction] = useState("");

  // Load active encounter
  const loadActiveEncounter = useCallback(async () => {
    if (!campaignId) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `/api/campaigns/${campaignId}/encounter/active`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.encounter) {
          setEncounter(data.encounter);
          setEncounterActive(true);
          setInitiativeOrder(data.encounter.participants || []);
          setCurrentRound(data.encounter.current_round || 1);
          setCurrentTurn(data.encounter.current_turn || 0);
        }
      }
    } catch (error) {
      console.error("Error loading active encounter:", error);
    }
  }, [campaignId]);

  // Start new encounter
  const startEncounter = async (encounterData = null) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/campaigns/${campaignId}/encounter`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "start",
          encounterData: encounterData || {
            name: "New Encounter",
            type: "combat",
            description: "A new encounter begins...",
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setEncounter(result.encounter);
        setEncounterActive(true);
        setCurrentRound(1);
        setCurrentTurn(0);
        setInitiativeOrder([]);

        // Broadcast encounter start
        broadcastEncounterUpdate({
          type: "encounter_started",
          encounter: result.encounter,
        });
      }
    } catch (error) {
      console.error("Error starting encounter:", error);
    }
  };

  // End encounter
  const endEncounter = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/campaigns/${campaignId}/encounter`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "end",
          encounterId: encounter?.id,
        }),
      });

      if (response.ok) {
        setEncounter(null);
        setEncounterActive(false);
        setInitiativeOrder([]);
        setCurrentRound(1);
        setCurrentTurn(0);
        setConditions({});

        // Broadcast encounter end
        broadcastEncounterUpdate({
          type: "encounter_ended",
        });
      }
    } catch (error) {
      console.error("Error ending encounter:", error);
    }
  };

  // Add participant to initiative
  const addParticipant = () => {
    if (!newParticipant.name || !newParticipant.initiative) return;

    const participant = {
      id: Date.now().toString(),
      name: newParticipant.name,
      initiative: parseInt(newParticipant.initiative),
      hp: parseInt(newParticipant.hp) || 0,
      maxHp: parseInt(newParticipant.hp) || 0,
      ac: parseInt(newParticipant.ac) || 10,
      type: newParticipant.type,
      conditions: [],
      isActive: false,
    };

    const newOrder = [...initiativeOrder, participant]
      .sort((a, b) => b.initiative - a.initiative)
      .map((p, index) => ({ ...p, isActive: index === 0 }));

    setInitiativeOrder(newOrder);
    setNewParticipant({
      name: "",
      initiative: "",
      hp: "",
      ac: "",
      type: "npc",
    });
    setAddingParticipant(false);

    // Update current turn to active participant
    const activeIndex = newOrder.findIndex((p) => p.isActive);
    setCurrentTurn(activeIndex);
  };

  // Next turn
  const nextTurn = () => {
    const newInitiativeOrder = initiativeOrder.map((p) => ({
      ...p,
      isActive: false,
    }));
    let nextTurnIndex = currentTurn + 1;

    if (nextTurnIndex >= initiativeOrder.length) {
      nextTurnIndex = 0;
      setCurrentRound((prev) => prev + 1);
    }

    if (newInitiativeOrder[nextTurnIndex]) {
      newInitiativeOrder[nextTurnIndex].isActive = true;
    }

    setInitiativeOrder(newInitiativeOrder);
    setCurrentTurn(nextTurnIndex);

    const activeParticipant = newInitiativeOrder[nextTurnIndex];
    setLastAction(
      `${activeParticipant?.name || "Unknown"}'s turn (Round ${currentRound})`
    );

    // Broadcast turn change
    broadcastEncounterUpdate({
      type: "turn_changed",
      activeParticipant: activeParticipant,
      round: currentRound,
    });
  };

  // Apply damage
  const applyDamage = (participantId, damage) => {
    setInitiativeOrder((prev) =>
      prev.map((p) => {
        if (p.id === participantId) {
          const newHp = Math.max(0, p.hp - damage);
          return { ...p, hp: newHp };
        }
        return p;
      })
    );

    setLastAction(`Applied ${damage} damage`);
  };

  // Apply healing
  const applyHealing = (participantId, healing) => {
    setInitiativeOrder((prev) =>
      prev.map((p) => {
        if (p.id === participantId) {
          const newHp = Math.min(p.maxHp, p.hp + healing);
          return { ...p, hp: newHp };
        }
        return p;
      })
    );

    setLastAction(`Applied ${healing} healing`);
  };

  // Add condition
  const addCondition = (participantId, condition) => {
    setInitiativeOrder((prev) =>
      prev.map((p) => {
        if (p.id === participantId) {
          return { ...p, conditions: [...(p.conditions || []), condition] };
        }
        return p;
      })
    );

    setLastAction(`Added condition: ${condition}`);
  };

  // Remove condition
  const removeCondition = (participantId, conditionIndex) => {
    setInitiativeOrder((prev) =>
      prev.map((p) => {
        if (p.id === participantId) {
          const newConditions = p.conditions.filter(
            (_, index) => index !== conditionIndex
          );
          return { ...p, conditions: newConditions };
        }
        return p;
      })
    );

    setLastAction(`Removed condition`);
  };

  // Broadcast encounter updates
  const broadcastEncounterUpdate = async (update) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`/api/campaigns/${campaignId}/broadcast`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "encounter_update",
          data: update,
        }),
      });
    } catch (error) {
      console.error("Error broadcasting encounter update:", error);
    }
  };

  // Load encounter on mount
  useEffect(() => {
    if (sessionActive) {
      loadActiveEncounter();
    }
  }, [sessionActive, loadActiveEncounter]);

  if (!sessionActive) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
        <div className="text-center text-gray-400">
          Start a session to use the encounter manager.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          ⚔️ Live Encounter Manager
          {encounterActive && (
            <span className="text-sm bg-red-600 text-white px-2 py-1 rounded">
              Round {currentRound}
            </span>
          )}
        </h2>

        <div className="flex gap-2">
          {!encounterActive ? (
            <button
              onClick={() => startEncounter()}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              ⚔️ Start Encounter
            </button>
          ) : (
            <button
              onClick={endEncounter}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              🏁 End Encounter
            </button>
          )}
        </div>
      </div>

      {encounterActive && (
        <>
          {/* Initiative Order */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Initiative Order
              </h3>
              <button
                onClick={() => setAddingParticipant(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                + Add Participant
              </button>
            </div>

            {/* Add participant form */}
            {addingParticipant && (
              <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newParticipant.name}
                    onChange={(e) =>
                      setNewParticipant((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="bg-slate-900/50 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Initiative"
                    value={newParticipant.initiative}
                    onChange={(e) =>
                      setNewParticipant((prev) => ({
                        ...prev,
                        initiative: e.target.value,
                      }))
                    }
                    className="bg-slate-900/50 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                  />
                  <input
                    type="number"
                    placeholder="HP"
                    value={newParticipant.hp}
                    onChange={(e) =>
                      setNewParticipant((prev) => ({
                        ...prev,
                        hp: e.target.value,
                      }))
                    }
                    className="bg-slate-900/50 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                  />
                  <input
                    type="number"
                    placeholder="AC"
                    value={newParticipant.ac}
                    onChange={(e) =>
                      setNewParticipant((prev) => ({
                        ...prev,
                        ac: e.target.value,
                      }))
                    }
                    className="bg-slate-900/50 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                  />
                  <select
                    value={newParticipant.type}
                    onChange={(e) =>
                      setNewParticipant((prev) => ({
                        ...prev,
                        type: e.target.value,
                      }))
                    }
                    className="bg-slate-900/50 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                  >
                    <option value="pc">Player</option>
                    <option value="npc">NPC</option>
                    <option value="monster">Monster</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addParticipant}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAddingParticipant(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Initiative list */}
            <div className="space-y-2">
              {initiativeOrder.map((participant, index) => (
                <div
                  key={participant.id}
                  className={`border rounded-lg p-3 transition-all ${
                    participant.isActive
                      ? "bg-blue-600/20 border-blue-500"
                      : "bg-slate-700/50 border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-bold text-white">
                        {participant.initiative}
                      </div>
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          {participant.name}
                          {participant.isActive && (
                            <span className="text-yellow-400">👈</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-300">
                          {participant.type.toUpperCase()} • AC {participant.ac}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* HP display */}
                      <div className="text-right">
                        <div className="font-bold text-white">
                          {participant.hp}/{participant.maxHp}
                        </div>
                        <div className="text-xs text-gray-400">HP</div>
                      </div>

                      {/* Quick actions */}
                      {isDM && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => applyDamage(participant.id, 5)}
                            className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                            title="Apply 5 damage"
                          >
                            -5
                          </button>
                          <button
                            onClick={() => applyHealing(participant.id, 5)}
                            className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs"
                            title="Apply 5 healing"
                          >
                            +5
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conditions */}
                  {participant.conditions &&
                    participant.conditions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {participant.conditions.map((condition, condIndex) => (
                          <span
                            key={condIndex}
                            className="bg-purple-600 text-white px-2 py-1 rounded text-xs cursor-pointer hover:bg-purple-700"
                            onClick={() =>
                              isDM && removeCondition(participant.id, condIndex)
                            }
                            title={isDM ? "Click to remove" : ""}
                          >
                            {condition}
                          </span>
                        ))}
                      </div>
                    )}
                </div>
              ))}
            </div>

            {/* Combat controls */}
            {isDM && initiativeOrder.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={nextTurn}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  ⏭️ Next Turn
                </button>
                <div className="text-white text-sm flex items-center">
                  Round {currentRound} •{" "}
                  {lastAction && (
                    <span className="text-gray-400 ml-2">{lastAction}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick notes */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Encounter Notes
            </label>
            <textarea
              value={quickNotes}
              onChange={(e) => setQuickNotes(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={2}
              placeholder="Quick notes about this encounter..."
            />
          </div>
        </>
      )}

      {!encounterActive && (
        <div className="text-center text-gray-400 py-8">
          No active encounter. Start one to begin tracking initiative and
          combat.
        </div>
      )}
    </div>
  );
}
