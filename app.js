// app.js — Main Vue application for LoreChat

const { createApp, ref, computed, onMounted, nextTick, watch } = Vue;

const BOT_EMOJIS = ['👨','👩','👧','👦','👶','🧑','👨‍🦱','👩‍🦱','👨‍🦰','👩‍🦰','👱‍♂️','👱‍♀️','👨‍🦳','👩‍🦳','👨‍🦲','👩‍🦲','🧔','👵','👴','👲','👳‍♂️','👳‍♀️','🧕','👮‍♂️','👮‍♀️','👷‍♂️','👷‍♀️','💂‍♂️','💂‍♀️','🕵️‍♂️','🕵️‍♀️','👨‍⚕️','👩‍⚕️','👨‍🌾','👩‍🌾','👨‍🍳','👩‍🍳','👨‍🎓','👩‍🎓','👨‍🎤','👩‍🎤','👨‍🏫','👩‍🏫','👨‍🏭','👩‍🏭','👨‍💻','👩‍💻','👨‍💼','👩‍💼','👨‍🔧','👩‍🔧','👨‍🔬','👩‍🔬','👨‍🎨','👩‍🎨','👨‍🚒','👩‍🚒','👨‍✈️','👩‍✈️','👨‍🚀','👩‍🚀','👨‍⚖️','👩‍⚖️','👰','🤵','👸','🤴','🤶','🎅','🧙‍♂️','🧙‍♀️','🧝‍♂️','🧝‍♀️','🧛‍♂️','🧛‍♀️','🧟‍♂️','🧟‍♀️','🧞‍♂️','🧞‍♀️','🧜‍♂️','🧜‍♀️','🧚‍♂️','🧚‍♀️','💃','🕺','🥷','🦸','🦹','🏇','⛷️','🏂','🏄','🚣','🏊','🏋️','🚴','⛹️','🦁','🐺','🐉','🦉','🦄','🐼','💎','⚔️','🛡️','🧪','📜','🔮','🦾'];

const BOT_COLORS = [  
  '#ff0000', '#ff4500', '#ff7043', '#ff6d00', '#f39c12', '#faa61a',
  '#fee75c', '#ffeb3b', '#c8e600', '#57f287', '#2ecc71', '#1abc9c',
  '#00e5ff', '#00b0f4', '#3498db', '#5865f2', '#7289da', '#9b59b6',
  '#aa00ff', '#eb459e', '#ff4081', '#ff73fa', '#ed4245', '#e74c3c'
];

createApp({
  setup() {
    // ===== STATE =====
    const view = ref('home');
    const viewHistory = ref([]);
    const homeTab = ref('chats');
    const modal = ref(null);
    const settingsSaved = ref(false);
    const errorMsg = ref('');
    const isLoading = ref(false);
    const directorMode = ref(false);
    const chatMenu = ref(false);
    const storyDirectorInput = ref(false);
    // Data
    const bots = ref([]);
    const chats = ref([]);
    const adventures = ref([]);
    const stories = ref([]);
    const settings = ref({ apiKey: '', model: 'openai', memoryDepth: 20, storyChunkSize: 'medium' });

    // Active session
    const activeSession = ref(null);
    const activeMessages = ref([]);
    const storyChunks = ref([]);

    // Input
    const inputText = ref('');
    const mentionedBot = ref(null);
    const mentionSuggestions = ref([]);

    // New session form
    const newSession = ref({ name: '', scenario: '', botIds: [], characterName: '', characterProfile: '' });

    // Bot editing
    const editingBot = ref({ name: '', persona: '', color: BOT_COLORS[0] });

    // Refs
    const messagesArea = ref(null);
    const storyBody = ref(null);
    const chatInput = ref(null);
    const importFile = ref(null);
    const kebabMenuRef = ref(null);

    // ===== COMPUTED =====
    const activeBots = computed(() => {
      if (!activeSession.value) return [];
      return bots.value.filter(b => activeSession.value.botIds.includes(b.id));
    });

    const botColors = computed(() => BOT_COLORS);

    const kebabClearLabel = computed(() => {
      if (view.value === 'adventure') return 'Clear Adventure';
      if (view.value === 'story') return 'Clear Story';
      return 'Clear Chat';
    });

    const kebabDeleteLabel = computed(() => {
      if (view.value === 'adventure') return 'Delete Adventure';
      if (view.value === 'story') return 'Delete Story';
      return 'Delete Chat';
    });

    function kebabDelete() {
      if (view.value === 'chat') { deleteChat(activeSession.value.id); goBack(); }
      else if (view.value === 'adventure') { deleteAdventure(activeSession.value.id); goBack(); }
      else if (view.value === 'story') { deleteStory(activeSession.value.id); goBack(); }
    }

    // ===== PROSE PARSER =====
    function parseProseSegments(text) {
      if (!text) return [];
      const tagOrder = ['NARRATE', 'ACTION', 'THOUGHT', 'DIALOGUE'];
      const regex = /\[(NARRATE|ACTION|THOUGHT|DIALOGUE)\]([\s\S]*?)\[\/\1\]/gi;
      const segments = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          const plain = text.slice(lastIndex, match.index).trim();
          if (plain) segments.push({ type: 'plain', text: plain });
        }
        segments.push({ type: match[1].toLowerCase(), text: match[2].trim() });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        const plain = text.slice(lastIndex).trim();
        if (plain) segments.push({ type: 'plain', text: plain });
      }
      return segments.length > 0 ? segments : [{ type: 'plain', text }];
    }

    // ===== HELPERS =====    
    function getBotColor(botId) {
      const bot = bots.value.find(b => b.id === botId);
      return bot ? bot.color : '#5865f2';
    }

    function getBotInitial(botId) {
      const bot = bots.value.find(b => b.id === botId);
      return bot ? bot.name[0].toUpperCase() : '?';
    }

    function getBotEmoji(botId) {
      const bot = bots.value.find(b => b.id === botId);
      return bot ? bot.emoji || '' : '';
    }

    function formatTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const now = new Date();
      const diffDays = Math.floor((now - d) / 86400000);
      if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    function showError(msg) {
      errorMsg.value = msg;
      setTimeout(() => { errorMsg.value = ''; }, 3500);
    }

    function toPlain(obj) {
      return JSON.parse(JSON.stringify(obj));
    }

    function scrollToBottom(ref) {
      nextTick(() => {
        if (ref.value) ref.value.scrollTop = ref.value.scrollHeight;
      });
    }

    // ===== NAVIGATION =====
    function navigate(target) {
      viewHistory.value.push(view.value);
      view.value = target;
    }

    function goBack() {
      view.value = viewHistory.value.pop() || 'home';
      activeSession.value = null;
      activeMessages.value = [];
      storyChunks.value = [];
      inputText.value = '';
      directorMode.value = false;
    }

    // ===== SETTINGS =====
    async function loadSettings() {
      const s = await DB.getOne('settings', 'main');
      if (s) settings.value = { ...settings.value, ...s };
    }

    async function saveSettings() {
      await DB.putOne('settings', { id: 'main', ...settings.value });
      settingsSaved.value = true;
      setTimeout(() => { settingsSaved.value = false; }, 2000);
    }

    // ===== LOAD DATA =====
    async function loadAll() {
      bots.value = await DB.getAll('bots');
      chats.value = (await DB.getAll('chats')).sort((a, b) => b.updatedAt - a.updatedAt);
      adventures.value = (await DB.getAll('adventures')).sort((a, b) => b.updatedAt - a.updatedAt);
      stories.value = (await DB.getAll('stories')).sort((a, b) => b.updatedAt - a.updatedAt);
      await loadSettings();
    }

    // ===== BOTS =====
    function openBotModal(bot) {
      editingBot.value = bot ? { ...bot } : { id: null, name: '', persona: '', color: BOT_COLORS[0], emoji: '' };
      modal.value = 'bot';
    }

    function editBot(bot) { openBotModal(bot); }

    async function saveBot() {
      const bot = {
        ...editingBot.value,
        id: editingBot.value.id || DB.generateId(),
        createdAt: editingBot.value.createdAt || Date.now()
      };
      await DB.putOne('bots', bot);
      await loadAll();
      modal.value = null;
    }

    function deleteBotFromModal() {
      if (!editingBot.value?.id) return;
      deleteBot(editingBot.value.id);
      modal.value = null;
    }

    async function deleteBot(id) {
      if (!confirm('Delete this bot?')) return;
      await DB.deleteOne('bots', id);
      await loadAll();
    }

    async function exportBots() {
      const data = { bots: bots.value };
      downloadJSON(data, 'lorechat-bots.json');
    }

    // ===== CREATE SESSION =====
    function openCreateModal() {
      newSession.value = { name: '', scenario: '', botIds: [], characterName: '', characterProfile: '' };
      modal.value = 'create';
    }

    function toggleBotSelection(botId) {
      const idx = newSession.value.botIds.indexOf(botId);
      if (idx >= 0) newSession.value.botIds.splice(idx, 1);
      else newSession.value.botIds.push(botId);
    }

    async function createSession() {
      const ns = newSession.value;
      if (ns.botIds.length === 0) return;

      // Auto-generate name for Chat mode if empty
      let sessionName = ns.name.trim();
      if (homeTab.value === 'chats' && !sessionName) {
        const selectedBots = bots.value.filter(b => ns.botIds.includes(b.id));
        if (selectedBots.length <= 2) {
          sessionName = selectedBots.map(b => b.name).join(', ');
        } else {
          sessionName = selectedBots.slice(0, 2).map(b => b.name).join(', ') + `, +${selectedBots.length - 2} more`;
        }
      }

      // For Adventure and Story modes, name is still required
      if ((homeTab.value === 'adventure' || homeTab.value === 'stories') && !sessionName) return;

      const id = DB.generateId();
      const now = Date.now();

      if (homeTab.value === 'chats') {
        const session = { id, name: sessionName, botIds: [...ns.botIds], messages: [], lastMessage: '', createdAt: now, updatedAt: now };
        await DB.putOne('chats', session);
        await loadAll();
        modal.value = null;
        openChat(session);
      } else if (homeTab.value === 'adventure') {
        const session = { id, name: sessionName, scenario: ns.scenario, characterName: ns.characterName, characterProfile: ns.characterProfile, botIds: [...ns.botIds], messages: [], createdAt: now, updatedAt: now };
        await DB.putOne('adventures', session);
        await loadAll();
        modal.value = null;
        openAdventure(session);
      } else if (homeTab.value === 'stories') {
        const session = { id, name: sessionName, scenario: ns.scenario, botIds: [...ns.botIds], chunks: [], createdAt: now, updatedAt: now };
        await DB.putOne('stories', session);
        await loadAll();
        modal.value = null;
        openStory(session);
      }
    }
    // ===== CHAT =====
    function openChat(chat) {
      activeSession.value = chat;
      activeMessages.value = chat.messages || [];
      navigate('chat');
      scrollToBottom(messagesArea);
    }

    async function clearSession() {
      if (!confirm('Clear all messages?')) return;
      activeMessages.value = [];
      storyChunks.value = [];
      activeSession.value.messages = [];
      activeSession.value.chunks = [];
      activeSession.value.lastMessage = '';
      activeSession.value.updatedAt = Date.now();
      if (view.value === 'chat') await DB.putOne('chats', toPlain(activeSession.value));
      if (view.value === 'adventure') await DB.putOne('adventures', toPlain(activeSession.value));
      if (view.value === 'story') await DB.putOne('stories', toPlain(activeSession.value));
      await loadAll();
    }
    // @mention detection
    function onInput() {
      const val = inputText.value;
      const atIdx = val.lastIndexOf('@');
      if (atIdx >= 0) {
        const query = val.substring(atIdx + 1).toLowerCase();
        mentionSuggestions.value = activeBots.value.filter(b => b.name.toLowerCase().startsWith(query));
      } else {
        mentionSuggestions.value = [];
        mentionedBot.value = null;
      }
    }

    function insertAt() {
      if (!inputText.value.includes('@')) {
        inputText.value = '@' + inputText.value;
        onInput();
      }
      nextTick(() => chatInput.value?.focus());
    }

    function selectMention(bot) {      
      const atIdx = inputText.value.lastIndexOf('@');
      inputText.value = inputText.value.substring(0, atIdx) + '@' + bot.name + ' ';
      mentionedBot.value = bot;
      mentionSuggestions.value = [];
      chatInput.value?.focus();
    }

    async function sendMessage() {
      const text = inputText.value.trim();
      if (!text || isLoading.value) return;

      // Detect @mention in final text
      const mentionMatch = text.match(/@(\w[\w\s]*?)(?:\s|$)/);
      let resolvedMention = mentionedBot.value;
      if (mentionMatch && !resolvedMention) {
        const name = mentionMatch[1].trim().toLowerCase();
        resolvedMention = activeBots.value.find(b => b.name.toLowerCase() === name);
      }

      const userMsg = { id: DB.generateId(), role: 'user', content: text, ts: Date.now() };
      activeMessages.value.push(userMsg);
      inputText.value = '';
      mentionedBot.value = null;
      mentionSuggestions.value = [];
      scrollToBottom(messagesArea);

      // Typing placeholder
      const typingId = DB.generateId();
      activeMessages.value.push({ id: typingId, role: 'bot', typing: true, botName: '...', botId: null });
      scrollToBottom(messagesArea);
      isLoading.value = true;

      try {
        const result = await AI.sendSimpleChat(
          activeMessages.value.filter(m => !m.typing),
          activeBots.value,
          resolvedMention ? resolvedMention.id : null,
          settings.value
        );

        // Remove typing
        const idx = activeMessages.value.findIndex(m => m.id === typingId);
        if (idx >= 0) activeMessages.value.splice(idx, 1);

        const botMsg = { id: DB.generateId(), role: 'bot', botId: result.botId, botName: result.botName, content: result.content, ts: Date.now() };
        activeMessages.value.push(botMsg);

        // Persist
        activeSession.value.messages = [...activeMessages.value];
        activeSession.value.lastMessage = result.content.substring(0, 60);
        activeSession.value.updatedAt = Date.now();
        await DB.putOne('chats', toPlain(activeSession.value));
        await loadAll();
        scrollToBottom(messagesArea);
      } catch (err) {
        const idx = activeMessages.value.findIndex(m => m.id === typingId);
        if (idx >= 0) activeMessages.value.splice(idx, 1);
        showError('AI error: ' + err.message);
      }
      isLoading.value = false;
    }

    // ===== ADVENTURE =====
    function openAdventure(adv) {
      activeSession.value = adv;
      activeMessages.value = adv.messages || [];
      navigate('adventure');
      scrollToBottom(messagesArea);
    }

    async function sendAdventureMessage() {
      const text = inputText.value.trim();
      if (!text || isLoading.value) return;

      const userMsg = { id: DB.generateId(), role: 'user', content: text, isDirector: directorMode.value, ts: Date.now() };
      activeMessages.value.push(userMsg);
      inputText.value = '';
      scrollToBottom(messagesArea);

      const typingId = DB.generateId();
      activeMessages.value.push({ id: typingId, role: 'bot', typing: true, botName: '...', botId: null });
      scrollToBottom(messagesArea);
      isLoading.value = true;

      try {
        const result = await AI.sendAdventureMessage(
          activeMessages.value.filter(m => !m.typing),
          activeBots.value,
          activeSession.value,
          directorMode.value,
          settings.value
        );

        const idx = activeMessages.value.findIndex(m => m.id === typingId);
        if (idx >= 0) activeMessages.value.splice(idx, 1);

        // Add narrator if present
        if (result.narrator) {
          activeMessages.value.push({
            id: DB.generateId(), role: 'bot', botId: null, botName: 'Narrator',
            content: result.narrator, isNarrator: true, ts: Date.now()
          });
        }

        // Add character response
        activeMessages.value.push({
          id: DB.generateId(), role: 'bot', botId: result.botId, botName: result.botName,
          content: result.content, isDirector: false, ts: Date.now()
        });

        activeSession.value.messages = [...activeMessages.value];
        activeSession.value.updatedAt = Date.now();
        await DB.putOne('adventures', toPlain(activeSession.value));
        await loadAll();
        scrollToBottom(messagesArea);
      } catch (err) {
        const idx = activeMessages.value.findIndex(m => m.id === typingId);
        if (idx >= 0) activeMessages.value.splice(idx, 1);
        showError('AI error: ' + err.message);
      }
      isLoading.value = false;
    }

    // ===== STORY =====
    function openStory(story) {
      activeSession.value = story;
      storyChunks.value = story.chunks || [];
      navigate('story');
    }

    async function generateStoryChunk(isFirst, directorInput = null) {
      if (isLoading.value) return;
      isLoading.value = true;
      try {
        // Filter out director chunks - only send actual story text to AI
        const storyOnlyChunks = storyChunks.value.filter(c => typeof c === 'string' || !c.type);
        const chunk = await AI.generateStoryChunk(
          storyOnlyChunks,
          activeBots.value,
          activeSession.value,
          settings.value,
          directorInput
        );
        storyChunks.value.push(chunk);
        activeSession.value.chunks = [...storyChunks.value];
        activeSession.value.updatedAt = Date.now();
        await DB.putOne('stories', toPlain(activeSession.value));
        await loadAll();
        scrollToBottom(storyBody);
      } catch (err) {
        showError('AI error: ' + err.message);
      }
      isLoading.value = false;
    }    // ===== DELETE =====
    async function deleteChat(id) {
      if (!confirm('Delete this chat?')) return;
      await DB.deleteOne('chats', id);
      await loadAll();
    }

    async function deleteAdventure(id) {
      if (!confirm('Delete this adventure?')) return;
      await DB.deleteOne('adventures', id);
      await loadAll();
    }

    async function deleteStory(id) {
      if (!confirm('Delete this story?')) return;
      await DB.deleteOne('stories', id);
      await loadAll();
    }

    async function sendStoryDirectorInput() {
      const text = inputText.value.trim();
      if (!text || isLoading.value) return;
      
      // Add director message as a special chunk
      const directorChunk = { type: 'director', content: text };
      storyChunks.value.push(directorChunk);
      
      inputText.value = '';
      storyDirectorInput.value = false;
      scrollToBottom(storyBody);
      
      // Generate next chunk based on director input
      await generateStoryChunk(false, text);
    }    // ===== IMPORT / EXPORT =====
    function downloadJSON(data, filename) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    async function exportAll() {
      const data = await DB.exportAllData();
      downloadJSON(data, 'lorechat-backup.json');
    }

    function triggerImport() { importFile.value.click(); }

    async function importAll(e) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await DB.importAllData(data);
        await loadAll();
        alert('Import successful!');
      } catch (err) {
        showError('Import failed: ' + err.message);
      }
      e.target.value = '';
    }

    // ===== INIT =====
    onMounted(async () => {
      await loadAll();
      document.addEventListener('click', (e) => {
        if (chatMenu.value && kebabMenuRef.value && !kebabMenuRef.value.contains(e.target)) {
          chatMenu.value = false;
        }
      });
    });

    return {
      view, viewHistory, homeTab, modal, settingsSaved, errorMsg, isLoading, directorMode, chatMenu,
      bots, chats, adventures, stories, settings,
      activeSession, activeMessages, storyChunks, activeBots,
      inputText, mentionedBot, mentionSuggestions,
      newSession, editingBot,
      messagesArea, storyBody, chatInput, importFile, kebabMenuRef,
      botColors: BOT_COLORS,
      botEmojis: BOT_EMOJIS,
      getBotColor, getBotInitial, getBotEmoji, formatTime, parseProseSegments,      
      kebabClearLabel, kebabDeleteLabel, kebabDelete,
      navigate, goBack,
      saveSettings,
      openBotModal, editBot, saveBot, deleteBot, deleteBotFromModal, exportBots,      
      openCreateModal, toggleBotSelection, createSession,
      openChat, clearSession, onInput, insertAt, selectMention, sendMessage,      
      openAdventure, sendAdventureMessage,
      openStory, generateStoryChunk, sendStoryDirectorInput, storyDirectorInput,
      deleteChat, deleteAdventure, deleteStory,
      exportAll, triggerImport, importAll    
    };
  }
}).mount('#app');