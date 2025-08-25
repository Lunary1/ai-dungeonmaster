import sqlite3 from "sqlite3";
import { promisify } from "util";
import path from "path";
import fs from "fs";

class MemoryService {
  constructor() {
    this.db = null;
    this.initDatabase();
  }

  async initDatabase() {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const dbPath = path.join(dataDir, "campaigns.db");

      this.db = new sqlite3.Database(dbPath);

      // Promisify database methods
      this.dbRun = promisify(this.db.run.bind(this.db));
      this.dbGet = promisify(this.db.get.bind(this.db));
      this.dbAll = promisify(this.db.all.bind(this.db));

      // Create tables
      await this.createTables();

      console.log("Database initialized successfully");
    } catch (error) {
      console.error("Error initializing database:", error);
      // Fallback to in-memory storage
      this.useInMemoryFallback();
    }
  }

  async createTables() {
    const createTables = `
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        current_location TEXT,
        party_level INTEGER DEFAULT 1,
        session_notes TEXT,
        imported_from TEXT,
        imported_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        name TEXT NOT NULL,
        class TEXT,
        level INTEGER DEFAULT 1,
        background TEXT,
        personality TEXT,
        backstory TEXT,
        stats TEXT, -- JSON string for ability scores
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
      );

      CREATE TABLE IF NOT EXISTS npcs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        personality TEXT,
        location TEXT,
        relationship TEXT,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
      );

      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT, -- town, dungeon, wilderness, etc.
        visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
      );

      CREATE TABLE IF NOT EXISTS quests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        giver_npc TEXT,
        reward TEXT,
        progress TEXT, -- JSON string for quest progress
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        description TEXT NOT NULL,
        importance INTEGER DEFAULT 1,
        location TEXT,
        npcs_involved TEXT, -- JSON array of NPC names
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        character_id INTEGER,
        item_name TEXT NOT NULL,
        description TEXT,
        quantity INTEGER DEFAULT 1,
        type TEXT, -- weapon, armor, consumable, treasure, etc.
        properties TEXT, -- JSON string for item properties
        acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id),
        FOREIGN KEY (character_id) REFERENCES characters (id)
      );
    `;

    if (this.db) {
      await this.dbRun(createTables);
    }
  }

  useInMemoryFallback() {
    console.log("Using in-memory storage fallback");
    this.memoryStore = {
      campaigns: {},
      messages: {},
      npcs: {},
      locations: {},
      quests: {},
      events: {},
    };
  }

  async addMessage(campaignId, message) {
    try {
      // Ensure campaign exists
      await this.ensureCampaignExists(campaignId);

      if (this.db) {
        await this.dbRun(
          "INSERT INTO messages (campaign_id, type, content, timestamp) VALUES (?, ?, ?, ?)",
          [
            campaignId,
            message.type,
            message.content,
            message.timestamp.toISOString(),
          ]
        );
      } else {
        // Fallback to memory
        if (!this.memoryStore.messages[campaignId]) {
          this.memoryStore.messages[campaignId] = [];
        }
        this.memoryStore.messages[campaignId].push({
          ...message,
          id: Date.now(),
          campaign_id: campaignId,
        });
      }
    } catch (error) {
      console.error("Error adding message:", error);
    }
  }

  async getCampaignMemory(campaignId) {
    try {
      if (this.db) {
        const [
          messages,
          npcs,
          locations,
          quests,
          events,
          characters,
          inventory,
        ] = await Promise.all([
          this.dbAll(
            "SELECT * FROM messages WHERE campaign_id = ? ORDER BY timestamp DESC LIMIT 50",
            [campaignId]
          ),
          this.dbAll(
            "SELECT * FROM npcs WHERE campaign_id = ? ORDER BY last_seen DESC",
            [campaignId]
          ),
          this.dbAll(
            "SELECT * FROM locations WHERE campaign_id = ? ORDER BY visited_at DESC",
            [campaignId]
          ),
          this.dbAll(
            'SELECT * FROM quests WHERE campaign_id = ? AND status = "active"',
            [campaignId]
          ),
          this.dbAll(
            "SELECT * FROM events WHERE campaign_id = ? ORDER BY timestamp DESC LIMIT 10",
            [campaignId]
          ),
          this.dbAll("SELECT * FROM characters WHERE campaign_id = ?", [
            campaignId,
          ]),
          this.dbAll("SELECT * FROM inventory WHERE campaign_id = ?", [
            campaignId,
          ]),
        ]);

        // Get current location
        const campaign = await this.dbGet(
          "SELECT current_location FROM campaigns WHERE id = ?",
          [campaignId]
        );
        let currentLocation = null;
        if (campaign?.current_location) {
          currentLocation = await this.dbGet(
            "SELECT * FROM locations WHERE campaign_id = ? AND name = ?",
            [campaignId, campaign.current_location]
          );
        }

        return {
          messages,
          npcs,
          locations,
          quests,
          importantEvents: events,
          characters,
          inventory,
          currentLocation,
        };
      } else {
        // Fallback to memory
        return {
          messages: this.memoryStore.messages[campaignId] || [],
          npcs: this.memoryStore.npcs[campaignId] || [],
          locations: this.memoryStore.locations[campaignId] || [],
          quests: this.memoryStore.quests[campaignId] || [],
          importantEvents: this.memoryStore.events[campaignId] || [],
          characters: this.memoryStore.characters?.[campaignId] || [],
          inventory: this.memoryStore.inventory?.[campaignId] || [],
          currentLocation:
            this.memoryStore.currentLocation?.[campaignId] || null,
        };
      }
    } catch (error) {
      console.error("Error getting campaign memory:", error);
      return {
        messages: [],
        npcs: [],
        locations: [],
        quests: [],
        importantEvents: [],
        characters: [],
        inventory: [],
        currentLocation: null,
      };
    }
  }

  // Character management methods
  async addOrUpdateCharacter(campaignId, characterData) {
    try {
      await this.ensureCampaignExists(campaignId);

      const {
        name,
        class: charClass,
        level,
        background,
        personality,
        backstory,
        stats,
      } = characterData;

      if (this.db) {
        // Check if character exists
        const existing = await this.dbGet(
          "SELECT id FROM characters WHERE campaign_id = ? AND name = ?",
          [campaignId, name]
        );

        if (existing) {
          // Update existing character
          await this.dbRun(
            `
            UPDATE characters 
            SET class = ?, level = ?, background = ?, personality = ?, backstory = ?, stats = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [
              charClass,
              level,
              background,
              personality,
              backstory,
              JSON.stringify(stats),
              existing.id,
            ]
          );
        } else {
          // Insert new character
          await this.dbRun(
            `
            INSERT INTO characters (campaign_id, name, class, level, background, personality, backstory, stats)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              campaignId,
              name,
              charClass,
              level,
              background,
              personality,
              backstory,
              JSON.stringify(stats),
            ]
          );
        }
      } else {
        // Fallback to memory
        if (!this.memoryStore.characters) this.memoryStore.characters = {};
        if (!this.memoryStore.characters[campaignId])
          this.memoryStore.characters[campaignId] = [];

        const existing = this.memoryStore.characters[campaignId].find(
          (c) => c.name === name
        );
        if (existing) {
          Object.assign(existing, characterData);
        } else {
          this.memoryStore.characters[campaignId].push({
            id: Date.now(),
            campaign_id: campaignId,
            ...characterData,
          });
        }
      }
    } catch (error) {
      console.error("Error adding/updating character:", error);
    }
  }

  async getCharacter(campaignId, characterName) {
    try {
      if (this.db) {
        const character = await this.dbGet(
          "SELECT * FROM characters WHERE campaign_id = ? AND name = ?",
          [campaignId, characterName]
        );

        if (character && character.stats) {
          character.stats = JSON.parse(character.stats);
        }
        return character;
      } else {
        const characters = this.memoryStore.characters?.[campaignId] || [];
        return characters.find((c) => c.name === characterName);
      }
    } catch (error) {
      console.error("Error getting character:", error);
      return null;
    }
  }

  // Enhanced campaign info processing
  async processCampaignInfo(campaignId, extractedInfo) {
    try {
      if (!extractedInfo || Object.keys(extractedInfo).length === 0) return;

      // Process NPCs
      if (extractedInfo.npcs && extractedInfo.npcs.length > 0) {
        for (const npc of extractedInfo.npcs) {
          await this.addOrUpdateNPC(campaignId, npc);
        }
      }

      // Process locations
      if (extractedInfo.locations && extractedInfo.locations.length > 0) {
        for (const location of extractedInfo.locations) {
          await this.addLocation(campaignId, location);
        }
      }

      // Process quests
      if (extractedInfo.quests && extractedInfo.quests.length > 0) {
        for (const quest of extractedInfo.quests) {
          await this.addQuest(campaignId, quest);
        }
      }

      // Process events
      if (extractedInfo.events && extractedInfo.events.length > 0) {
        for (const event of extractedInfo.events) {
          await this.addEvent(campaignId, event);
        }
      }

      // Process character updates
      if (extractedInfo.character_updates) {
        await this.addOrUpdateCharacter(
          campaignId,
          extractedInfo.character_updates
        );
      }

      // Process inventory items
      if (extractedInfo.items && extractedInfo.items.length > 0) {
        for (const item of extractedInfo.items) {
          await this.addInventoryItem(campaignId, item);
        }
      }
    } catch (error) {
      console.error("Error processing campaign info:", error);
    }
  }

  async addOrUpdateNPC(campaignId, npcData) {
    try {
      await this.ensureCampaignExists(campaignId);

      if (this.db) {
        const existing = await this.dbGet(
          "SELECT id FROM npcs WHERE campaign_id = ? AND name = ?",
          [campaignId, npcData.name]
        );

        if (existing) {
          await this.dbRun(
            `
            UPDATE npcs 
            SET description = ?, personality = ?, last_seen = CURRENT_TIMESTAMP, notes = ?
            WHERE id = ?`,
            [
              npcData.description,
              npcData.personality,
              npcData.notes,
              existing.id,
            ]
          );
        } else {
          await this.dbRun(
            `
            INSERT INTO npcs (campaign_id, name, description, personality, location, relationship, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              campaignId,
              npcData.name,
              npcData.description,
              npcData.personality,
              npcData.location,
              npcData.relationship,
              npcData.notes,
            ]
          );
        }
      } else {
        // Fallback to memory
        if (!this.memoryStore.npcs[campaignId])
          this.memoryStore.npcs[campaignId] = [];
        const existing = this.memoryStore.npcs[campaignId].find(
          (n) => n.name === npcData.name
        );
        if (existing) {
          Object.assign(existing, npcData);
        } else {
          this.memoryStore.npcs[campaignId].push({
            id: Date.now(),
            campaign_id: campaignId,
            ...npcData,
          });
        }
      }
    } catch (error) {
      console.error("Error adding/updating NPC:", error);
    }
  }

  async addInventoryItem(campaignId, itemData) {
    try {
      await this.ensureCampaignExists(campaignId);

      if (this.db) {
        await this.dbRun(
          `
          INSERT INTO inventory (campaign_id, item_name, description, quantity, type, properties)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            campaignId,
            itemData.name,
            itemData.description,
            itemData.quantity || 1,
            itemData.type,
            JSON.stringify(itemData.properties || {}),
          ]
        );
      } else {
        if (!this.memoryStore.inventory) this.memoryStore.inventory = {};
        if (!this.memoryStore.inventory[campaignId])
          this.memoryStore.inventory[campaignId] = [];

        this.memoryStore.inventory[campaignId].push({
          id: Date.now(),
          campaign_id: campaignId,
          ...itemData,
        });
      }
    } catch (error) {
      console.error("Error adding inventory item:", error);
    }
  }

  async setCurrentLocation(campaignId, locationName) {
    try {
      if (this.db) {
        await this.dbRun(
          "UPDATE campaigns SET current_location = ? WHERE id = ?",
          [locationName, campaignId]
        );
      } else {
        if (!this.memoryStore.currentLocation)
          this.memoryStore.currentLocation = {};
        this.memoryStore.currentLocation[campaignId] = { name: locationName };
      }
    } catch (error) {
      console.error("Error setting current location:", error);
    }
  }

  async addNPC(campaignId, npc) {
    try {
      await this.ensureCampaignExists(campaignId);

      if (this.db) {
        await this.dbRun(
          "INSERT INTO npcs (campaign_id, name, description, personality) VALUES (?, ?, ?, ?)",
          [campaignId, npc.name, npc.description || "", npc.personality || ""]
        );
      } else {
        if (!this.memoryStore.npcs[campaignId]) {
          this.memoryStore.npcs[campaignId] = [];
        }
        this.memoryStore.npcs[campaignId].push({
          ...npc,
          id: Date.now(),
          campaign_id: campaignId,
        });
      }
    } catch (error) {
      console.error("Error adding NPC:", error);
    }
  }

  async addLocation(campaignId, location) {
    try {
      await this.ensureCampaignExists(campaignId);

      if (this.db) {
        await this.dbRun(
          "INSERT INTO locations (campaign_id, name, description) VALUES (?, ?, ?)",
          [campaignId, location.name, location.description || ""]
        );
      } else {
        if (!this.memoryStore.locations[campaignId]) {
          this.memoryStore.locations[campaignId] = [];
        }
        this.memoryStore.locations[campaignId].push({
          ...location,
          id: Date.now(),
          campaign_id: campaignId,
        });
      }
    } catch (error) {
      console.error("Error adding location:", error);
    }
  }

  async addQuest(campaignId, quest) {
    try {
      await this.ensureCampaignExists(campaignId);

      if (this.db) {
        await this.dbRun(
          "INSERT INTO quests (campaign_id, title, description, status) VALUES (?, ?, ?, ?)",
          [
            campaignId,
            quest.title,
            quest.description || "",
            quest.status || "active",
          ]
        );
      } else {
        if (!this.memoryStore.quests[campaignId]) {
          this.memoryStore.quests[campaignId] = [];
        }
        this.memoryStore.quests[campaignId].push({
          ...quest,
          id: Date.now(),
          campaign_id: campaignId,
        });
      }
    } catch (error) {
      console.error("Error adding quest:", error);
    }
  }

  async addEvent(campaignId, event) {
    try {
      await this.ensureCampaignExists(campaignId);

      if (this.db) {
        await this.dbRun(
          "INSERT INTO events (campaign_id, description, importance) VALUES (?, ?, ?)",
          [campaignId, event.description, event.importance || 1]
        );
      } else {
        if (!this.memoryStore.events[campaignId]) {
          this.memoryStore.events[campaignId] = [];
        }
        this.memoryStore.events[campaignId].push({
          ...event,
          id: Date.now(),
          campaign_id: campaignId,
        });
      }
    } catch (error) {
      console.error("Error adding event:", error);
    }
  }

  async ensureCampaignExists(campaignId) {
    try {
      if (this.db) {
        const existing = await this.dbGet(
          "SELECT id FROM campaigns WHERE id = ?",
          [campaignId]
        );
        if (!existing) {
          await this.dbRun(
            "INSERT INTO campaigns (id, name, description) VALUES (?, ?, ?)",
            [campaignId, "Default Campaign", "Auto-created campaign"]
          );
        }
      } else {
        if (!this.memoryStore.campaigns[campaignId]) {
          this.memoryStore.campaigns[campaignId] = {
            id: campaignId,
            name: "Default Campaign",
            description: "Auto-created campaign",
            created_at: new Date(),
          };
        }
      }
    } catch (error) {
      console.error("Error ensuring campaign exists:", error);
    }
  }

  async close() {
    if (this.db) {
      this.db.close();
    }
  }

  // Enhanced Character Sheet Methods
  async saveCharacter(campaignId, characterData) {
    try {
      if (this.db) {
        // Check if character exists
        const existing = await this.dbGet(
          "SELECT * FROM characters WHERE campaign_id = ? AND name = ?",
          [campaignId, characterData.name]
        );

        if (existing) {
          // Update existing character
          await this.dbRun(
            `
            UPDATE characters 
            SET class = ?, level = ?, background = ?, personality = ?, backstory = ?, 
                stats = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [
              characterData.class,
              characterData.level,
              characterData.background,
              characterData.personality,
              characterData.backstory,
              JSON.stringify(characterData),
              existing.id,
            ]
          );
        } else {
          // Insert new character
          await this.dbRun(
            `
            INSERT INTO characters (campaign_id, name, class, level, background, personality, backstory, stats)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              campaignId,
              characterData.name,
              characterData.class,
              characterData.level,
              characterData.background,
              characterData.personality,
              characterData.backstory,
              JSON.stringify(characterData),
            ]
          );
        }
      } else {
        // Fallback to memory
        if (!this.memoryStore.characters) this.memoryStore.characters = {};
        if (!this.memoryStore.characters[campaignId])
          this.memoryStore.characters[campaignId] = [];

        const existing = this.memoryStore.characters[campaignId].find(
          (c) => c.name === characterData.name
        );
        if (existing) {
          Object.assign(existing, characterData);
        } else {
          this.memoryStore.characters[campaignId].push({
            id: Date.now(),
            campaign_id: campaignId,
            ...characterData,
          });
        }
      }
    } catch (error) {
      console.error("Error saving character:", error);
      throw error;
    }
  }

  async getCharacter(campaignId) {
    try {
      if (this.db) {
        const character = await this.dbGet(
          "SELECT * FROM characters WHERE campaign_id = ? ORDER BY updated_at DESC LIMIT 1",
          [campaignId]
        );

        if (character && character.stats) {
          const parsedStats = JSON.parse(character.stats);
          return parsedStats;
        }
        return character;
      } else {
        const characters = this.memoryStore.characters?.[campaignId] || [];
        return characters[0] || null;
      }
    } catch (error) {
      console.error("Error getting character:", error);
      return null;
    }
  }

  async getAllCharacters(campaignId) {
    try {
      if (this.db) {
        const characters = await this.dbAll(
          "SELECT * FROM characters WHERE campaign_id = ? ORDER BY updated_at DESC",
          [campaignId]
        );

        return characters.map((character) => {
          if (character.stats) {
            try {
              return JSON.parse(character.stats);
            } catch {
              return character;
            }
          }
          return character;
        });
      } else {
        return this.memoryStore.characters?.[campaignId] || [];
      }
    } catch (error) {
      console.error("Error getting all characters:", error);
      return [];
    }
  }

  async createCampaign(campaignId, campaignData) {
    try {
      if (this.db) {
        await this.dbRun(
          `INSERT OR REPLACE INTO campaigns 
           (id, name, description, current_location, updated_at) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            campaignId,
            campaignData.name,
            campaignData.description || "",
            campaignData.currentLocation || "",
            new Date().toISOString(),
          ]
        );

        // Add campaign creation event
        await this.addEvent(campaignId, {
          description: `Campaign "${campaignData.name}" was created`,
          importance: 3,
          location: campaignData.currentLocation || "",
          npcs_involved: [],
        });

        // If it's Dragon of Icespire Peak, add some initial context
        if (
          campaignData.name.toLowerCase().includes("icespire") ||
          campaignData.name.toLowerCase().includes("dragon")
        ) {
          await this.addLocation(campaignId, {
            name: "Phandalin",
            description:
              "A frontier town nestled in the foothills below Icespire Peak",
            type: "town",
            notes: "Starting location for the adventure",
          });
        }
      } else {
        // Fallback to memory
        if (!this.memoryStore.campaigns) {
          this.memoryStore.campaigns = {};
        }
        this.memoryStore.campaigns[campaignId] = {
          ...campaignData,
          id: campaignId,
          created_at: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      throw error;
    }
  }

  async addCampaignContext(campaignId, contextData) {
    try {
      // Add key locations
      if (contextData.keyLocations) {
        for (const locationName of contextData.keyLocations) {
          await this.addLocation(campaignId, {
            name: locationName,
            description: `Key location in ${
              contextData.module || "the campaign"
            }`,
            type: "important",
            notes: `Part of ${contextData.mainQuest || "the main storyline"}`,
          });
        }
      }

      // Add key NPCs
      if (contextData.keyNPCs) {
        for (const npcName of contextData.keyNPCs) {
          await this.addNPC(campaignId, {
            name: npcName,
            description: `Important NPC in ${
              contextData.module || "the campaign"
            }`,
            personality: "To be determined through roleplay",
            location: contextData.setting || "Unknown",
            relationship: "neutral",
          });
        }
      }

      // Add main quest
      if (contextData.mainQuest) {
        await this.addQuest(campaignId, {
          title: "Main Quest",
          description: contextData.mainQuest,
          status: "active",
          giver_npc: "Campaign Module",
          reward: "Adventure and experience",
          progress: JSON.stringify({ stage: "beginning" }),
        });
      }

      // Add context event
      await this.addEvent(campaignId, {
        description: `Campaign context loaded for ${
          contextData.module || "adventure"
        }`,
        importance: 2,
        location: contextData.setting || "",
        npcs_involved: contextData.keyNPCs || [],
      });
    } catch (error) {
      console.error("Error adding campaign context:", error);
      throw error;
    }
  }
}

export const memoryService = new MemoryService();
