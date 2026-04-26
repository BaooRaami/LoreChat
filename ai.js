// ai.js — All AI instructions and Pollinations API logic for LoreChat

const AI_BASE = 'https://gen.pollinations.ai';
// ============================================================
// SYSTEM PROMPT BUILDERS
// ============================================================

function buildSimpleChatSystem(bots, mentionedBotId) {
  const botList = bots.map(b =>
    `- Name: "${b.name}"\n  Personality: ${b.persona}`
  ).join('\n\n');

  if (mentionedBotId) {
    const bot = bots.find(b => b.id === mentionedBotId);
    return `You are "${bot.name}", a character in a chat conversation.
Your personality: ${bot.persona}

RULES:
- Respond ONLY as ${bot.name}.
- Stay completely in character at all times.
- Keep responses conversational and natural, like a real chat message.
- Do NOT use markdown formatting, headers, or bullet points.
- Do NOT break the fourth wall or mention that you are an AI.`;
  }

  return `You are managing a group chat with multiple AI characters. The characters are:

${botList}

RULES:
- Read the conversation and decide which ONE character should respond based on context, personality fit, and who the message is directed at.
- Respond as ONLY that one character.
- Start your response with the character's name followed by a colon, e.g. "Alex: Hello there!"
- Stay completely in character.
- Keep responses conversational and natural, like real chat messages.
- Do NOT use markdown, headers, or bullet points.
- Do NOT break the fourth wall or mention you are an AI.`;
}

function buildAdventureSystem(bots, scenario, characterName, characterProfile, isDirector) {
  const botList = bots.map(b =>
    `- Name: "${b.name}"\n  Role/Personality: ${b.persona}`
  ).join('\n\n');

  const formatRules = `
RESPONSE FORMAT — start every sentence with one of these prefixes:

- NN for setting the scene or describing the atmosphere
- AA for physical movements and actions
- TT for internal monologue and thoughts (do NOT use quotation marks)
- DD for spoken dialogue and speech

Rules:
- Each sentence MUST start with one of these four prefixes (NN, AA, TT, DD)
- Put the prefix at the very start, followed by a space, then the content
- The prefix applies until the end of the sentence (period, exclamation mark, or question mark)
- Example: NN The room is cold. AA Shivers slightly. DD It's freezing in here. TT I hope the heat comes on soon.
`;  if (isDirector) {
    return `You are the narrator and world engine of an interactive story.
The story world: ${scenario}

The characters in this world are:
${botList}

The player's character: "${characterName}" — ${characterProfile}

The player is using DIRECTOR MODE to pivot or reshape the story.
RULES:
- Acknowledge the player's direction and reshape the story accordingly.
- Narrate the new direction vividly in 2-3 sentences.
- Then, have ONE of the story characters react to or advance the new direction.
- Start narration with [NARRATOR] then character response with [CHARACTER_NAME]:
- Keep the story immersive and engaging.
- Do NOT break the fourth wall.
${formatRules}`;
  }

  return `You are the narrator and world engine of an interactive adventure story.
The story world: ${scenario}

The characters inhabiting this world:
${botList}

The player's character: "${characterName}" — ${characterProfile}

RULES:
- The player describes what their character "${characterName}" does or says.
- React to the player's action as the story world and its characters.
- Choose ONE character from the list who is most relevant to respond or react.
- Optionally add brief narrator text to set the scene, then the character responds.
- Format: "[NARRATOR]: brief scene text (optional)\n[CHARACTER_NAME]: dialogue or action"
- Keep responses immersive, dramatic, and concise (2-4 sentences total).
- Advance the story meaningfully with each response.
- The story should feel alive, consequences should matter.
- Do NOT break character or mention AI.
${formatRules}`;
}

function buildStorySystem(bots, scenario, chunkSize, summary) {
  const botList = bots.map(b =>
    `- ${b.name}: ${b.persona}`
  ).join('\n');

  const lengthGuide = {
    short: '1-2 paragraphs (100-200 words)',
    medium: '2-3 paragraphs (200-300 words)',
    long: '3-5 paragraphs (300-400 words)'
  }[chunkSize] || '2-3 paragraphs (200-300 words)';

  const summaryBlock = summary
    ? `\nSTORY SO FAR:\n${summary}\n\n- Do NOT repeat or re-introduce events already listed in the summary above.\n- Build upon them, advance the story forward.`
    : '';

  return `You are a masterful storyteller writing an immersive story.
Scenario: ${scenario}

Characters in this story:
${botList}
${summaryBlock}

RULES:
- Write the next part of the story: ${lengthGuide}.
- Write in third-person narrative style, rich and descriptive.
- Include character dialogue naturally woven into the narrative.
- End each chunk at a natural pause point that makes the reader want more.
- Write flowing prose using the following format:

RESPONSE FORMAT — start every sentence with one of these prefixes:
- NN for setting the scene or describing the atmosphere
- AA for physical movements and actions
- TT for internal monologue and thoughts (do NOT use quotation marks)
- DD for spoken dialogue and speech

Rules:
- Each sentence MUST start with one of these four prefixes (NN, AA, TT, DD)
- Put the prefix at the very start, followed by a space, then the content
- The prefix applies until the end of the sentence (period, exclamation mark, or question mark)
- Example: NN The room is cold. AA Shivers slightly. DD It's freezing in here. TT I hope the heat comes on soon.`;}

// ============================================================
// API CALL
// ============================================================

async function callAI(messages, systemPrompt, apiKey, model, onChunk = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'openai',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      stream: true,
      private: true
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const piece = parsed.choices?.[0]?.delta?.content || '';
        if (piece) {
          fullText += piece;
          if (onChunk) onChunk(piece, fullText);
        }
      } catch (e) { /* skip malformed lines */ }
    }
  }

  return fullText.trim();
}// ============================================================
// MODE HANDLERS
// ============================================================

async function sendSimpleChat(history, bots, mentionedBotId, settings, onChunk = null) {  
  const systemPrompt = buildSimpleChatSystem(bots, mentionedBotId);
  const messages = history.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.role === 'user' ? m.content : `${m.botName}: ${m.content}`
  }));

  const raw = await callAI(messages, systemPrompt, settings.apiKey, settings.model, onChunk);

  // Parse response to extract bot name and content  
  const colonIdx = raw.indexOf(':');
  if (!mentionedBotId && colonIdx > 0 && colonIdx < 30) {
    const name = raw.substring(0, colonIdx).trim();
    const content = raw.substring(colonIdx + 1).trim();
    const bot = bots.find(b => b.name.toLowerCase() === name.toLowerCase()) || bots[0];
    return { botId: bot.id, botName: bot.name, content };
  }

  const bot = mentionedBotId ? bots.find(b => b.id === mentionedBotId) : bots[0];
  return { botId: bot.id, botName: bot.name, content: raw };
}

async function sendAdventureMessage(history, bots, session, isDirector, settings, onChunk = null) {  
  const systemPrompt = buildAdventureSystem(
    bots,
    session.scenario,
    session.characterName || 'The Player',
    session.characterProfile || 'A brave adventurer',
    isDirector
  );

  const window = history.slice(-settings.memoryDepth);
  const messages = window.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.isDirector ? `[DIRECTOR]: ${m.content}` : m.content
  }));

  const raw = await callAI(messages, systemPrompt, settings.apiKey, settings.model, onChunk);

  // Parse narrator + character sections  
  const narratorMatch = raw.match(/\[NARRATOR\]:\s*([\s\S]*?)(?=\[[\w\s]+\]:|$)/i);
  const charMatch = raw.match(/\[([^\]]+)\]:\s*([\s\S]+)$/i);

  if (charMatch) {
    const charName = charMatch[1].trim();
    const charContent = charMatch[2].trim();
    const narratorText = narratorMatch ? narratorMatch[1].trim() : '';
    const bot = bots.find(b => b.name.toLowerCase() === charName.toLowerCase()) || bots[0];
    return {
      narrator: narratorText,
      botId: bot.id,
      botName: bot.name,
      content: charContent
    };
  }

  // Fallback: treat whole response as narrator/bot reply
  return {
    narrator: '',
    botId: bots[0].id,
    botName: bots[0].name,
    content: raw
  };
}

async function generateStoryChunk(existingChunks, bots, session, settings, directorInput = null, onChunk = null) {
  const systemPrompt = buildStorySystem(bots, session.scenario, settings.storyChunkSize || 'medium', session.summary || null);

  const messages = [];
  if (existingChunks.length === 0) {
    messages.push({ role: 'user', content: directorInput || 'Begin the story.' });
  } else {
    const lastChunk = existingChunks[existingChunks.length - 1];
    messages.push({ role: 'assistant', content: lastChunk });
    if (directorInput) {
      messages.push({ role: 'user', content: `[DIRECTOR]: ${directorInput}` });
    } else {
      messages.push({ role: 'user', content: 'Continue the story.' });
    }
  }

  return await callAI(messages, systemPrompt, settings.apiKey, settings.model, onChunk);
}

async function generateStorySummary(allChunks, bots, session, settings) {
  const botList = bots.map(b => `- ${b.name}: ${b.persona}`).join('\n');
  const chunkCount = allChunks.length;

  const bulletTarget = chunkCount <= 3 ? '3 to 5' : chunkCount <= 8 ? '6 to 8' : '8 to 10';

  const systemPrompt = `You are a story editor creating a concise memory summary for an AI storyteller.
Scenario: ${session.scenario}

Characters:
${botList}

RULES:
- Write ${bulletTarget} bullet points summarizing ALL key events, character actions, and plot developments so far.
- Each bullet is one crisp sentence. No fluff, no prose.
- Focus on facts: who did what, what was revealed, what changed.
- Compress older events, be slightly more detailed on recent ones.
- Do NOT continue the story. Only summarize what has already happened.
- Do NOT use markdown headers. Just bullet points starting with •`;

  const storyText = allChunks.join('\n\n');
  const messages = [{ role: 'user', content: `Summarize this story so far:\n\n${storyText}` }];

  return await callAI(messages, systemPrompt, settings.apiKey, settings.model);
}
const AI = { sendSimpleChat, sendAdventureMessage, generateStoryChunk, generateStorySummary };