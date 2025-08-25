#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function setupEnvironment() {
  console.log("🐉 AI Dungeonmaster Setup\n");

  const envPath = path.join(process.cwd(), ".env.local");
  const envExamplePath = path.join(process.cwd(), ".env.local.example");

  // Check if .env.local already exists
  if (fs.existsSync(envPath)) {
    console.log("✅ .env.local already exists");

    const answer = await question(
      "Do you want to update your OpenAI API key? (y/N): "
    );
    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      console.log(
        'Setup complete! Run "npm run dev" to start the development server.'
      );
      rl.close();
      return;
    }
  }

  console.log("Setting up your environment file...\n");

  // Get OpenAI API key
  const apiKey = await question(
    "Enter your OpenAI API key (get one at https://platform.openai.com/api-keys): "
  );

  if (!apiKey.trim()) {
    console.log("❌ OpenAI API key is required. Please run setup again.");
    rl.close();
    return;
  }

  // Validate API key format (basic check)
  if (!apiKey.startsWith("sk-")) {
    console.log('⚠️  Warning: OpenAI API keys typically start with "sk-"');
    const confirm = await question("Continue anyway? (y/N): ");
    if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
      rl.close();
      return;
    }
  }

  // Optional model selection
  const model =
    (await question("OpenAI model (press Enter for gpt-3.5-turbo): ")) ||
    "gpt-3.5-turbo";

  // Optional max tokens
  const maxTokens =
    (await question("Max tokens per response (press Enter for 500): ")) ||
    "500";

  // Create .env.local content
  const envContent = `# OpenAI API Configuration
OPENAI_API_KEY=${apiKey}
OPENAI_MODEL=${model}
OPENAI_MAX_TOKENS=${maxTokens}

# Development
NODE_ENV=development
`;

  // Write the file
  try {
    fs.writeFileSync(envPath, envContent);
    console.log("\n✅ Environment file created successfully!");
    console.log("\n🚀 Setup complete! You can now run:");
    console.log("   npm run dev");
    console.log("\n📖 Then open http://localhost:3000 in your browser");
    console.log("\n🎲 Try these commands in the chat:");
    console.log('   - "I want to start an adventure"');
    console.log('   - "/roll 1d20+5"');
    console.log('   - "/help"');
  } catch (error) {
    console.error("❌ Error creating environment file:", error.message);
  }

  rl.close();
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Run setup
setupEnvironment().catch(console.error);
