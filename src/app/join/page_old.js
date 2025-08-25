'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';

export default function JoinCampaignPage() {
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for join code in URL
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      setJoinCode(codeFromUrl);
    }
  }, [searchParams]);

  const handleJoinCampaign = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setError('Please enter a join code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/campaigns/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          inviteCode: joinCode.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join campaign');
      }

      // Success! Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Error joining campaign:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCharacterInputChange = (e) => {
    const { name, value } = e.target;
    setCharacterData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="text-gray-300 hover:text-white mb-4 flex items-center gap-2"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold text-white mb-2">Join Campaign</h1>
            <p className="text-gray-300">Enter a campaign code to join an existing adventure</p>
          </div>

          {/* Join Code Form */}
          {!showCharacterForm && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-8">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
                  <div className="text-red-300">{error}</div>
                </div>
              )}

              <form onSubmit={handleJoinCampaign} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Campaign Join Code *
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    required
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-lg tracking-wider text-center"
                    placeholder="Enter campaign code..."
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Ask your Dungeon Master for the campaign join code
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !joinCode.trim()}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-all"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Joining campaign...
                    </div>
                  ) : (
                    '� Join Campaign'
                  )}
                </button>
              </form>

              {/* Help Section */}
              <div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-300 mb-3">📝 How to Join</h3>
                <ol className="text-blue-200 text-sm space-y-2">
                  <li>1. Get the campaign join code from your Dungeon Master</li>
                  <li>2. Enter the code above and click "Join Campaign"</li>
                  <li>3. You'll be added to the campaign member list</li>
                  <li>4. Create your character when you first visit the campaign</li>
                  <li>5. Start playing!</li>
                </ol>
              </div>
            </div>
          )}
            <div className="space-y-6">
              {/* Campaign Info */}
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-2xl">🎲</div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{campaignInfo.name}</h3>
                    <p className="text-green-300">Campaign found!</p>
                  </div>
                </div>
                <p className="text-gray-300">{campaignInfo.description || 'No description provided'}</p>
              </div>

              {/* Character Creation */}
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-8">
                <h3 className="text-xl font-bold text-white mb-4">Create Your Character</h3>
                
                {error && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
                    <div className="text-red-300">{error}</div>
                  </div>
                )}

                <form onSubmit={handleJoinCampaign} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Character Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={characterData.name}
                        onChange={handleCharacterInputChange}
                        required
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Enter character name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Class
                      </label>
                      <select
                        name="class"
                        value={characterData.class}
                        onChange={handleCharacterInputChange}
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="Fighter">Fighter</option>
                        <option value="Wizard">Wizard</option>
                        <option value="Rogue">Rogue</option>
                        <option value="Cleric">Cleric</option>
                        <option value="Ranger">Ranger</option>
                        <option value="Barbarian">Barbarian</option>
                        <option value="Bard">Bard</option>
                        <option value="Druid">Druid</option>
                        <option value="Monk">Monk</option>
                        <option value="Paladin">Paladin</option>
                        <option value="Sorcerer">Sorcerer</option>
                        <option value="Warlock">Warlock</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Race
                      </label>
                      <select
                        name="race"
                        value={characterData.race}
                        onChange={handleCharacterInputChange}
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="Human">Human</option>
                        <option value="Elf">Elf</option>
                        <option value="Dwarf">Dwarf</option>
                        <option value="Halfling">Halfling</option>
                        <option value="Dragonborn">Dragonborn</option>
                        <option value="Gnome">Gnome</option>
                        <option value="Half-Elf">Half-Elf</option>
                        <option value="Half-Orc">Half-Orc</option>
                        <option value="Tiefling">Tiefling</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Starting Level
                      </label>
                      <select
                        name="level"
                        value={characterData.level}
                        onChange={handleCharacterInputChange}
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        {[1,2,3,4,5].map(level => (
                          <option key={level} value={level}>Level {level}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Role
                    </label>
                    <select
                      name="role"
                      value={characterData.role}
                      onChange={handleCharacterInputChange}
                      className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="player">Player</option>
                      <option value="dm">Dungeon Master</option>
                    </select>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      disabled={loading || !characterData.name.trim()}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-all"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Joining Campaign...
                        </div>
                      ) : (
                        '🎯 Join Campaign'
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setShowCharacterForm(false)}
                      disabled={loading}
                      className="bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}