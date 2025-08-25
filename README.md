# AI Dungeon Master - Sprint 1 MVP

A web-based AI Dungeon Master application that strictly follows official D&D 5e SRD rules, built with Next.js, Supabase, and React.

## 🎯 Sprint 1 Features Completed

### ✅ Authentication System

- **Supabase Authentication**: Complete signup/login system with session management
- **User Profiles**: Extended user profile storage with display names
- **Session Tokens**: Secure JWT-based authentication
- **Protected Routes**: Automatic redirection based on authentication state

### ✅ Campaign Management

- **Campaign Creation**: Users can create and manage D&D campaigns
- **Invite System**: Join campaigns via unique invite codes
- **Player Management**: Support for multiple players per campaign with roles (DM/Player)
- **Data Persistence**: Full campaign data stored in Supabase

### ✅ D&D 5e SRD Compliant Character Sheets

- **Complete Character Data**: Name, class, race, level, HP, AC, all 6 ability scores
- **SRD Rule Enforcement**:
  - Ability scores restricted to 3-20 range
  - Valid D&D 5e classes and races only
  - Proper HP and AC calculations
- **Character Persistence**: Full CRUD operations for character data
- **One Character Per Campaign**: MVP limitation for simplicity

### ✅ Advanced Dice Rolling System

- **Full Syntax Support**: `/roll XdY+Z` notation (e.g., `/roll 1d20+5`, `/roll 3d6`)
- **Advantage/Disadvantage**: `/roll 2d20kh1+mod` (advantage), `/roll 2d20kl1+mod` (disadvantage)
- **Multiple Expressions**: `/roll 1d20+5, 1d6+2` for multiple rolls
- **D&D 5e Die Types**: Supports d4, d6, d8, d10, d12, d20, d100
- **Result Formatting**: Clear display of individual rolls and final totals

### ✅ Database Schema (Supabase/PostgreSQL)

Complete normalized database with:

- **users** (via Supabase Auth) + **user_profiles** extension
- **campaigns** with invite codes and ownership
- **campaign_players** junction table for many-to-many relationships
- **characters** with full D&D 5e SRD compliance
- **Row Level Security (RLS)** for data protection
- **Triggers and Functions** for automation

### ✅ REST API Endpoints

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User authentication
- `DELETE /api/auth/login` - User logout
- `POST /api/campaigns` - Create new campaign
- `GET /api/campaigns` - List user's campaigns
- `POST /api/campaigns/join` - Join campaign via invite code
- `POST /api/characters/create` - Create character
- `GET /api/characters/[id]` - Get character details
- `PUT /api/characters/[id]` - Update character

### ✅ Next.js Pages & Components

- **LoginPage** (`/login`) - Authentication with signup/login toggle
- **DashboardPage** (`/dashboard`) - Campaign overview and management
- **CampaignPage** (`/campaign/[id]`) - Campaign view with dice roller
- **CharacterSheetPage** (`/character/[id]`) - Full D&D character sheet

### ✅ Comprehensive Testing

- **Jest Test Suite**: 31 passing tests for dice rolling system
- **Test Coverage**: All dice rolling scenarios, validation, and edge cases
- **D&D 5e Compliance**: Tests ensure SRD rule adherence

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Add your Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

Run the SQL schema in your Supabase dashboard:

```bash
# Execute database/schema.sql in Supabase SQL editor
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Run Tests

```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
```

### 6. Optional: Setup Google Authentication

For Google OAuth login, see [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) for detailed instructions.

## 🎲 Dice Rolling Examples

The enhanced dice service supports full D&D 5e syntax:

```javascript
// Basic rolls
/roll 1d20+5         // Attack roll with +5 modifier
/roll 3d6            // Ability score generation
/roll 1d8+2          // Longsword damage

// Advantage/Disadvantage
/roll 2d20kh1+3      // Advantage (keep highest)
/roll 2d20kl1-1      // Disadvantage (keep lowest)

// Multiple expressions
/roll 1d20+5, 1d6+2  // Attack and damage
```

## 🏆 Sprint 1 Success Criteria

✅ **Authentication**: Complete Supabase auth with user management  
✅ **Campaigns**: Full CRUD operations with invite system  
✅ **Characters**: D&D 5e SRD compliant character sheets  
✅ **Dice Rolling**: Advanced syntax with advantage/disadvantage  
✅ **Database**: Normalized schema with security  
✅ **API**: RESTful endpoints for all operations  
✅ **UI**: Responsive pages for all core functions  
✅ **Testing**: Comprehensive test suite with 100% pass rate

Sprint 1 MVP is **complete and fully functional**! 🎉

## Features

- 🎭 **AI Dungeonmaster**: Powered by OpenAI's GPT models for immersive storytelling
- 💬 **Interactive Chat Interface**: Real-time conversation with your AI DM
- 🎲 **Dice Rolling**: Built-in dice roller supporting D&D notation (e.g., `/roll 1d20+5`)
- 📚 **Campaign Memory**: Persistent storage of NPCs, locations, quests, and events
- ⚔️ **D&D 5e Integration**: Follows official D&D 5th Edition rules and mechanics
- 🎨 **Fantasy UI**: Beautiful, themed interface with Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### Installation

1. **Clone and setup**:

   ```bash
   cd ai-dungeonmaster
   npm install
   ```

2. **Configure environment**:

   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` and add your OpenAI API key:

   ```
   OPENAI_API_KEY=your_actual_api_key_here
   ```

3. **Run the development server**:

   ```bash
   npm run dev
   ```

4. **Open your browser** to [http://localhost:3000](http://localhost:3000)

## Usage

### Basic Chat

- Simply type your actions, questions, or roleplay into the chat
- The AI DM will respond with narrative, NPC dialogue, and world descriptions

### Dice Commands

- `/roll 1d20+5` - Roll a d20 with +5 modifier
- `/roll 3d6` - Roll three six-sided dice
- `/roll 1d4+2` - Roll a d4 with +2 modifier

### Other Commands

- `/help` - Show all available commands
- `/npc [name]` - Interact with NPCs (coming soon)
- `/quest` - Manage quests (coming soon)
- `/location` - Get location details (coming soon)

## Architecture

### Project Structure

```
src/
├── app/
│   ├── api/ai/route.js          # AI API endpoint
│   ├── globals.css              # Global styles
│   ├── layout.js                # Root layout
│   └── page.js                  # Main chat page
├── components/
│   └── ChatWindow.jsx           # Chat interface component
└── lib/
    ├── openaiService.js         # OpenAI integration
    ├── memoryService.js         # Campaign memory management
    └── diceService.js           # Dice rolling logic
```

### Key Components

- **ChatWindow**: React component handling the chat UI and user interactions
- **OpenAI Service**: Manages AI conversations with context and memory
- **Memory Service**: SQLite-based persistent storage for campaign data
- **Dice Service**: Comprehensive D&D dice rolling system

## Technology Stack

- **Frontend**: Next.js 15, React, Tailwind CSS
- **Backend**: Next.js API Routes, OpenAI API
- **Database**: SQLite with fallback to in-memory storage
- **AI**: OpenAI GPT-3.5-turbo (configurable)

## Development

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Environment Variables

| Variable            | Description             | Default         |
| ------------------- | ----------------------- | --------------- |
| `OPENAI_API_KEY`    | Your OpenAI API key     | Required        |
| `OPENAI_MODEL`      | OpenAI model to use     | `gpt-3.5-turbo` |
| `OPENAI_MAX_TOKENS` | Max tokens per response | `500`           |
| `NODE_ENV`          | Environment mode        | `development`   |

## Campaign Memory

The app automatically tracks:

- **Messages**: Full conversation history
- **NPCs**: Characters encountered with personalities
- **Locations**: Places visited with descriptions
- **Quests**: Active and completed objectives
- **Events**: Important story moments

Data is stored in `data/campaigns.db` (SQLite) with automatic fallback to in-memory storage.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with clear messages: `git commit -m "Add feature description"`
5. Push and create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Roadmap

- [ ] Multiple campaign support
- [ ] Character sheet integration
- [ ] Initiative tracker
- [ ] Monster manual integration
- [ ] Custom world building tools
- [ ] Voice chat integration
- [ ] Multiplayer support

## Support

- 📖 [D&D 5e Basic Rules](https://www.dndbeyond.com/sources/basic-rules)
- 🤖 [OpenAI API Documentation](https://platform.openai.com/docs)
- ⚡ [Next.js Documentation](https://nextjs.org/docs)

---

**Happy adventuring! 🗡️✨**
